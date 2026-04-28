import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";
import { supabase } from "../lib/supabase.js";
import { decodePaymentResponseHeader } from "../utils/decodePaymentResponse.js";
import { deriveSettlementDetails } from "../utils/paymentSettle.js";

export const postPaymentReceipt = async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
  const paymentResponseHeader =
    typeof req.body?.paymentResponseHeader === "string"
      ? req.body.paymentResponseHeader
      : null;

  logger.debug(
    {
      sessionId,
      hasPaymentResponseHeader: Boolean(paymentResponseHeader)
    },
    "Payment receipt controller called"
  );

  if (!sessionId) {
    res.status(400).json(errorResponse("sessionId is required"));
    return;
  }

  if (!paymentResponseHeader) {
    res.status(400).json(errorResponse("paymentResponseHeader is required"));
    return;
  }

  const decodedPaymentSettleResponse =
    decodePaymentResponseHeader(paymentResponseHeader);
  const settlementDetails = deriveSettlementDetails(
    decodedPaymentSettleResponse
  );

  const { error } = await supabase
    .from("search_requests")
    .update({
      payment_response_header: paymentResponseHeader,
      payment_settle_response: settlementDetails.paymentSettleResponse,
      transaction_hash: settlementDetails.transactionHash,
      transaction_url: settlementDetails.transactionUrl
    })
    .eq("session_id", sessionId)
    .is("payment_response_header", null);

  if (error) {
    logger.error({ error, sessionId }, "Failed to persist payment receipt");
    res.status(500).json(errorResponse("Failed to persist payment receipt"));
    return;
  }

  logger.info(
    {
      sessionId,
      hasPaymentResponseHeader: true,
      transactionHash: settlementDetails.transactionHash
    },
    "Payment receipt persisted successfully"
  );

  res.status(200).json(
    okResponse({
      sessionId,
      receiptStored: true,
      transactionHash: settlementDetails.transactionHash,
      transactionUrl: settlementDetails.transactionUrl
    })
  );
};
