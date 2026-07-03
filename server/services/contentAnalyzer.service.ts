// server/services/contentAnalyzer.service.ts
import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import { recognize as tesseractRecognize } from "tesseract.js";
import { fileTypeFromBuffer } from "file-type";

// CJS-loaded libraries to avoid Bun ESM issues
const _require = createRequire(import.meta.url);
const _pdfParseModule = _require("pdf-parse");
const PDFParse = _pdfParseModule.PDFParse ?? _pdfParseModule.default ?? _pdfParseModule;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  /** Raw extracted text from the file */
  text: string;
  /** Detected file category */
  fileType: string;
  /** MIME type (actual, fingerprinted) */
  detectedMime: string;
  /** Metadata extracted from the file */
  metadata: Record<string, unknown>;
  /** URLs / links found in the content */
  links: string[];
  /** Word count */
  wordCount: number;
  /** Character count */
  charCount: number;
  /** Extraction method used */
  method: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract all URLs from a block of text */
function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  return Array.from(new Set(text.match(urlRegex) ?? []));
}

/** Simple word / char stats */
function textStats(text: string) {
  const trimmed = text.trim();
  return {
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    charCount: trimmed.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extractors
// ─────────────────────────────────────────────────────────────────────────────

/** OCR an image file with Tesseract.js (pure JS, no system binary needed) */
async function extractFromImage(filePath: string): Promise<Pick<AnalysisResult, "text" | "method">> {
  try {
    const result = await tesseractRecognize(filePath, "eng");
    const text = result?.data?.text ?? "";
    return { text: text.trim(), method: "OCR (Tesseract.js)" };
  } catch (e) {
    console.error("[analyzeContent] OCR error:", e);
    return { text: "", method: "OCR (Tesseract.js) – failed" };
  }
}

/** Parse a PDF buffer */
async function extractFromPdf(buffer: Buffer): Promise<Pick<AnalysisResult, "text" | "metadata" | "method">> {
  try {
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();

    // getText() returns a result object with .text (joined string) and .pages (array of { text, num })
    let text = "";
    if (typeof result === "string") {
      text = result;
    } else if (result) {
      if (result.text && typeof result.text === "string" && result.text.trim().length > 0) {
        text = result.text;
      }
      if (!text.trim() && Array.isArray(result.pages)) {
        text = result.pages
          .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
          .join("\n\n");
      }
    }

    const info = await parser.getInfo().catch(() => ({}));
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    console.log(`[extractFromPdf] Text extraction got ${wordCount} words`);

    // If text extraction yielded very little, this PDF is likely image-based.
    // Try to extract embedded images and OCR them.
    if (wordCount < 50) {
      console.log("[extractFromPdf] Low word count — attempting image extraction + OCR fallback...");
      try {
        const imageResult = await parser.getImage();
        const allImages: any[] = [];
        if (imageResult && Array.isArray(imageResult.pages)) {
          for (const page of imageResult.pages) {
            if (Array.isArray(page.images)) {
              allImages.push(...page.images);
            }
          }
        }
        console.log(`[extractFromPdf] Found ${allImages.length} embedded image(s)`);

        if (allImages.length > 0) {
          const ocrTexts: string[] = [];
          for (let i = 0; i < Math.min(allImages.length, 10); i++) {
            const img = allImages[i];
            try {
              // Try resolving the image to a usable buffer
              let imgBuffer: Buffer | null = null;
              if (img.data && img.data instanceof Uint8Array) {
                imgBuffer = Buffer.from(img.data);
              } else if (typeof parser.resolveEmbeddedImage === "function") {
                const resolved = await parser.resolveEmbeddedImage(img);
                if (resolved?.data) {
                  imgBuffer = Buffer.from(resolved.data);
                }
              }

              if (imgBuffer && imgBuffer.length > 1000) {
                // Write to a temp file for OCR
                const tmpPath = path.join(import.meta.dir, `../../uploads/_ocr_tmp_${Date.now()}_${i}.png`);
                await fs.mkdir(path.dirname(tmpPath), { recursive: true });
                await fs.writeFile(tmpPath, imgBuffer);
                try {
                  const ocrResult = await extractFromImage(tmpPath);
                  if (ocrResult.text.trim()) {
                    ocrTexts.push(ocrResult.text.trim());
                  }
                } finally {
                  await fs.unlink(tmpPath).catch(() => {});
                }
              }
            } catch (imgErr) {
              console.error(`[extractFromPdf] OCR on image ${i} failed:`, imgErr);
            }
          }

          if (ocrTexts.length > 0) {
            const ocrText = ocrTexts.join("\n\n");
            console.log(`[extractFromPdf] OCR extracted ${ocrText.split(/\s+/).length} words from ${ocrTexts.length} image(s)`);
            return {
              text: ocrText,
              metadata: (info as Record<string, unknown>) ?? {},
              method: "PDF parser (pdf-parse) + OCR fallback",
            };
          }
        }
      } catch (ocrErr) {
        console.error("[extractFromPdf] OCR fallback failed:", ocrErr);
      }
    }

    return {
      text: String(text).trim(),
      metadata: (info as Record<string, unknown>) ?? {},
      method: "PDF parser (pdf-parse)",
    };
  } catch (e) {
    console.error("[analyzeContent] PDF parse error:", e);
    return { text: "", metadata: {}, method: "PDF parser – failed" };
  }
}

/** Extract raw text from DOCX / DOC via mammoth */
async function extractFromDocx(filePath: string): Promise<Pick<AnalysisResult, "text" | "method">> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value.trim(), method: "DOCX extractor (mammoth)" };
  } catch (e) {
    console.error("[analyzeContent] DOCX parse error:", e);
    return { text: "", method: "DOCX extractor – failed" };
  }
}

