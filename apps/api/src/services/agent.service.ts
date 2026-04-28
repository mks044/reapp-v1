import { PRICING } from "../constants/pricing.js";
import { generateResearchPlanWithGemini } from "./gemini.service.js";
import { runResearchOrchestrator } from "./researchOrchestrator.service.js";
import type {
  ResearchExecutionItem,
  ResearchPlanItem
} from "../types/agent.types.js";

const agentPlanPrice = process.env.AGENT_PLAN_PRICE_USDC ?? "0.01";
const agentReportPrice = process.env.AGENT_REPORT_PRICE_USDC ?? "0.01";

export const buildResearchPlan = async (task: string): Promise<{
  task: string;
  totalQueries: number;
  totalEstimatedCost: string;
  currency: "USDC";
  network: "Stellar";
  plan: ResearchPlanItem[];
  planPrice: string;
  reportPrice: string;
}> => {
  const normalizedTask = task.trim();

  const geminiPlan = await generateResearchPlanWithGemini(normalizedTask);

  const plan: ResearchPlanItem[] = geminiPlan.map((item) => ({
    order: item.order,
    query: item.query,
    estimatedCost: PRICING.pricePerQuery
  }));

  const totalEstimatedCost = (
    Number(agentPlanPrice) +
    Number(agentReportPrice) +
    Number(PRICING.pricePerQuery) * plan.length
  ).toFixed(2);

  return {
    task: normalizedTask,
    totalQueries: plan.length,
    totalEstimatedCost,
    currency: PRICING.currency,
    network: PRICING.network,
    plan,
    planPrice: agentPlanPrice,
    reportPrice: agentReportPrice
  };
};

export const executeResearchPlan = async (input: {
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
  return runResearchOrchestrator(input);
};
