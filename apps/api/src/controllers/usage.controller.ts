import { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { okResponse, errorResponse } from "../utils/apiResponse.js";

export const getUsageBySessionId = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  logger.debug(
    {
      sessionId
    },
    "Usage controller called"
  );

  const { data, error } = await supabase
    .from("search_requests")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error(
      {
        sessionId,
        error
      },
      "Failed to fetch usage records from Supabase"
    );

    res.status(500).json(
      errorResponse("Failed to fetch usage history")
    );

    return;
  }

  const rows = data ?? [];
  const totalQueries = rows.length;
  const totalSpent = rows
    .reduce((sum, row) => sum + Number(row.price_charged ?? 0), 0)
    .toFixed(2);

  logger.info(
    {
      sessionId,
      totalQueries,
      totalSpent
    },
    "Usage history fetched successfully"
  );

  res.status(200).json(
    okResponse({
      sessionId,
      totalQueries,
      totalSpent,
      currency: "USDC",
      history: rows
    })
  );
};
