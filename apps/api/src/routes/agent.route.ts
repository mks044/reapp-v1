import { Router } from "express";
import {
  getAgentRunStatus,
  postResearch,
  postResearchPlan,
  postResearchStart
} from "../controllers/agent.controller.js";
import { requireAgentApiKey } from "../middleware/auth.js";
import { agentRateLimiter } from "../middleware/rateLimit.js";

const agentRouter = Router();

agentRouter.use("/agent", agentRateLimiter);
agentRouter.use("/agent", requireAgentApiKey);
agentRouter.post("/agent/research-plan", postResearchPlan);
agentRouter.post("/agent/research", postResearch);
agentRouter.post("/agent/research/start", postResearchStart);
agentRouter.get("/agent/runs/:agentRunId", getAgentRunStatus);

export { agentRouter };
