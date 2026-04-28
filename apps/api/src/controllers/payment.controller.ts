import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { PRICING } from "../constants/pricing.js";
import { okResponse } from "../utils/apiResponse.js";
import { resolveSessionId } from "../utils/session.js";
import { createPaymentSession } from "../services/paymentSession.service.js";

export const getPaymentQuote = async (req: Request, res: Response): Promise<void> => {
  const rawSessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const query = typeof req.query.query === "string" ? req.query.query : null;
  const sessionId = resolveSessionId(rawSessionId);

  logger.debug(
    {
      sessionId,
      query
    },
    "Payment quote controller called"
  );

  const paymentSession = await createPaymentSession({
    sessionId,
    query,
    amount: PRICING.pricePerQuery,
    currency: PRICING.currency,
    network: PRICING.network
  });

  res.status(200).json(
    okResponse({
      paymentRequired: true,
      quote: {
        paymentSessionId: paymentSession.id,
        amount: PRICING.pricePerQuery,
        currency: PRICING.currency,
        network: PRICING.network,
        resource: "/api/capabilities/search",
        sessionId,
        query
      }
    })
  );
};
