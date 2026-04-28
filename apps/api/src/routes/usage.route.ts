import { Router } from "express";
import { getUsageBySessionId } from "../controllers/usage.controller.js";

const usageRouter = Router();

usageRouter.get("/usage/:sessionId", getUsageBySessionId);

export { usageRouter };
