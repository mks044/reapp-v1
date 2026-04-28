import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/express";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

logger.info(
  {
    facilitatorUrl: env.X402_FACILITATOR_URL,
    network: env.X402_NETWORK,
    payTo: env.X402_PAY_TO
  },
  "Initializing x402 Stellar resource server"
);

const facilitatorClient = new HTTPFacilitatorClient({
  url: env.X402_FACILITATOR_URL,
  createAuthHeaders: async () => {
    const headers = {
      Authorization: `Bearer ${env.X402_OZ_API_KEY}`
    };

    return {
      verify: headers,
      settle: headers,
      supported: headers
    };
  }
});

export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  env.X402_NETWORK,
  new ExactStellarScheme()
);

logger.info("x402 Stellar resource server initialized");
