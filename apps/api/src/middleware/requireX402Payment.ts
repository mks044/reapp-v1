import { paymentMiddleware } from "@x402/express";
import { env } from "../config/env.js";
import { resourceServer } from "../lib/x402Server.js";

export const requireX402Payment = paymentMiddleware(
  {
    "POST /search": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: env.X402_NETWORK,
          payTo: env.X402_PAY_TO
        }
      ],
      description: "REAPP paid search capability for delegated agents",
      mimeType: "application/json"
    },
    "POST /capabilities/search": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: env.X402_NETWORK,
          payTo: env.X402_PAY_TO
        }
      ],
      description: "REAPP paid search capability for delegated agents",
      mimeType: "application/json"
    }
  },
  resourceServer
);
