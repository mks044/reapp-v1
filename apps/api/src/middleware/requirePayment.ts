import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { PRICING } from "../constants/pricing.js";
import { errorResponse } from "../utils/apiResponse.js";

export const requirePayment = (req: Request, res: Response, next: NextFunction): void => {
  const paidHeader = req.header("x-reapp-paid");

  logger.debug(
    {
      path: req.path,
      method: req.method,
      paidHeader: paidHeader ?? null,
      mode: "stub-payment-gate"
    },
    "Evaluating payment requirement"
  );

  if (paidHeader === "true") {
    logger.info(
      {
        path: req.path,
        method: req.method,
        mode: "stub-payment-gate"
      },
      "Payment requirement satisfied by stub header"
    );

    next();
    return;
  }

  logger.warn(
    {
      path: req.path,
      method: req.method,
      mode: "stub-payment-gate"
    },
    "Payment required before accessing protected endpoint"
  );

  res.status(402).json(
    errorResponse("Payment required", {
      paymentRequired: true,
      quote: {
        amount: PRICING.pricePerQuery,
        currency: PRICING.currency,
        network: PRICING.network,
        resource: req.path
      },
      instructions: "Temporary dev flow: retry this request with header x-reapp-paid: true"
    })
  );
};
