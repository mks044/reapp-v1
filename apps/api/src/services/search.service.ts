import { logger } from "../lib/logger.js";
import { runTavilySearch } from "./tavily.service.js";
import type { SearchResultItem } from "../types/search.types.js";

export const runStubSearch = async (query: string): Promise<SearchResultItem[]> => {
  logger.debug(
    {
      query
    },
    "runStubSearch called"
  );

  const results = await runTavilySearch(query);

  logger.info(
    {
      query,
      resultCount: results.length
    },
    "Search service completed"
  );

  return results;
};