/** Strip RTF control words and return plain text */
function stripRtf(raw: string): string {
  // Remove RTF control groups and words, leaving plain text
  return raw
    .replace(/\\[a-z]+[-\d]* ?/g, " ")  // control words
    .replace(/[{}\\]/g, "")              // braces and backslashes
    .replace(/\s{2,}/g, " ")             // collapse whitespace
    .trim();
}

/** Extract text from an RTF buffer */
async function extractFromRtf(buffer: Buffer): Promise<Pick<AnalysisResult, "text" | "method">> {
  try {
    const raw = buffer.toString("latin1");
    const text = stripRtf(raw);
    return { text, method: "RTF extractor (regex stripper)" };
  } catch (e) {
    console.error("[analyzeContent] RTF parse error:", e);
    return { text: "", method: "RTF extractor – failed" };
  }
}

/** Extract text from ODT (it's a ZIP with content.xml inside) */
async function extractFromOdt(buffer: Buffer): Promise<Pick<AnalysisResult, "text" | "method">> {
  try {
    // Extract XML text nodes from the raw buffer (works without unzip for small files)
    const raw = buffer.toString("utf-8", 0, Math.min(buffer.length, 500_000));
    // content.xml is inside the ZIP; extract any readable text between XML tags
    const textMatches = raw.match(/<text:[^>]*>([^<]+)<\/text:[^>]*>/g) ?? [];
    const text = textMatches
      .map((m) => m.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .join(" ");
    return { text: text || raw.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim(), method: "ODT extractor (XML)" };
  } catch (e) {
    console.error("[analyzeContent] ODT parse error:", e);
    return { text: "", method: "ODT extractor – failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyse the content of an uploaded file.
 * Returns a structured result including extracted text, metadata, links, and stats.
 */
export async function analyzeContent(filePath: string, declaredMime: string): Promise<AnalysisResult> {
  const absolutePath = path.resolve(filePath);
  const buffer = await fs.readFile(absolutePath);

  // --- File-type fingerprinting (detect actual type from magic bytes) ---
  const detected = await fileTypeFromBuffer(buffer);
  const detectedMime = detected?.mime ?? declaredMime;
  const ext = detected?.ext ?? path.extname(filePath).replace(".", "").toLowerCase();

  let text = "";
  let metadata: Record<string, unknown> = {
    declaredMime,
    detectedMime,
    detectedExtension: ext,
    fileSize: buffer.length,
    fileName: path.basename(filePath),
  };
  let method = "unknown";
  let fileType = "unknown";

  // ── Images ──────────────────────────────────────────────────────────────────
  if (detectedMime.startsWith("image/") || declaredMime.startsWith("image/")) {
    fileType = "image";
    const r = await extractFromImage(absolutePath);
    text = r.text;
    method = r.method;
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────
  else if (detectedMime === "application/pdf" || declaredMime === "application/pdf") {
    fileType = "pdf";
    const r = await extractFromPdf(buffer);
    text = r.text;
    method = r.method;
    metadata = { ...metadata, ...r.metadata };
  }

  // ── DOCX / DOC ──────────────────────────────────────────────────────────────
  else if (
    detectedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    declaredMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    declaredMime === "application/msword" ||
    ext === "docx" || ext === "doc"
  ) {
    fileType = "word";
    const r = await extractFromDocx(absolutePath);
    text = r.text;
    method = r.method;
  }

  // ── RTF ─────────────────────────────────────────────────────────────────────
  else if (
    declaredMime === "application/rtf" ||
    declaredMime === "text/rtf" ||
    ext === "rtf"
  ) {
    fileType = "rtf";
    const r = await extractFromRtf(buffer);
    text = r.text;
    method = r.method;
  }

  // ── ODT ─────────────────────────────────────────────────────────────────────
  else if (
    detectedMime === "application/vnd.oasis.opendocument.text" ||
    declaredMime === "application/vnd.oasis.opendocument.text" ||
    ext === "odt"
  ) {
    fileType = "odt";
    const r = await extractFromOdt(buffer);
    text = r.text;
    method = r.method;
  }

  // ── Plain text / CSV / Markdown / JSON / XML / code files ──────────────────
  else if (
    detectedMime.startsWith("text/") ||
    declaredMime.startsWith("text/") ||
    ["txt", "md", "csv", "json", "xml", "yaml", "yml", "log", "html", "htm", "js", "ts", "py"].includes(ext)
  ) {
    fileType = "text";
    text = buffer.toString("utf-8");
    method = "Plain-text read";
  }

  // ── Fallback: try UTF-8 read ─────────────────────────────────────────────
  else {
    fileType = "binary";
    try {
      text = buffer.toString("utf-8");
      method = "Fallback UTF-8 read";
    } catch {
      method = "Unsupported / binary";
      text = "";
    }
  }

  // --- Link extraction ---
  const links = extractLinks(text);

  // --- Stats ---
  const { wordCount, charCount } = textStats(text);

  return {
    text,
    fileType,
    detectedMime,
    metadata: {
      ...metadata,
      linksFound: links.length,
      extractionMethod: method,
    },
    links,
    wordCount,
    charCount,
    method,
  };
}
