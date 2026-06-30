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
  webSearchResults: WebSearchResult[]
): Promise<AIResponse> {
  // Context engineering
  const prompt = PROMPT_TEMPLATE
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
    parsedJson = JSON.parse(raw);
  } catch (error) {
    console.error("❌ Failed to parse JSON:", raw);
    throw new Error("LLM returned invalid JSON");
  }

  const result = schema.parse(parsedJson);

  return {
    answer: result.answer,
    followUps: result.followUps,
  };
}
