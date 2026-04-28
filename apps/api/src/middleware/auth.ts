import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { errorResponse } from "../utils/apiResponse.js";

const getPresentedApiKey = (req: Request): string | null => {
  const authorization = req.header("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const agentKey = req.header("x-reapp-agent-key");
  return agentKey?.trim() || null;
};

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

export const requireAgentApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const presentedKey = getPresentedApiKey(req);

  if (!presentedKey || !safeEqual(presentedKey, env.AGENT_API_KEY)) {
    logger.warn(
      {
        method: req.method,
        path: req.path,
        ip: req.ip,
        hasAuthorization: Boolean(req.header("authorization")),
        hasAgentKey: Boolean(req.header("x-reapp-agent-key"))
      },
      "Rejected unauthenticated agent route request"
    );

    res.setHeader("WWW-Authenticate", 'Bearer realm="REAPP Agent API"');
    res.status(401).json(errorResponse("Unauthorized"));
    return;
  }

  next();
};
