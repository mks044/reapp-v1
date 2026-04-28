import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { logger } from "../lib/logger.js";
import { deriveSettlementDetails } from "../utils/paymentSettle.js";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:8080";
const network = (process.env.X402_NETWORK ?? "stellar:testnet") as `${string}:${string}`;
const secret = process.env.X402_TESTNET_SECRET;

export interface AgentPaidQueryExecutionResult {
  ok: boolean;
  status: number;
  query: string;
  sessionId: string | null;
  paymentResponseHeader: string | null;
  paymentSettleResponse: unknown;
  transactionHash: string | null;
  transactionUrl: string | null;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: "web";
    rank: number;
  }>;
}

export const runPaidAgentQuery = async (
  query: string
): Promise<AgentPaidQueryExecutionResult> => {
  if (!secret) {
    throw new Error("Missing X402_TESTNET_SECRET for autonomous paid agent execution");
  }

  const signer = createEd25519Signer(secret, network);
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer)
  );
  const httpClient = new x402HTTPClient(client);

  const url = new URL("/api/capabilities/search", baseUrl).toString();

  logger.info({ query, url }, "Starting paid agent query");

  const firstResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  if (firstResponse.status !== 402) {
    const text = await firstResponse.text();
    throw new Error(`Expected 402 for paid agent query, got ${firstResponse.status}: ${text}`);
  }

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstResponse.headers.get(name)
  );

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...paymentHeaders
    },
    body: JSON.stringify({ query })
  });

  const paymentResponseHeader =
    paidResponse.headers.get("PAYMENT-RESPONSE") ??
    paidResponse.headers.get("payment-response");

  let paymentSettleResponse: unknown = null;

  try {
    paymentSettleResponse = httpClient.getPaymentSettleResponse((name) =>
      paidResponse.headers.get(name)
    );
  } catch (error) {
    logger.warn(
      {
        query,
        error: error instanceof Error ? error.message : String(error)
      },
      "Unable to parse payment settle response from headers"
    );
  }

  const settlement = deriveSettlementDetails(paymentSettleResponse);

  const json = (await paidResponse.json()) as {
    ok?: boolean;
    sessionId?: string;
    results?: Array<{
      title: string;
      url: string;
      snippet: string;
      source: string;
      rank: number;
    }>;
  };

  const results =
    Array.isArray(json.results)
      ? json.results.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          source: "web" as const,
          rank: result.rank
        }))
      : [];

  return {
    ok: paidResponse.ok,
    status: paidResponse.status,
    query,
    sessionId: typeof json.sessionId === "string" ? json.sessionId : null,
    paymentResponseHeader,
    paymentSettleResponse: settlement.paymentSettleResponse,
    transactionHash: settlement.transactionHash,
    transactionUrl: settlement.transactionUrl,
    results
  };
};
