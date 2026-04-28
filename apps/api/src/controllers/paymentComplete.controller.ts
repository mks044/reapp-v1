import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";
import { markPaymentSessionPaid } from "../services/paymentSession.service.js";

export const postPaymentComplete = async (req: Request, res: Response): Promise<void> => {
  const paymentSessionId =
    typeof req.body?.paymentSessionId === "string" ? req.body.paymentSessionId : null;

  logger.debug(
    {
      paymentSessionId
    },
    "Payment completion controller called"
  );

  if (!paymentSessionId) {
    res.status(400).json(errorResponse("paymentSessionId is required"));
    return;
  }

  const paymentSession = await markPaymentSessionPaid(paymentSessionId);

  res.status(200).json(
    okResponse({
      paymentSession: {
        id: paymentSession.id,
        sessionId: paymentSession.session_id,
        status: paymentSession.status,
        paidAt: paymentSession.paid_at
      }
    })
  );
};
