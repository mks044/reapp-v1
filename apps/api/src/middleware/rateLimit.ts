import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { errorResponse } from "../utils/apiResponse.js";

const skipOptions = (req: { method: string }) => req.method === "OPTIONS";

const jsonHandler = (message: string) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipOptions,
    handler: (_req, res) => {
      res.status(429).json(errorResponse(message));
    }
  });

export const globalRateLimiter = jsonHandler("Too many requests");

export const agentRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AGENT_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: skipOptions,
  handler: (_req, res) => {
    res.status(429).json(errorResponse("Too many agent requests"));
  }
});

export const mandateRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.MANDATE_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: skipOptions,
  handler: (_req, res) => {
    res.status(429).json(errorResponse("Too many mandate authorization requests"));
  }
});
