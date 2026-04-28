export interface SearchRequestBody {
  query: string;
  sessionId?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: "web";
  rank: number;
}

export interface SearchResponseBody {
  ok: true;
  query: string;
  sessionId: string | null;
  results: SearchResultItem[];
}
