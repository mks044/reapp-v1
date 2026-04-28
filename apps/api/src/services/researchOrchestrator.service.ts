import { PRICING } from "../constants/pricing.js";
import { createSearchRequestRecord } from "./searchRequest.service.js";
import {
  createAgentRunQuery,
  failAgentRun,
  failAgentRunQuery,
  finalizeAgentRun,
  markAgentRunInProgress,
  startAgentRunQuery,
  completeAgentRunQuery
} from "./agentRun.service.js";
import {
  evaluateSearchResultsWithGemini,
  generateFinalReportWithGemini
} from "./gemini.service.js";
import { runPaidAgentQuery } from "./agentPaidQuery.service.js";
import type {
  ResearchExecutionItem,
  ResearchPlanItem
} from "../types/agent.types.js";

const agentPlanPrice = process.env.AGENT_PLAN_PRICE_USDC ?? "0.01";
const agentEvaluationPrice = process.env.AGENT_EVAL_PRICE_USDC ?? "0.00";
const agentReportPrice = process.env.AGENT_REPORT_PRICE_USDC ?? "0.01";
const maxRefinements = 2;

const executeSingleQuery = async (input: {
  agentRunId: string;
  order: number;
  query: string;
  persistRunStatus: boolean;
}): Promise<ResearchExecutionItem> => {
  if (input.persistRunStatus) {
    await startAgentRunQuery({
      agentRunId: input.agentRunId,
      queryOrder: input.order
    });
  }

  try {
    const paidQuery = await runPaidAgentQuery(input.query);

    if (!paidQuery.ok) {
      throw new Error(`Paid agent query failed with status ${paidQuery.status}`);
    }

    await createSearchRequestRecord({
      sessionId: paidQuery.sessionId,
      query: input.query,
      resultCount: paidQuery.results.length,
      priceCharged: PRICING.pricePerQuery,
      currency: PRICING.currency,
      results: paidQuery.results,
      paid: true,
      paymentResponseHeader: paidQuery.paymentResponseHeader,
      paymentSettleResponse: paidQuery.paymentSettleResponse,
      transactionHash: paidQuery.transactionHash,
      transactionUrl: paidQuery.transactionUrl
    });

    if (input.persistRunStatus) {
      await completeAgentRunQuery({
        agentRunId: input.agentRunId,
        queryOrder: input.order,
        sessionId: paidQuery.sessionId ?? `missing-session-${input.order}`,
        actualCost: PRICING.pricePerQuery,
        paymentResponseHeader: paidQuery.paymentResponseHeader,
        paymentSettleResponse: paidQuery.paymentSettleResponse,
        transactionHash: paidQuery.transactionHash,
        transactionUrl: paidQuery.transactionUrl,
        results: paidQuery.results
      });
    }

    return {
      order: input.order,
      query: input.query,
      status: "completed",
      sessionId: paidQuery.sessionId,
      actualCost: PRICING.pricePerQuery,
      resultCount: paidQuery.results.length,
      paymentResponseHeader: paidQuery.paymentResponseHeader,
      paymentSettleResponse: paidQuery.paymentSettleResponse,
      transactionHash: paidQuery.transactionHash,
      transactionUrl: paidQuery.transactionUrl,
      results: paidQuery.results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (input.persistRunStatus) {
      await failAgentRunQuery({
        agentRunId: input.agentRunId,
        queryOrder: input.order,
        errorMessage
      });
    }

    return {
      order: input.order,
      query: input.query,
      status: "failed",
      sessionId: null,
      actualCost: "0.00",
      resultCount: 0,
      paymentResponseHeader: null,
      paymentSettleResponse: null,
      transactionHash: null,
      transactionUrl: null,
      results: [],
      error: errorMessage
    };
  }
};

const ensureRefinementQueryRecord = async (input: {
  agentRunId: string;
  order: number;
  query: string;
}): Promise<void> => {
  await createAgentRunQuery({
    agentRunId: input.agentRunId,
    queryOrder: input.order,
    query: input.query,
    estimatedCost: PRICING.pricePerQuery
  });
};

export const runResearchOrchestrator = async (input: {
  agentRunId: string;
  task: string;
  plan: ResearchPlanItem[];
}): Promise<{
  totalSpend: string;
  searchSpend: string;
  llmSpend: string;
  receiptsStored: number;
  runs: ResearchExecutionItem[];
  finalReport: string;
}> => {
  await markAgentRunInProgress(input.agentRunId);

  const allRuns: ResearchExecutionItem[] = [];
  let searchSpend = 0;
  let receiptsStored = 0;

  try {
    for (const item of input.plan) {
      const run = await executeSingleQuery({
        agentRunId: input.agentRunId,
        order: item.order,
        query: item.query,
        persistRunStatus: true
      });

      if (run.status === "completed") {
        searchSpend += Number(PRICING.pricePerQuery);
        if (run.paymentResponseHeader) {
          receiptsStored += 1;
        }
      }

      allRuns.push(run);
    }

    const completedInitialRuns = allRuns.filter((run) => run.status === "completed");

    const evaluation = await evaluateSearchResultsWithGemini({
      task: input.task,
      runs: completedInitialRuns.map((run) => ({
        order: run.order,
        query: run.query,
        resultCount: run.resultCount,
        results: run.results
      }))
    });

    if (evaluation.needsRefinement) {
      const weakSections = evaluation.weakSections.slice(0, maxRefinements);
      let nextOrder = input.plan.length + 1;

      for (const weakSection of weakSections) {
        await ensureRefinementQueryRecord({
          agentRunId: input.agentRunId,
          order: nextOrder,
          query: weakSection.refinedQuery
        });

        const refinementRun = await executeSingleQuery({
          agentRunId: input.agentRunId,
          order: nextOrder,
          query: weakSection.refinedQuery,
          persistRunStatus: true
        });

        if (refinementRun.status === "completed") {
          searchSpend += Number(PRICING.pricePerQuery);
          if (refinementRun.paymentResponseHeader) {
            receiptsStored += 1;
          }
        }

        allRuns.push({
          ...refinementRun,
          order: nextOrder
        });

        nextOrder += 1;
      }
    }

    const completedRuns = allRuns.filter((run) => run.status === "completed");

    const finalReport = await generateFinalReportWithGemini({
      task: input.task,
      runs: completedRuns.map((run) => ({
        order: run.order,
        query: run.query,
        resultCount: run.resultCount,
        results: run.results
      }))
    });

    const llmSpend = (
      Number(agentPlanPrice) +
      Number(agentEvaluationPrice) +
      Number(agentReportPrice)
    ).toFixed(2);

    const totalSpend = (searchSpend + Number(llmSpend)).toFixed(2);

    await finalizeAgentRun({
      agentRunId: input.agentRunId,
      totalSpend,
      searchSpend: searchSpend.toFixed(2),
      llmSpend,
      planPrice: agentPlanPrice,
      reportPrice: agentReportPrice,
      finalReport
    });

    return {
      totalSpend,
      searchSpend: searchSpend.toFixed(2),
      llmSpend,
      receiptsStored,
      runs: allRuns,
      finalReport
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await failAgentRun({
      agentRunId: input.agentRunId,
      finalReport: errorMessage
    });

    throw error;
  }
};
