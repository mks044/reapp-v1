import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";
import { buildResearchPlan, executeResearchPlan } from "../services/agent.service.js";
import {
  createAgentRun,
  getAgentRunById,
  getAgentRunQueries
} from "../services/agentRun.service.js";
import type {
  AgentRunStatusResponseBody,
  ResearchExecutionResponseBody,
  ResearchPlanRequestBody,
  ResearchPlanResponseBody
} from "../types/agent.types.js";

export const postResearchPlan = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ResearchPlanRequestBody>;
  const task = typeof body?.task === "string" ? body.task.trim() : "";

  logger.debug({ task }, "Agent research plan controller called");

  if (!task) {
    res.status(400).json(errorResponse("task is required"));
    return;
  }

  const plan = await buildResearchPlan(task);

  const agentRun = await createAgentRun({
    task: plan.task,
    totalQueries: plan.totalQueries,
    totalSpend: plan.totalEstimatedCost,
    currency: plan.currency,
    network: plan.network,
    plan: plan.plan,
    planPrice: plan.planPrice,
    reportPrice: plan.reportPrice,
    searchSpend: "0.00",
    llmSpend: (Number(plan.planPrice) + Number(plan.reportPrice)).toFixed(2)
  });

  const response: ResearchPlanResponseBody & {
    agentRunId: string;
    planPrice: string;
    reportPrice: string;
    searchPricePerQuery: string;
  } = {
    ok: true,
    task: plan.task,
    totalQueries: plan.totalQueries,
    totalEstimatedCost: plan.totalEstimatedCost,
    currency: plan.currency,
    network: plan.network,
    plan: plan.plan,
    agentRunId: agentRun.id,
    planPrice: plan.planPrice,
    reportPrice: plan.reportPrice,
    searchPricePerQuery: "0.01"
  };

  res.status(200).json(okResponse(response));
};

export const postResearch = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ResearchPlanRequestBody>;
  const task = typeof body?.task === "string" ? body.task.trim() : "";

  logger.debug({ task }, "Agent research controller called");

  if (!task) {
    res.status(400).json(errorResponse("task is required"));
    return;
  }

  const plan = await buildResearchPlan(task);

  const agentRun = await createAgentRun({
    task: plan.task,
    totalQueries: plan.totalQueries,
    totalSpend: "0.00",
    currency: plan.currency,
    network: plan.network,
    plan: plan.plan,
    planPrice: plan.planPrice,
    reportPrice: plan.reportPrice,
    searchSpend: "0.00",
    llmSpend: (Number(plan.planPrice) + Number(plan.reportPrice)).toFixed(2)
  });

  const execution = await executeResearchPlan({
    agentRunId: agentRun.id,
    task: plan.task,
    plan: plan.plan
  });

  const response: ResearchExecutionResponseBody & {
    planPrice: string;
    reportPrice: string;
    searchSpend: string;
    llmSpend: string;
  } = {
    ok: true,
    agentRunId: agentRun.id,
    task: plan.task,
    status: "completed",
    totalQueries: plan.totalQueries,
    completedQueries: execution.runs.filter((run) => run.status === "completed").length,
    totalSpend: execution.totalSpend,
    currency: plan.currency,
    network: plan.network,
    receiptsStored: execution.receiptsStored,
    runs: execution.runs,
    finalReport: execution.finalReport,
    planPrice: plan.planPrice,
    reportPrice: plan.reportPrice,
    searchSpend: execution.searchSpend,
    llmSpend: execution.llmSpend
  };

  res.status(200).json(okResponse(response));
};

export const postResearchStart = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ResearchPlanRequestBody>;
  const task = typeof body?.task === "string" ? body.task.trim() : "";

  logger.debug({ task }, "Agent async research start controller called");

  if (!task) {
    res.status(400).json(errorResponse("task is required"));
    return;
  }

  const plan = await buildResearchPlan(task);

  const agentRun = await createAgentRun({
    task: plan.task,
    totalQueries: plan.totalQueries,
    totalSpend: "0.00",
    currency: plan.currency,
    network: plan.network,
    plan: plan.plan,
    planPrice: plan.planPrice,
    reportPrice: plan.reportPrice,
    searchSpend: "0.00",
    llmSpend: (Number(plan.planPrice) + Number(plan.reportPrice)).toFixed(2)
  });

  void executeResearchPlan({
    agentRunId: agentRun.id,
    task: plan.task,
    plan: plan.plan
  }).catch((error) => {
    logger.error(
      {
        error,
        agentRunId: agentRun.id
      },
      "Asynchronous agent research execution failed"
    );
  });

  res.status(202).json(
    okResponse({
      agentRunId: agentRun.id,
      task: plan.task,
      status: "planned",
      totalQueries: plan.totalQueries,
      totalEstimatedCost: plan.totalEstimatedCost,
      currency: plan.currency,
      network: plan.network,
      plan: plan.plan,
      planPrice: plan.planPrice,
      reportPrice: plan.reportPrice,
      searchPricePerQuery: "0.01"
    })
  );
};

export const getAgentRunStatus = async (req: Request, res: Response): Promise<void> => {
  const rawAgentRunId = req.params.agentRunId;
  const agentRunId =
    typeof rawAgentRunId === "string"
      ? rawAgentRunId
      : Array.isArray(rawAgentRunId)
        ? rawAgentRunId[0]
        : "";

  if (!agentRunId) {
    res.status(400).json(errorResponse("agentRunId is required"));
    return;
  }

  const run = await getAgentRunById(agentRunId);
  const queries = await getAgentRunQueries(agentRunId);

  const completedQueries = queries.filter((query) => query.status === "completed").length;
  const failedQueries = queries.filter((query) => query.status === "failed").length;
  const queuedQueries = queries.filter((query) => query.status === "queued").length;
  const runningQueries = queries.filter((query) => query.status === "running").length;

  const response: AgentRunStatusResponseBody = {
    ok: true,
    agentRunId: run.id,
    task: run.task,
    status: run.status,
    totalQueries: run.total_queries,
    completedQueries,
    failedQueries,
    queuedQueries,
    runningQueries,
    totalSpend: run.total_spend,
    currency: run.currency,
    network: run.network,
    finalReport: run.final_report ?? null,
    queries
  };

  res.status(200).json(okResponse(response));
};
