import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

logger.debug("Initializing Supabase client...");

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

logger.info("Supabase client initialized successfully.");
