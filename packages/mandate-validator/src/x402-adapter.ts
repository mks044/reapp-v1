import type { PaymentRequest } from "./validator.js";

export interface X402Requirement {
  price: string;
  payTo: string;
  network: string;
  resource?: string;
}

export interface MandatePaymentContext {
  mandateJwt: string;
  mandateHash: string;
  requirement: X402Requirement;
  nonce: string;
}

const parseUsdcPrice = (price: string): number => {
  const normalized = price.trim().replace(/^\$/, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid x402 price: ${price}`);
  }

  return amount;
};

export const paymentRequestFromX402 = (
  context: MandatePaymentContext
): PaymentRequest => {
  return {
    mandateJwt: context.mandateJwt,
    mandateHash: context.mandateHash,
    amount: parseUsdcPrice(context.requirement.price),
    merchant: context.requirement.payTo,
    nonce: context.nonce
  };
};
