import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { okResponse } from "../utils/apiResponse.js";

export const getHealth = (_req: Request, res: Response): void => {
  logger.debug("Health check controller called");

  res.status(200).json(
    okResponse({
      service: "reapp-x402-agent-api",
      timestamp: new Date().toISOString()
    })
  );
};
