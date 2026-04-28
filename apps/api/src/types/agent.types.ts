export interface ResearchPlanRequestBody {
  task: string;
}

export interface ResearchPlanItem {
  order: number;
  query: string;
  estimatedCost: string;
}

export interface ResearchPlanResponseBody {
  ok: true;
  task: string;
  totalQueries: number;
  totalEstimatedCost: string;
  currency: "USDC";
  network: "Stellar";
  plan: ResearchPlanItem[];
}

export interface ResearchExecutionItem {
  order: number;
  query: string;
  status: "queued" | "running" | "completed" | "failed";
  sessionId: string | null;
  actualCost: string;
  resultCount: number;
  paymentResponseHeader: string | null;
  paymentSettleResponse?: unknown;
  transactionHash?: string | null;
  transactionUrl?: string | null;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    rank: number;
  }>;
  error?: string;
}

export interface ResearchExecutionResponseBody {
  ok: true;
  agentRunId: string;
  task: string;
  status: "completed";
  totalQueries: number;
  completedQueries: number;
  totalSpend: string;
  currency: "USDC";
  network: "Stellar";
  receiptsStored: number;
  runs: ResearchExecutionItem[];
  finalReport: string;
}

export interface AgentRunStatusQueryRow {
  id: string;
  agent_run_id: string;
  query_order: number;
  query: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_cost: string | null;
  actual_cost: string | null;
  session_id: string | null;
  payment_response_header: string | null;
  payment_settle_response: unknown | null;
  transaction_hash: string | null;
  transaction_url: string | null;
  results_json: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    rank: number;
  }> | null;
  error: string | null;
  completed_at: string | null;
  created_at?: string;
}

export interface AgentRunStatusResponseBody {
  ok: true;
  agentRunId: string;
  task: string;
  status: "planned" | "running" | "completed" | "failed";
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  queuedQueries: number;
  runningQueries: number;
  totalSpend: string;
  currency: string;
  network: string;
  finalReport: string | null;
  queries: AgentRunStatusQueryRow[];
}
