import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

logger.info("Booting REAPP x402 agent API server...");

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV
    },
    "Server is listening"
  );
});
