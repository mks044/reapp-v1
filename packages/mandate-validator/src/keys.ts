import { importJWK, type JWK, type KeyLike } from "jose";
import { z } from "zod";

const base64UrlCoordinate = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/, "must be base64url encoded without padding");

const publicEcJwkSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: base64UrlCoordinate,
    y: base64UrlCoordinate,
    alg: z.literal("ES256").optional(),
    use: z.literal("sig").optional(),
    key_ops: z.array(z.literal("verify")).optional(),
    ext: z.boolean().optional(),
    kid: z.string().min(1).optional(),
    d: z.never().optional()
  })
  .strict();

export class InvalidMandatePublicKeyError extends Error {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InvalidMandatePublicKeyError";
    this.details = details;
  }
}

export const importMandatePublicKey = async (jwk: unknown): Promise<KeyLike> => {
  const parsed = publicEcJwkSchema.safeParse(jwk);

  if (!parsed.success) {
    throw new InvalidMandatePublicKeyError(
      "Invalid mandate public JWK",
      parsed.error.flatten()
    );
  }

  try {
    return importJWK(parsed.data as JWK, "ES256") as Promise<KeyLike>;
  } catch (error) {
    throw new InvalidMandatePublicKeyError(
      error instanceof Error ? error.message : "Failed to import mandate public key"
    );
  }
};
