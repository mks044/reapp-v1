import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export const createPaymentSession = async (input: {
  sessionId: string;
  query: string | null;
  amount: string;
  currency: string;
  network: string;
}) => {
  logger.debug(
    {
      sessionId: input.sessionId,
      query: input.query,
      amount: input.amount,
      currency: input.currency,
      network: input.network
    },
    "Creating payment session"
  );

  const { data, error } = await supabase
    .from("payment_sessions")
    .insert({
      session_id: input.sessionId,
      query: input.query,
      amount: input.amount,
      currency: input.currency,
      network: input.network,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) {
    logger.error({ error }, "Failed to create payment session");
    throw new Error(`Failed to create payment session: ${error.message}`);
  }

  logger.info(
    {
      paymentSessionId: data.id,
      sessionId: input.sessionId
    },
    "Payment session created"
  );

  return data;
};

export const markPaymentSessionPaid = async (paymentSessionId: string) => {
  logger.debug(
    {
      paymentSessionId
    },
    "Marking payment session as paid"
  );

  const { data, error } = await supabase
    .from("payment_sessions")
    .update({
      status: "paid",
      paid_at: new Date().toISOString()
    })
    .eq("id", paymentSessionId)
    .select("*")
    .single();

  if (error) {
    logger.error({ error }, "Failed to mark payment session as paid");
    throw new Error(`Failed to mark payment session as paid: ${error.message}`);
  }

  logger.info(
    {
      paymentSessionId,
      sessionId: data.session_id
    },
    "Payment session marked as paid"
  );

  return data;
};

export const getPaidPaymentSession = async (sessionId: string) => {
  logger.debug(
    {
      sessionId
    },
    "Looking up paid payment session"
  );

  const { data, error } = await supabase
    .from("payment_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error }, "Failed to look up paid payment session");
    throw new Error(`Failed to look up paid payment session: ${error.message}`);
  }

  logger.info(
    {
      sessionId,
      found: Boolean(data)
    },
    "Paid payment session lookup completed"
  );

  return data;
};
