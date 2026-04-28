import { z } from "zod";

export const x402RequirementSchema = z.object({
  price: z.string().min(1),
  payTo: z.string().min(1),
  network: z.string().min(1),
  resource: z.string().optional()
});

export const mandateAuthorizationSchema = z.object({
  mandateJwt: z.string().min(1),
  mandateHash: z.string().min(1),
  userPublicJwk: z.record(z.string(), z.unknown()),
  nonce: z.string().min(1).optional(),
  x402Requirement: x402RequirementSchema
});

export type MandateAuthorizationRequest = z.infer<
  typeof mandateAuthorizationSchema
>;
