import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import type { ResearchPlanItem } from "../types/agent.types.js";
import type { SearchResultItem } from "../types/search.types.js";

export const createAgentRunQuery = async (input: {
  agentRunId: string;
  queryOrder: number;
  query: string;
  estimatedCost: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_run_queries")
    .insert({
      agent_run_id: input.agentRunId,
      query_order: input.queryOrder,
      query: input.query,
      status: "queued",
      estimated_cost: input.estimatedCost
    });

  if (error) {
    logger.error({ error, input }, "Failed to create agent run query");
    throw new Error(`Failed to create agent run query: ${error.message}`);
  }
};

export const createAgentRun = async (input: {
  task: string;
  totalQueries: number;
  totalSpend: string;
  currency: string;
  network: string;
  plan: ResearchPlanItem[];
  planPrice?: string;
  reportPrice?: string;
  searchSpend?: string;
  llmSpend?: string;
}) => {
  logger.debug(
    {
      task: input.task,
      totalQueries: input.totalQueries,
      totalSpend: input.totalSpend
    },
    "Creating agent run"
  );

  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      task: input.task,
      status: "planned",
      total_queries: input.totalQueries,
      total_spend: input.totalSpend,
      currency: input.currency,
      network: input.network,
      plan_price: input.planPrice ?? "0.00",
      report_price: input.reportPrice ?? "0.00",
      search_spend: input.searchSpend ?? "0.00",
      llm_spend: input.llmSpend ?? "0.00"
    })
    .select("*")
    .single();

  if (runError) {
    logger.error({ error: runError }, "Failed to create agent run");
    throw new Error(`Failed to create agent run: ${runError.message}`);
  }

  for (const item of input.plan) {
    await createAgentRunQuery({
      agentRunId: run.id,
      queryOrder: item.order,
      query: item.query,
      estimatedCost: item.estimatedCost
    });
  }

  logger.info(
    {
      agentRunId: run.id,
      totalQueries: input.totalQueries
    },
    "Agent run created successfully"
  );

  return run;
};

export const getAgentRunById = async (agentRunId: string) => {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", agentRunId)
    .single();

  if (error) {
    logger.error({ error, agentRunId }, "Failed to fetch agent run");
    throw new Error(`Failed to fetch agent run: ${error.message}`);
  }

  return data;
};

export const getAgentRunQueries = async (agentRunId: string) => {
  const { data, error } = await supabase
    .from("agent_run_queries")
    .select("*")
    .eq("agent_run_id", agentRunId)
    .order("query_order", { ascending: true });

  if (error) {
    logger.error({ error, agentRunId }, "Failed to fetch agent run queries");
    throw new Error(`Failed to fetch agent run queries: ${error.message}`);
  }

  return data ?? [];
};

export const markAgentRunInProgress = async (agentRunId: string): Promise<void> => {
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status: "running"
    })
    .eq("id", agentRunId);

  if (error) {
    logger.error({ error, agentRunId }, "Failed to mark agent run in progress");
    throw new Error(`Failed to mark agent run in progress: ${error.message}`);
  }
};

export const startAgentRunQuery = async (input: {
  agentRunId: string;
  queryOrder: number;
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_run_queries")
    .update({
      status: "running"
    })
    .eq("agent_run_id", input.agentRunId)
    .eq("query_order", input.queryOrder);

  if (error) {
    logger.error({ error, input }, "Failed to mark agent run query as running");
    throw new Error(`Failed to mark agent run query as running: ${error.message}`);
  }
};

export const completeAgentRunQuery = async (input: {
  agentRunId: string;
  queryOrder: number;
  sessionId: string;
  actualCost: string;
  paymentResponseHeader: string | null;
  paymentSettleResponse?: unknown;
  transactionHash?: string | null;
  transactionUrl?: string | null;
  results: SearchResultItem[];
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_run_queries")
    .update({
      status: "completed",
      session_id: input.sessionId,
      actual_cost: input.actualCost,
      payment_response_header: input.paymentResponseHeader,
      payment_settle_response: input.paymentSettleResponse ?? null,
      transaction_hash: input.transactionHash ?? null,
      transaction_url: input.transactionUrl ?? null,
      results_json: input.results,
      completed_at: new Date().toISOString(),
      error: null
    })
    .eq("agent_run_id", input.agentRunId)
    .eq("query_order", input.queryOrder);

  if (error) {
    logger.error({ error, input }, "Failed to complete agent run query");
    throw new Error(`Failed to complete agent run query: ${error.message}`);
  }
};

export const failAgentRunQuery = async (input: {
  agentRunId: string;
  queryOrder: number;
  errorMessage?: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_run_queries")
    .update({
      status: "failed",
      error: input.errorMessage ?? "Unknown error",
      completed_at: new Date().toISOString()
    })
    .eq("agent_run_id", input.agentRunId)
    .eq("query_order", input.queryOrder);

  if (error) {
    logger.error({ error, input }, "Failed to fail agent run query");
    throw new Error(`Failed to fail agent run query: ${error.message}`);
  }
};

export const finalizeAgentRun = async (input: {
  agentRunId: string;
  totalSpend: string;
  searchSpend: string;
  llmSpend: string;
  planPrice: string;
  reportPrice: string;
  finalReport: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status: "completed",
      total_spend: input.totalSpend,
      search_spend: input.searchSpend,
      llm_spend: input.llmSpend,
      plan_price: input.planPrice,
      report_price: input.reportPrice,
      final_report: input.finalReport,
      completed_at: new Date().toISOString()
    })
    .eq("id", input.agentRunId);

  if (error) {
    logger.error({ error, input }, "Failed to finalize agent run");
    throw new Error(`Failed to finalize agent run: ${error.message}`);
  }
};

export const failAgentRun = async (input: {
  agentRunId: string;
  finalReport?: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      final_report: input.finalReport ?? null,
      completed_at: new Date().toISOString()
    })
    .eq("id", input.agentRunId);

  if (error) {
    logger.error({ error, input }, "Failed to fail agent run");
    throw new Error(`Failed to fail agent run: ${error.message}`);
  }
};
