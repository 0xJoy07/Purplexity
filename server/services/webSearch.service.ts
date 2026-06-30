import { tavily } from "@tavily/core";

const client = tavily({
  apiKey: process.env.TAVILY_API_KEY!,
});

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const response = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 10,
  });

  return response.results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    score: result.score,
  }));
}
