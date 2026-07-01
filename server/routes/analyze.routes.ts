// server/routes/analyze.routes.ts
import express, { Request, Response } from "express";
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { analyzeContent } from "../services/contentAnalyzer.service";

const _require = createRequire(import.meta.url);
const multer = _require("multer");

const router = express.Router();

// Use import.meta.dir (Bun) instead of __dirname in ESM
const __dirname = import.meta.dir;

// ── Blocked MIME types (no ZIP / executables) ──────────────────────────────
const BLOCKED_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sharedlib",
  "application/x-dex",
  "application/vnd.android.package-archive",
]);

// Configure multer storage
const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || "10485760") }, // 10 MB default
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (err: Error | null, accept: boolean) => void) => {
    if (BLOCKED_MIMES.has(file.mimetype)) {
      cb(new Error(`File type "${file.mimetype}" is not allowed.`), false);
    } else {
      cb(null, true);
    }
  },
});

// ── POST /api/analyze ───────────────────────────────────────────────────────
router.post("/api/analyze", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath    = req.file.path;
    const originalName = req.file.originalname;
    const mime        = req.file.mimetype;
    const userQuery   = (req.body.query as string | undefined)?.trim() || "";

    console.log(`[analyze] Received file: ${originalName} (${mime})`);

    // ── Step 1: Extract content ──────────────────────────────────────────────
    const analysis = await analyzeContent(filePath, mime);
    console.log(`[analyze] Extracted ${analysis.wordCount} words via ${analysis.method}`);

    // ── Step 2: Build context for LLM ───────────────────────────────────────
    const contextSections: string[] = [];

    contextSections.push(`File: ${originalName}`);
    contextSections.push(`Type: ${analysis.fileType.toUpperCase()} (detected MIME: ${analysis.detectedMime})`);
    contextSections.push(`Size: ${analysis.metadata.fileSize} bytes | Words: ${analysis.wordCount} | Characters: ${analysis.charCount}`);

    if (analysis.links.length > 0) {
      contextSections.push(`\nLinks found (${analysis.links.length}):\n${analysis.links.slice(0, 20).join("\n")}`);
    }

    if (analysis.text) {
      // Truncate to ~12 000 chars to stay within token budget
      const truncated = analysis.text.length > 12000
        ? analysis.text.slice(0, 12000) + "\n\n[…content truncated…]"
        : analysis.text;
      contextSections.push(`\nExtracted content:\n${truncated}`);
    } else {
      contextSections.push("\n[No readable text could be extracted from this file.]");
    }

    const contextBlock = contextSections.join("\n");

    // ── Step 3: Call LLM (OpenRouter) ───────────────────────────────────────
    const answer = await callLLM(contextBlock, userQuery);
    console.log("[analyze] LLM response received");

    // ── Step 4: Persist the file publicly ───────────────────────────────────
    const publicDir = path.join(__dirname, "../../public/uploads");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    // Sanitise file name to avoid path traversal
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicPath = path.join(publicDir, safeName);
    fs.renameSync(filePath, publicPath);
    const fileUrl = `/uploads/${encodeURIComponent(safeName)}`;

    // ── Step 5: Respond ─────────────────────────────────────────────────────
    res.json({
      answer,
      fileUrl,
      fileName: originalName,
      analysis: {
        fileType:     analysis.fileType,
        detectedMime: analysis.detectedMime,
        wordCount:    analysis.wordCount,
        charCount:    analysis.charCount,
        linksFound:   analysis.links.length,
        links:        analysis.links.slice(0, 10),
        method:       analysis.method,
        metadata:     analysis.metadata,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze] Error:", message);
    res.status(500).json({ error: "Failed to analyze file", details: message });
  }
});

// ── LLM helper ──────────────────────────────────────────────────────────────
async function callLLM(context: string, userQuery: string): Promise<string> {
  const apiKey   = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";
  const model    = process.env.LLM_MODEL    || "anthropic/claude-3-sonnet";

  if (!apiKey) throw new Error("LLM_API_KEY is not set in environment");

  const systemPrompt =
    "You are an expert document analyst. You are given extracted content from an uploaded file. " +
    "Analyze the content thoroughly, answer any specific questions the user has, " +
    "and provide a clear, structured summary of the key information in the file. " +
    "If links were found, mention relevant ones. Be concise but comprehensive.";

  const userMessage = userQuery
    ? `The user's question: "${userQuery}"\n\n${context}`
    : context;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`LLM request failed: ${response.status} – ${txt}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export default router;
