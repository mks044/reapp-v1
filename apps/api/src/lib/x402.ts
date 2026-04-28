import { env } from "../config/env.js";
import { logger } from "./logger.js";

logger.info(
  {
    network: env.X402_NETWORK,
    facilitatorUrl: env.X402_FACILITATOR_URL,
    payTo: env.X402_PAY_TO
  },
  "Loaded x402 configuration"
);

export const x402Config = {
  network: env.X402_NETWORK,
  facilitatorUrl: env.X402_FACILITATOR_URL,
  facilitatorApiKey: env.X402_OZ_API_KEY,
  payTo: env.X402_PAY_TO
} as const;
