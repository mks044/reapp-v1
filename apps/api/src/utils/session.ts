import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

export const resolveSessionId = (sessionId?: string): string => {
  if (sessionId && sessionId.trim().length > 0) {
    logger.debug(
      {
        sessionId
      },
      "Using provided sessionId"
    );

    return sessionId;
  }

  const generatedSessionId = randomUUID();

  logger.info(
    {
      generatedSessionId
    },
    "Generated new UUID sessionId"
  );

  return generatedSessionId;
};
