import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { searchRequestSchema } from "../schemas/search.schema.js";
import { runStubSearch } from "../services/search.service.js";
import { createSearchRequestRecord } from "../services/searchRequest.service.js";
import { PRICING } from "../constants/pricing.js";
import { resolveSessionId } from "../utils/session.js";
import { decodePaymentResponseHeader } from "../utils/decodePaymentResponse.js";
import { deriveSettlementDetails } from "../utils/paymentSettle.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";
import type { SearchRequestBody, SearchResponseBody } from "../types/search.types.js";

export const postSearch = async (req: Request, res: Response): Promise<void> => {
  logger.debug(
    {
      body: req.body
    },
    "Search controller called"
  );

  const parsed = searchRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    logger.warn(
      {
        issues: parsed.error.issues
      },
      "Search request validation failed"
    );

    res.status(400).json(
      errorResponse("Invalid search request", parsed.error.flatten())
    );

    return;
  }

  const body: SearchRequestBody = parsed.data;
  const resolvedSessionId = resolveSessionId(body.sessionId);
  const paymentResponseHeader =
    typeof res.locals.paymentResponseHeader === "string"
      ? res.locals.paymentResponseHeader
      : null;
  const decodedPaymentSettleResponse =
    decodePaymentResponseHeader(paymentResponseHeader);
  const settlementDetails = deriveSettlementDetails(
    decodedPaymentSettleResponse
  );

  logger.info(
    {
      query: body.query,
      sessionId: resolvedSessionId,
      hasPaymentResponseHeader: Boolean(paymentResponseHeader),
      hasTransactionHash: Boolean(settlementDetails.transactionHash)
    },
    "Validated search request"
  );

  const results = await runStubSearch(body.query);

  await createSearchRequestRecord({
    sessionId: resolvedSessionId,
    query: body.query,
    resultCount: results.length,
    priceCharged: PRICING.pricePerQuery,
    currency: PRICING.currency,
    results,
    paid: true,
    paymentResponseHeader,
    paymentSettleResponse: settlementDetails.paymentSettleResponse,
    transactionHash: settlementDetails.transactionHash,
    transactionUrl: settlementDetails.transactionUrl
  });

  const response: SearchResponseBody = {
    ok: true,
    query: body.query,
    sessionId: resolvedSessionId,
    results
  };

  logger.debug(
    {
      resultCount: results.length,
      sessionId: resolvedSessionId,
      hasPaymentResponseHeader: Boolean(paymentResponseHeader),
      transactionHash: settlementDetails.transactionHash
    },
    "Returning search response"
  );

  res.status(200).json(
    okResponse({
      query: response.query,
      sessionId: response.sessionId,
      results: response.results,
      paymentReceiptCaptured: Boolean(paymentResponseHeader),
      transactionHash: settlementDetails.transactionHash,
      transactionUrl: settlementDetails.transactionUrl
    })
  );
};
