import { Request, Response } from "express";
import { InvalidMandatePublicKeyError } from "@reapp/mandate-validator";
import { mandateAuthorizationSchema } from "../schemas/mandate.schema.js";
import { authorizeMandatePayment } from "../services/mandateAuthorization.service.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";

export const postMandateAuthorization = async (
  req: Request,
  res: Response
): Promise<void> => {
  const parsed = mandateAuthorizationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(
      errorResponse("Invalid mandate authorization request", parsed.error.flatten())
    );
    return;
  }

  try {
    const result = await authorizeMandatePayment(parsed.data);

    res.status(result.validation.authorized ? 200 : 403).json(
      okResponse({
        authorized: result.validation.authorized,
        nonce: result.nonce,
        paymentRequest: result.paymentRequest,
        gateResults: result.validation.gateResults,
        error: result.validation.error ?? null,
        mandate: result.validation.mandate ?? null,
        sorobanNextStep: {
          contract: "contracts/mandate-registry",
          function: "validate_and_consume",
          description:
            "Call the Soroban registry with mandate_id, nonce, amount, merchant, and token before signing the x402 payment."
        }
      })
    );
  } catch (error) {
    if (error instanceof InvalidMandatePublicKeyError) {
      res.status(400).json(
        errorResponse("Invalid mandate public key", error.details)
      );
      return;
    }

    res.status(500).json(
      errorResponse(
        error instanceof Error
          ? error.message
          : "Failed to authorize mandate payment"
      )
    );
  }
};
