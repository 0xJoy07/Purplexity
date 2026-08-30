import express from "express";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import "dotenv/config";
import { searchWeb } from "./services/webSearch.service";
import { generateResponse } from "./services/ai.service";
import { testDatabaseConnection, prisma } from "./config/db.config";
import { saveQuery, getUserById, findOrCreateUser, getUserStats } from "./services/database.service";
import {
  createConversation,
  getConversationById,
  getUserConversations,
  addMessageToConversation,
  generateConversationTitle,
  updateConversationTitle,
  deleteConversation,
} from "./services/conversation.service";
import {
  calculateRequestTokens,
  trackTokenUsage,
  getTodayTokenUsage,
  getUserTokenHistory,
  estimateContextTokens,
  trimContextToFit,
  getNextResetTimeIST,
} from "./services/token.service";
import { checkTokenLimit, ensureUserId } from "./middleware/tokenLimit.middleware";
import {
  createGuestUser,
  createTestUser,
  getAllGuestUsers,
  getAllTestUsers,
  deleteTempUser,
  cleanupExpiredGuests,
} from "./services/guest.service";
import authRoutes from "./routes/auth.routes";
import sessionRoutes from "./routes/session.routes";
import { requireAuth } from "./middleware/auth.middleware";
import cors from "cors";
import { signSession, pruneExpiredSessions } from "./services/auth.service";
import path from "path";
import fs from "fs";

import { createRequire } from "module";
import analyzeRouter from "./routes/analyze.routes";
import { analyzeContent } from "./services/contentAnalyzer.service";
import { checkCache, saveToCache } from "./services/semanticCache.service";

const PROJECT_ROOT = process.cwd();
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");

// CJS require for multer (ESM compat with Bun)
const _require = createRequire(import.meta.url);
const multer = _require("multer");

// Configure multer for conversation file uploads
const conversationUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || "10485760") },
});

const app = express();

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Core middleware (must be before any route handlers) ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(analyzeRouter);
app.use("/auth", authRoutes);
app.use("/auth/sessions", sessionRoutes);
app.use("/conversations", requireAuth);
app.use("/tokens", requireAuth);

