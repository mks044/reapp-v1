/**
 * AP2 IntentMandate - signing and validation using jose.
 *
 * This is REAPP's TypeScript implementation of the AP2 mandate model.
 * Google only ships a Python reference; this is built from the spec.
 */

import { SignJWT, jwtVerify, generateKeyPair, exportJWK, type KeyLike } from "jose";
import { z } from "zod";

// --- Schema ---

export const IntentMandateSchema = z.object({
  user_cart_confirmation_required: z.boolean(),
  natural_language_description: z.string(),
  merchants: z.array(z.string()).nullable(),
  skus: z.array(z.string()).nullable(),
  required_refundability: z.boolean(),
  per_tx_limit: z.number().positive(),
  period_limit: z.number().positive(),
  intent_expiry: z.string().datetime(),
});

export type IntentMandate = z.infer<typeof IntentMandateSchema>;

export interface SignedMandate {
  jwt: string;
  mandate: IntentMandate;
  mandateHash: string;
}

// --- Key generation ---

export async function generateUserKeypair() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  return { publicKey, privateKey };
}

export async function generateAgentKeypair() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  return { publicKey, privateKey };
}

// --- Signing ---

export async function signIntentMandate(
  mandate: IntentMandate,
  privateKey: KeyLike
): Promise<SignedMandate> {
  const parsed = IntentMandateSchema.parse(mandate);

  const jwt = await new SignJWT({ "ap2.mandates.IntentMandate": parsed })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(new Date(parsed.intent_expiry).getTime() / 1000))
    .setJti(crypto.randomUUID())
    .sign(privateKey);

  const mandateHash = await hashMandate(jwt);

  return { jwt, mandate: parsed, mandateHash };
}

// --- Validation ---

export async function validateIntentMandate(
  jwt: string,
  publicKey: KeyLike
): Promise<IntentMandate> {
  const { payload } = await jwtVerify(jwt, publicKey);
  const mandate = IntentMandateSchema.parse(
    payload["ap2.mandates.IntentMandate"]
  );

  if (new Date(mandate.intent_expiry) < new Date()) {
    throw new Error("IntentMandate expired");
  }

  return mandate;
}

// --- Hashing ---

async function hashMandate(jwt: string): Promise<string> {
  const encoded = new TextEncoder().encode(jwt);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Buffer.from(hash).toString("hex");
}
