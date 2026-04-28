import "dotenv/config";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const secret = process.env.X402_TESTNET_SECRET;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:8080";
const network = process.env.X402_NETWORK ?? "stellar:testnet";

console.log("Starting x402 client test script...");
console.log("Base URL:", baseUrl);
console.log("Network:", network);

if (!secret) {
  console.error("❌ Missing X402_TESTNET_SECRET in environment");
  process.exit(1);
}

async function main() {
  const signer = createEd25519Signer(secret, network);
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer)
  );
  const httpClient = new x402HTTPClient(client);

  const url = new URL("/api/capabilities/search", baseUrl).toString();

  console.log("✅ Client address:", signer.address);
  console.log("➡️ First request (expect 402):", url);

  const firstTry = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "real REAPP x402 paid capability test"
    })
  });

  console.log("First response status:", firstTry.status);

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name)
  );

  console.log("✅ Parsed payment-required response");

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  console.log("✅ Created payment payload");
  console.log("➡️ Retrying with payment headers...");

  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...paymentHeaders
    },
    body: JSON.stringify({
      query: "real REAPP x402 paid capability test"
    })
  });

  const paymentResponseHeader =
    paidResponse.headers.get("PAYMENT-RESPONSE") ??
    paidResponse.headers.get("payment-response");

  console.log("Paid response status:", paidResponse.status);
  console.log("PAYMENT-RESPONSE header present:", Boolean(paymentResponseHeader));
  console.log("PAYMENT-RESPONSE header value:", paymentResponseHeader);

  const paidJson = await paidResponse.json();
  console.log("Paid response body:", JSON.stringify(paidJson));

  if (!paymentResponseHeader) {
    console.log("No PAYMENT-RESPONSE header found, skipping receipt persistence");
    return;
  }

  if (!paidJson.sessionId) {
    console.log("No sessionId found in paid response, skipping receipt persistence");
    return;
  }

  console.log("➡️ Posting receipt back to backend...");

  const receiptResponse = await fetch(new URL("/api/payment/receipt", baseUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: paidJson.sessionId,
      paymentResponseHeader
    })
  });

  const receiptText = await receiptResponse.text();
  console.log("Receipt persistence status:", receiptResponse.status);
  console.log("Receipt persistence body:", receiptText);
}

main().catch((error) => {
  console.error("❌ x402 client test failed");
  console.error(error);
  process.exit(1);
});