// List files for authenticated user (metadata only)
app.get("/api/files", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) return void res.status(401).json({ error: "Unauthorized" });

    const files = await prisma.file.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Also compute the size from the data column using raw SQL for efficiency
    const filesWithSize = await Promise.all(
      files.map(async (f) => {
        const result = await prisma.$queryRaw<{ size: bigint }[]>`
          SELECT octet_length(data) as size FROM files WHERE id = ${f.id}
        `;
        return { ...f, size: Number(result[0]?.size ?? 0) };
      })
    );

    res.json(filesWithSize);
  } catch (error) {
    console.error("[GET /api/files] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve files securely
app.get("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    const fileId = req.params.id;

    if (!userId) return void res.status(401).json({ error: "Unauthorized" });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) return void res.status(404).json({ error: "File not found" });
    
    // Only allow the owner to access their file
    if (file.userId !== userId) {
      return void res.status(403).json({ error: "Forbidden" });
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name)}"`);
    res.send(file.data);
  } catch (error) {
    console.error("[GET /api/files/:id] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a file
app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    const fileId = req.params.id;

    if (!userId) return void res.status(401).json({ error: "Unauthorized" });

    const file = await prisma.file.findUnique({ where: { id: fileId }, select: { userId: true } });
    if (!file) return void res.status(404).json({ error: "File not found" });
    if (file.userId !== userId) return void res.status(403).json({ error: "Forbidden" });

    await prisma.file.delete({ where: { id: fileId } });
    res.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/files/:id] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test database connection on startup
testDatabaseConnection();

// ============================================
// LEGACY ENDPOINT - Single Query (Standalone)
// ============================================
app.post("/purplexity_ask", requireAuth, checkTokenLimit, async (req: Request, res: Response) => {
  try {
    const query: string = req.body.query;
    const userId: string = req.body.userId;
    const reqTokenInfo = (req as any).tokenInfo;
    const contextWindowLimit = reqTokenInfo?.contextWindowLimit ?? 50000;

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    console.log(`Query received: ${query}`);

    // Step 1: Check Semantic Cache
    console.log("Checking semantic cache...");
    const cacheMatch = await checkCache(query);
    let webSearchResults: any[] = [];
    let aiResponse: any;
    let contextTrimmed = false;
    
    if (cacheMatch) {
      console.log("✅ Cache hit! Skipping web search.");
      webSearchResults = cacheMatch.sources;
      
      const cachedContext = `[CACHED INFORMATION FOUND]\nWe found this information in our database for a similar query: ${cacheMatch.response}`;
      
      // Pre-flight context window check
      const estimated = estimateContextTokens(query, JSON.stringify([]), undefined, cachedContext);
      if (estimated > contextWindowLimit) {
        const trimResult = trimContextToFit(query, JSON.stringify([]), undefined, cachedContext, contextWindowLimit);
        contextTrimmed = trimResult.contextTrimmed;
        console.log(`⚠️ Context trimmed: ${trimResult.trimDetails}`);
        aiResponse = await generateResponse(query, [], trimResult.fileContext || undefined);
      } else {
        aiResponse = await generateResponse(query, [], cachedContext);
      }
    } else {
      console.log("❌ Cache miss. Searching the web...");
      webSearchResults = await searchWeb(query);
      console.log(`Found ${webSearchResults.length} results`);

      // Pre-flight context window check
      const webResultsStr = JSON.stringify(webSearchResults);
      const estimated = estimateContextTokens(query, webResultsStr);
      if (estimated > contextWindowLimit) {
        const trimResult = trimContextToFit(query, webResultsStr, undefined, undefined, contextWindowLimit);
        contextTrimmed = trimResult.contextTrimmed;
        console.log(`⚠️ Context trimmed: ${trimResult.trimDetails}`);
        try { webSearchResults = JSON.parse(trimResult.webResults); } catch {}
      }

      // Step 2: Generate AI response
      console.log("Generating AI response...");
      aiResponse = await generateResponse(query, webSearchResults);
      console.log("Response generated");
      
      // Save to cache asynchronously
      saveToCache(query, aiResponse.answer, webSearchResults);
    }

    // Step 3: Use actual token count from API, fallback to estimate
    const tokensUsed = aiResponse.actualTokensUsed > 0
      ? aiResponse.actualTokensUsed
      : calculateRequestTokens(query, JSON.stringify(webSearchResults), aiResponse.answer);
    console.log(`Tokens used: ${tokensUsed} (${aiResponse.actualTokensUsed > 0 ? 'actual' : 'estimated'})`);

    // Step 4: Track token usage (daily)
    const tokenInfo = await trackTokenUsage(userId, tokensUsed);
    console.log(`Tokens remaining today: ${tokenInfo.tokensRemaining}`);

    // Step 5: Save to database
    try {
      await saveQuery({
        userId,
        query,
        answer: aiResponse.answer,
        followUps: aiResponse.followUps,
        sources: webSearchResults.map((r) => ({ title: r.title, url: r.url })),
      });
      console.log("Query saved to database");
    } catch (dbError) {
      console.error("Failed to save to database:", dbError);
    }

    // Format response
    const formattedResponse = `<ANSWER>${aiResponse.answer}</ANSWER><FOLLOW UP>${aiResponse.followUps.join("; ")}</FOLLOW UP><TOKENS>${tokenInfo.tokensRemaining} tokens remaining today</TOKENS>`;

    res.send(formattedResponse);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

// Create a new conversation
app.post("/conversations", async (req: Request, res: Response) => {
  try {
    const { userId, title } = req.body;

    const conversation = await createConversation({ userId, title });
    res.json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get all conversations for a user
app.get("/conversations/user/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const conversations = await getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get a specific conversation with all messages
app.get("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Send a message in a conversation (with AI response + optional file attachments)
app.post(
  "/conversations/:conversationId/messages",
  conversationUpload.array("files", 5),
  // After multer parses multipart body, restore userId from auth if needed
  (req: Request, _res: Response, next: any) => {
    const authReq = req as any;
    if (authReq.auth?.userId && !req.body.userId) {
      req.body.userId = authReq.auth.userId;
    }
    const fileCount = (authReq.files as any[])?.length ?? 0;
    console.log(`[messages] Incoming: message="${req.body.message?.slice(0, 50)}", files=${fileCount}, userId=${req.body.userId}`);
    next();
  },
  checkTokenLimit,
  async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const message = req.body.message as string;
    const userId = req.body.userId || (req as any).auth?.userId;
    const uploadedFiles = (req as any).files as any[] | undefined;

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    console.log(`Message in conversation ${conversationId}: ${message}`);

    // Check if conversation exists
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // ── Step 1: Analyse attached files (if any) ────────────────────────────
    let fileContext = "";
    const fileInfos: { name: string; type: string; url: string }[] = [];

    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log(`Analyzing ${uploadedFiles.length} attached file(s)...`);

      for (const file of uploadedFiles) {
        try {
          const analysis = await analyzeContent(file.path, file.mimetype);
          console.log(`  ✔ ${file.originalname}: ${analysis.wordCount} words via ${analysis.method}`);

          // Build context block for each file
          const truncatedText = analysis.text.length > 8000
            ? analysis.text.slice(0, 8000) + "\n[…content truncated…]"
            : analysis.text;

          fileContext += `\n### File: ${file.originalname}\n`;
          fileContext += `Type: ${analysis.fileType} (${analysis.detectedMime})\n`;
          fileContext += `Words: ${analysis.wordCount} | Characters: ${analysis.charCount}\n`;
          if (analysis.links.length > 0) {
            fileContext += `Links found: ${analysis.links.slice(0, 5).join(", ")}\n`;
          }
          fileContext += `\nContent:\n${truncatedText}\n`;

          // Persist the file in DB
          const fileBuffer = await fs.promises.readFile(file.path);
          const savedFile = await prisma.file.create({
            data: {
              userId: userId,
              name: file.originalname,
              mimeType: file.mimetype,
              data: fileBuffer,
            }
          });
          
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error("Error deleting temp file:", e);
          }

          fileInfos.push({ name: file.originalname, type: analysis.fileType, url: `/api/files/${savedFile.id}` });
        } catch (err) {
          console.error(`  ✖ Failed to analyze ${file.originalname}:`, err);
        }
      }
    }

    // ── Step 2: Build search query (incorporate file keywords if present) ──────
    let searchQuery = message;
    if (fileContext) {
      // Extract key terms from the file content to improve web search relevance
      const fileWords = fileContext
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .slice(0, 50); // Take first 50 meaningful words
      // Remove duplicates and common stop words
      const stopWords = new Set(["this", "that", "with", "from", "have", "been", "were", "will", "would", "could", "should", "their", "there", "they", "what", "when", "where", "which", "your", "about", "into", "more", "some", "than", "them", "then", "these", "those", "only", "other", "also", "just", "very", "file", "type", "words", "characters", "content", "links", "found"]);
      const uniqueKeywords = [...new Set(fileWords.map((w: string) => w.toLowerCase()))].filter((w: string) => !stopWords.has(w));
      const keywordsStr = uniqueKeywords.slice(0, 15).join(" ");
      if (keywordsStr) {
        searchQuery = `${message} ${keywordsStr}`;
        console.log(`[search] Enhanced query with file keywords: "${searchQuery.slice(0, 120)}..."`);
      }
    }

    // ── Context window limit ────────────────────────────────────────────────
    const reqTokenInfo = (req as any).tokenInfo;
    const contextWindowLimit = reqTokenInfo?.contextWindowLimit ?? 50000;
    let contextTrimmed = false;

    // ── Step 3: Check Semantic Cache ───────────────────────────────────────────
    console.log("Checking semantic cache...");
    const cacheMatch = await checkCache(searchQuery);
    let webSearchResults: any[] = [];
    let aiResponse: any;
    
    if (cacheMatch) {
      console.log("✅ Cache hit! Skipping web search.");
      webSearchResults = cacheMatch.sources;
      
      const cachedContext = `[CACHED INFORMATION FOUND]\nWe found this information in our database for a similar query: ${cacheMatch.response}`;
      let effectiveFileContext = fileContext ? fileContext + '\n\n' + cachedContext : cachedContext;

      // Pre-flight context window check
      const estimated = estimateContextTokens(message, JSON.stringify([]), undefined, effectiveFileContext);
      if (estimated > contextWindowLimit) {
        const trimResult = trimContextToFit(message, JSON.stringify([]), undefined, effectiveFileContext, contextWindowLimit);
        contextTrimmed = trimResult.contextTrimmed;
        effectiveFileContext = trimResult.fileContext || cachedContext;
        console.log(`⚠️ Context trimmed: ${trimResult.trimDetails}`);
      }
      
      aiResponse = await generateResponse(message, [], effectiveFileContext);
    } else {
      console.log("❌ Cache miss. Searching the web...");
      webSearchResults = await searchWeb(searchQuery);
      console.log(`Found ${webSearchResults.length} results`);

      // Pre-flight context window check
      const webResultsStr = JSON.stringify(webSearchResults);
      const estimated = estimateContextTokens(message, webResultsStr, undefined, fileContext || undefined);
      let effectiveFileContext = fileContext || undefined;
      if (estimated > contextWindowLimit) {
        const trimResult = trimContextToFit(message, webResultsStr, undefined, effectiveFileContext, contextWindowLimit);
        contextTrimmed = trimResult.contextTrimmed;
        effectiveFileContext = trimResult.fileContext || undefined;
        try { webSearchResults = JSON.parse(trimResult.webResults); } catch {}
        console.log(`⚠️ Context trimmed: ${trimResult.trimDetails}`);
      }

      // ── Step 4: Generate AI response (with file context if present) ────────
      console.log("Generating AI response...");
      aiResponse = await generateResponse(
        message,
        webSearchResults,
        effectiveFileContext
      );
      console.log("Response generated");
      
      // Save the new response to cache asynchronously
      saveToCache(searchQuery, aiResponse.answer, webSearchResults);
    }

    // ── Step 4: Token accounting (use actual API count, fallback to estimate) ──
    const tokensUsed = aiResponse.actualTokensUsed > 0
      ? aiResponse.actualTokensUsed
      : calculateRequestTokens(message + (fileContext || ""), JSON.stringify(webSearchResults), aiResponse.answer);
    console.log(`Tokens used: ${tokensUsed} (${aiResponse.actualTokensUsed > 0 ? 'actual' : 'estimated'})`);

    const tokenInfo = await trackTokenUsage(userId, tokensUsed);
    console.log(`Tokens remaining today: ${tokenInfo.tokensRemaining}`);

    // ── Step 5: Save messages to conversation ──────────────────────────────
    const sources = webSearchResults.map((r) => ({ title: r.title, url: r.url }));
    const { userMsg, assistantMsg } = await addMessageToConversation(
      conversationId,
      message,
      aiResponse.answer,
      sources,
      aiResponse.followUps
    );

    // Auto-generate title if this is the first message
    if (conversation.messages.length === 0) {
      await generateConversationTitle(conversationId, message);
    }

    res.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      sources,
      followUps: aiResponse.followUps,
      attachments: fileInfos,
      contextTrimmed,
      tokenUsage: {
        tokensUsedToday: tokenInfo.tokensUsedToday,
        tokensRemaining: tokenInfo.tokensRemaining,
        dailyLimit: tokenInfo.dailyLimit,
        contextWindowLimit: tokenInfo.contextWindowLimit,
        requestCount: tokenInfo.requestCount,
        resetTime: tokenInfo.resetTime,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Update conversation title
app.patch("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { title } = req.body;

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const conversation = await updateConversationTitle(conversationId, title);
    res.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

// Delete a conversation
app.delete("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    await deleteConversation(conversationId);
    res.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// ============================================
// USER ENDPOINTS
// ============================================

// Get user profile with stats
app.get("/users/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const [user, stats] = await Promise.all([
      getUserById(userId),
      getUserStats(userId),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ ...user, stats });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create or get user (for auth)
app.post("/users", async (req: Request, res: Response) => {
  try {
    const { email, provider, name, profileImage } = req.body;

    if (!email || !provider || !name) {
      res.status(400).json({ error: "email, provider, and name are required" });
      return;
    }

    const user = await findOrCreateUser({ email, provider, name, profileImage });
    res.json(user);
  } catch (error) {
    console.error("Error creating/finding user:", error);
    res.status(500).json({ error: "Failed to create/find user" });
  }
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "Purplexity server is running" });
});

// Database health check
app.get("/health/db", async (req: Request, res: Response) => {
  const isConnected = await testDatabaseConnection();
  res.json({
    status: isConnected ? "ok" : "error",
    database: isConnected ? "connected" : "disconnected",
  });
});

// Get user's token usage for today
app.get("/tokens/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const tokenInfo = await getTodayTokenUsage(userId);
    res.json(tokenInfo);
  } catch (error) {
    console.error("Error fetching token usage:", error);
    res.status(500).json({ error: "Failed to fetch token usage" });
  }
});

// Get user's token usage history
app.get("/tokens/:userId/history", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const days = parseInt(req.query.days as string) || 7;
    const history = await getUserTokenHistory(userId, days);
    res.json(history);
  } catch (error) {
    console.error("Error fetching token history:", error);
    res.status(500).json({ error: "Failed to fetch token history" });
  }
});

// ============================================
// GUEST & TEST USER ENDPOINTS
// ============================================

// Create a guest user
app.post("/users/guest", async (req: Request, res: Response) => {
  try {
    const { dailyTokenLimit, expiresInHours } = req.body;
    const guest = await createGuestUser({ dailyTokenLimit, expiresInHours });
    const { token } = signSession({ id: guest.userId, email: guest.email });
    res.json({ ...guest, token });
  } catch (error) {
    console.error("Error creating guest user:", error);
    res.status(500).json({ error: "Failed to create guest user" });
  }
});

// Create a test user
app.post("/users/test", async (req: Request, res: Response) => {
  try {
    const { dailyTokenLimit } = req.body;
    const testUser = await createTestUser({ dailyTokenLimit });
    res.json(testUser);
  } catch (error) {
    console.error("Error creating test user:", error);
    res.status(500).json({ error: "Failed to create test user" });
  }
});

// Get all guest users
app.get("/users/guests", async (req: Request, res: Response) => {
  try {
    const guests = await getAllGuestUsers();
    res.json(guests);
  } catch (error) {
    console.error("Error fetching guest users:", error);
    res.status(500).json({ error: "Failed to fetch guest users" });
  }
});

// Get all test users
app.get("/users/tests", async (req: Request, res: Response) => {
  try {
    const tests = await getAllTestUsers();
    res.json(tests);
  } catch (error) {
    console.error("Error fetching test users:", error);
    res.status(500).json({ error: "Failed to fetch test users" });
  }
});

// Delete a temporary user (guest or test)
app.delete("/users/temp/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const result = await deleteTempUser(userId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting temp user:", error);
    res.status(500).json({
      error: "Failed to delete temp user",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Cleanup expired guest users
app.post("/users/cleanup", async (req: Request, res: Response) => {
  try {
    const result = await cleanupExpiredGuests();
    res.json(result);
  } catch (error) {
    console.error("Error cleaning up guest users:", error);
    res.status(500).json({ error: "Failed to cleanup guest users" });
  }
});

// SPA catch-all – serve index.html for any unmatched routes
// Must be AFTER all API routes so they aren't intercepted
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT;

// Prevent Bun from exiting prematurely due to Prisma's query engine dropping event loop handles
setInterval(() => {}, 1 << 30);

// Startup: prune expired sessions, then repeat every 24 hours
pruneExpiredSessions().then(() => console.log("🧹 Expired sessions pruned on startup")).catch(() => {});
setInterval(() => { pruneExpiredSessions().catch(() => {}); }, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Purplexity server running on http://localhost:${PORT}`);
  console.log(`\n📍 Endpoints:`);
  console.log(`   POST   /purplexity_ask - Legacy single query`);
  console.log(`   POST   /conversations - Create conversation`);
  console.log(`   GET    /conversations/user/:userId - Get user conversations`);
  console.log(`   GET    /conversations/:id - Get conversation with messages`);
  console.log(`   POST   /conversations/:id/messages - Send message`);
  console.log(`   PATCH  /conversations/:id - Update conversation title`);
  console.log(`   DELETE /conversations/:id - Delete conversation`);
  console.log(`   GET    /users/:userId - Get user profile`);
  console.log(`   POST   /users - Create/find user`);
  console.log(`   POST   /users/guest - Create guest user`);
  console.log(`   POST   /users/test - Create test user`);
  console.log(`   GET    /users/guests - Get all guest users`);
  console.log(`   GET    /users/tests - Get all test users`);
  console.log(`   DELETE /users/temp/:userId - Delete temp user`);
  console.log(`   POST   /users/cleanup - Cleanup expired guests`);
  console.log(`   GET    /tokens/:userId - Get today's token usage`);
  console.log(`   GET    /tokens/:userId/history - Get token usage history`);
  console.log(`   GET    /health - Health check`);
  console.log(`   GET    /health/db - Database health check\n`);
});
