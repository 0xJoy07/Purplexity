import OpenAI from "openai";
import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "../prompt";
import type { WebSearchResult } from "./webSearch.service";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const schema = z.object({
  followUps: z.array(z.string()),
  answer: z.string(),
});

export interface AIResponse {
  answer: string;
  followUps: string[];
}

export async function generateResponse(
  query: string,
  webSearchResults: WebSearchResult[],
  fileContext?: string
): Promise<AIResponse> {
  // Context engineering
  const fileBlock = fileContext
    ? `## Uploaded file content\n${fileContext}\n`
    : "";

  const prompt = PROMPT_TEMPLATE
    .replace("{{FILE_CONTEXT}}", fileBlock)
    .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResults))
    .replace("{{USER_QUERY}}", query);

  // Hit the LLM with a model that supports JSON mode reliably
  const completion = await openrouter.chat.completions.create({
    model: "openrouter/auto",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_object", // Changed from json_schema to json_object for broader compatibility
    },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  
  console.log("🔍 Raw LLM response:", raw);
  
  let parsedJson;
  try {
    // Attempt direct parse first
    parsedJson = JSON.parse(raw);
  } catch (error) {
    // If direct parse fails, try extracting from markdown blocks
    const match = raw.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) {
      try {
        parsedJson = JSON.parse(match[1]);
      } catch (e) {
        console.error("❌ Failed to parse JSON from markdown block:", match[1]);
      }
    } else {
      console.error("❌ Failed to parse JSON entirely:", raw);
    }
  }

  try {
    if (!parsedJson) throw new Error("No JSON parsed");
    const result = schema.parse(parsedJson);
    return {
      answer: result.answer,
      followUps: result.followUps,
    };
  } catch (err) {
    console.error("❌ Schema validation or parse failed, falling back.", err);
    return {
      answer: "Sorry, I encountered an error while processing the response. Please try asking again.",
      followUps: []
    };
  }
}
