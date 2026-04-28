import { z } from "zod";

export const searchRequestSchema = z.object({
  query: z
    .string()
    .min(1, "query is required")
    .max(500, "query must be 500 characters or fewer")
    .trim(),
  sessionId: z
    .string()
    .min(1, "sessionId cannot be empty")
    .max(100, "sessionId must be 100 characters or fewer")
    .optional()
});
