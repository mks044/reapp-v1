import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import type { SearchResultItem } from "../types/search.types.js";

export const createSearchRequestRecord = async (input: {
  sessionId: string | null;
  query: string;
  resultCount: number;
  priceCharged: string;
  currency: string;
  results: SearchResultItem[];
  paid: boolean;
  paymentResponseHeader?: string | null;
  paymentSettleResponse?: unknown;
  transactionHash?: string | null;
  transactionUrl?: string | null;
}): Promise<void> => {
  logger.debug(
    {
      sessionId: input.sessionId,
      query: input.query,
      resultCount: input.resultCount,
      priceCharged: input.priceCharged,
      currency: input.currency,
      paid: input.paid,
      hasPaymentResponseHeader: Boolean(input.paymentResponseHeader),
      hasTransactionHash: Boolean(input.transactionHash)
    },
    "Creating search request record in Supabase"
  );

  const { error } = await supabase.from("search_requests").insert({
    session_id: input.sessionId,
    query: input.query,
    result_count: input.resultCount,
    price_charged: input.priceCharged,
    currency: input.currency,
    results_json: input.results,
    paid: input.paid,
    payment_response_header: input.paymentResponseHeader ?? null,
    payment_settle_response: input.paymentSettleResponse ?? null,
    transaction_hash: input.transactionHash ?? null,
    transaction_url: input.transactionUrl ?? null
  });

  if (error) {
    logger.error({ error }, "Failed to insert search request record into Supabase");
    throw new Error(`Failed to create search request record: ${error.message}`);
  }

  logger.info(
    {
      sessionId: input.sessionId,
      query: input.query,
      paid: input.paid
    },
    "Search request record created successfully"
  );
};
