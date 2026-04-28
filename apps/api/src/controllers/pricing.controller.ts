import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { PRICING } from "../constants/pricing.js";
import { okResponse } from "../utils/apiResponse.js";

export const getPricing = (_req: Request, res: Response): void => {
  logger.debug("Pricing controller called");

  res.status(200).json(
    okResponse({
      pricing: PRICING
    })
  );
};
