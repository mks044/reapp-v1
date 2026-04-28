import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const networkSchema = z.custom<`${string}:${string}`>(
  (value) => typeof value === "string" && value.includes(":"),
  {
    message: "X402_NETWORK must look like chain:network, e.g. stellar:testnet"
  }
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  AGENT_API_KEY: z.string().min(16, "AGENT_API_KEY must be at least 16 characters"),
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  TAVILY_API_KEY: z.string().optional(),
  X402_NETWORK: networkSchema,
  X402_FACILITATOR_URL: z.string().url("X402_FACILITATOR_URL must be a valid URL"),
  X402_OZ_API_KEY: z.string().min(1, "X402_OZ_API_KEY is required"),
  X402_PAY_TO: z.string().min(1, "X402_PAY_TO is required"),
  X402_TESTNET_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("debug"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AGENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  MANDATE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Environment validation failed");
  console.error(JSON.stringify(parsedEnv.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
