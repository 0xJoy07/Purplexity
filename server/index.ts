import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import { searchWeb } from "./services/webSearch.service";
import { generateResponse } from "./services/ai.service";

const app = express();
app.use(express.json());

app.post("/purplexity_ask", async (req: Request, res: Response) => {
  try {
    // Get the query from the User
    const query: string = req.body.query;

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    console.log(`Query received: ${query}`);

    // Step 1: Web search to gather resources
    console.log("Searching the web...");
    const webSearchResults = await searchWeb(query);
    console.log(`Found ${webSearchResults.length} results`);

    // Step 2: Generate AI response
    console.log("Generating AI response...");
    const aiResponse = await generateResponse(query, webSearchResults);
    console.log("Response generated");

    // Format response: <ANSWER>...</ANSWER><FOLLOW UP>...</FOLLOW UP>
    const formattedResponse = `<ANSWER>${aiResponse.answer}</ANSWER><FOLLOW UP>${aiResponse.followUps.join("; ")}</FOLLOW UP>`;

    // Send response
    res.send(formattedResponse);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "Purplexity server is running" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Purplexity server running on http://localhost:${PORT}`);
  console.log(`Test endpoint: POST http://localhost:${PORT}/purplexity_ask`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
})
