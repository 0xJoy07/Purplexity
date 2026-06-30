import express from "express";
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

const app = express();
app.use(express.json());

// Test database connection on startup
testDatabaseConnection();

// ============================================
// LEGACY ENDPOINT - Single Query (Standalone)
// ============================================
app.post("/purplexity_ask", async (req: Request, res: Response) => {
  try {
    const query: string = req.body.query;
    const userId: string | undefined = req.body.userId;

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

    // Step 3: Save to database if userId is provided
    if (userId) {
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
    }

    // Format response: <ANSWER>...</ANSWER><FOLLOW UP>...</FOLLOW UP>
    const formattedResponse = `<ANSWER>${aiResponse.answer}</ANSWER><FOLLOW UP>${aiResponse.followUps.join("; ")}</FOLLOW UP>`;

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

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

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
app.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { message } = req.body;

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

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

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
  console.log(`   GET    /health - Health check`);
  console.log(`   GET    /health/db - Database health check\n`);
});
