import { randomUUID } from "crypto";
import {
  ReappValidator,
  importMandatePublicKey,
  paymentRequestFromX402
} from "@reapp/mandate-validator";
import type { MandateAuthorizationRequest } from "../schemas/mandate.schema.js";

const validators = new Map<string, ReappValidator>();

export const authorizeMandatePayment = async (
  input: MandateAuthorizationRequest
) => {
  const publicKey = await importMandatePublicKey(input.userPublicJwk);
  const validator =
    validators.get(input.mandateHash) ?? new ReappValidator(publicKey);

  validators.set(input.mandateHash, validator);

  const nonce = input.nonce ?? randomUUID();
  const paymentRequest = paymentRequestFromX402({
    mandateJwt: input.mandateJwt,
    mandateHash: input.mandateHash,
    requirement: input.x402Requirement,
    nonce
  });

  const validation = await validator.validate(paymentRequest);

  return {
    nonce,
    paymentRequest,
    validation
  };
};
