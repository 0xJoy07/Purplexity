import express from "express";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import "dotenv/config";
import { searchWeb } from "./services/webSearch.service";
import { generateResponse } from "./services/ai.service";
import { testDatabaseConnection } from "./config/db.config";
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
import { requireAuth } from "./middleware/auth.middleware";
import cors from "cors";
import { signSession } from "./services/auth.service";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use("/conversations", requireAuth);
app.use("/tokens", requireAuth);

// Test database connection on startup
testDatabaseConnection();

// ============================================
// LEGACY ENDPOINT - Single Query (Standalone)
// ============================================
app.post("/purplexity_ask", requireAuth, checkTokenLimit, async (req: Request, res: Response) => {
  try {
    const query: string = req.body.query;
    const userId: string = req.body.userId

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    console.log(`Query received: ${query}`);

    // Step 1: Web search
    console.log("Searching the web...");
    const webSearchResults = await searchWeb(query);
    console.log(`Found ${webSearchResults.length} results`);

    // Step 2: Generate AI response
    console.log("Generating AI response...");
    const aiResponse = await generateResponse(query, webSearchResults);
    console.log("Response generated");

    // Step 3: Calculate tokens used
    const webResultsText = JSON.stringify(webSearchResults);
    const tokensUsed = calculateRequestTokens(query, webResultsText, aiResponse.answer);
    console.log(`Tokens used: ${tokensUsed}`);

    // Step 4: Track token usage
    const tokenInfo = await trackTokenUsage(userId, tokensUsed);
    console.log(`Tokens remaining: ${tokenInfo.tokensRemaining}`);

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

    // Format response: <ANSWER>...</ANSWER><FOLLOW UP>...</FOLLOW UP><TOKENS>...</TOKENS>
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

// Send a message in a conversation (with AI response)
app.post("/conversations/:conversationId/messages", checkTokenLimit, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { message } = req.body;
    const userId = req.body.userId

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

    // Web search
    console.log("Searching the web...");
    const webSearchResults = await searchWeb(message);
    console.log(`Found ${webSearchResults.length} results`);

    // Generate AI response
    console.log("Generating AI response...");
    const aiResponse = await generateResponse(message, webSearchResults);
    console.log("Response generated");

    // Calculate tokens used
    const webResultsText = JSON.stringify(webSearchResults);
    const tokensUsed = calculateRequestTokens(message, webResultsText, aiResponse.answer);
    console.log(`Tokens used: ${tokensUsed}`);

    // Track token usage
    const tokenInfo = await trackTokenUsage(userId, tokensUsed);
    console.log(`Tokens remaining: ${tokenInfo.tokensRemaining}`);

    // Save both messages to conversation
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
      tokenUsage: {
        tokensUsed,
        tokensRemaining: tokenInfo.tokensRemaining,
        dailyLimit: tokenInfo.dailyLimit,
        requestCount: tokenInfo.requestCount,
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
    const token = signSession({ id: guest.userId, email: guest.email });
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

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT;

// Prevent Bun from exiting prematurely due to Prisma's query engine dropping event loop handles
setInterval(() => {}, 1 << 30);

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
