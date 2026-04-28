import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import type { SearchResultItem } from "../types/search.types.js";

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

export const runTavilySearch = async (query: string): Promise<SearchResultItem[]> => {
  logger.debug(
    {
      query,
      hasApiKey: Boolean(env.TAVILY_API_KEY)
    },
    "runTavilySearch called"
  );

  if (!env.TAVILY_API_KEY) {
    logger.warn("TAVILY_API_KEY is not set, falling back to stubbed Tavily results");

    return [
      {
        title: "Stub Tavily result 1",
        url: "https://example.com/tavily-result-1",
        snippet: `This is a Tavily fallback result for query: ${query}`,
        source: "web",
        rank: 1
      },
      {
        title: "Stub Tavily result 2",
        url: "https://example.com/tavily-result-2",
        snippet: `This is another Tavily fallback result for query: ${query}`,
        source: "web",
        rank: 2
      }
    ];
  }

  logger.info(
    {
      query
    },
    "Calling Tavily search API"
  );

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    logger.error(
      {
        status: response.status,
        statusText: response.statusText,
        errorText
      },
      "Tavily API request failed"
    );

    throw new Error(`Tavily API request failed with status ${response.status}`);
  }

  const json = (await response.json()) as TavilySearchResponse;

  const results: SearchResultItem[] = (json.results ?? []).map((item, index) => ({
    title: item.title ?? "Untitled result",
    url: item.url ?? "",
    snippet: item.content ?? "",
    source: "web",
    rank: index + 1
  }));

  logger.info(
    {
      query,
      resultCount: results.length
    },
    "Tavily search completed successfully"
  );

  return results;
};
