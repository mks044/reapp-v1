/**
 * REAPP Validator - 7-gate authorization chain.
 *
 * Every gate must pass. Single failure = rejection with reason code.
 * This is the core of REAPP's value: AP2 mandate validation
 * mapped to on-chain spending enforcement.
 */

import { validateIntentMandate, type IntentMandate } from "./mandate.js";
import type { KeyLike } from "jose";

// --- Types ---

export interface PaymentRequest {
  mandateJwt: string;
  mandateHash: string;
  amount: number;
  merchant: string;
  nonce: string;
}

export interface ValidationResult {
  authorized: boolean;
  gateResults: GateResult[];
  mandate?: IntentMandate;
  error?: string;
}

interface GateResult {
  gate: string;
  passed: boolean;
  reason?: string;
}

interface SpendingState {
  periodSpend: number;
  consumedNonces: Set<string>;
}

// --- Validator ---

export class ReappValidator {
  private spendingState: Map<string, SpendingState> = new Map();

  constructor(private userPublicKey: KeyLike) {}

  async validate(req: PaymentRequest): Promise<ValidationResult> {
    const gates: GateResult[] = [];

    // Gate 1: Mandate signature valid
    let mandate: IntentMandate;
    try {
      mandate = await validateIntentMandate(req.mandateJwt, this.userPublicKey);
      gates.push({ gate: "signature", passed: true });
    } catch (e) {
      gates.push({
        gate: "signature",
        passed: false,
        reason: e instanceof Error ? e.message : "Invalid signature",
      });
      return { authorized: false, gateResults: gates, error: "Signature verification failed" };
    }

    // Gate 2: Not expired
    const now = new Date();
    const expiry = new Date(mandate.intent_expiry);
    if (expiry <= now) {
      gates.push({ gate: "expiry", passed: false, reason: `Expired at ${expiry.toISOString()}` });
      return { authorized: false, gateResults: gates, mandate, error: "Mandate expired" };
    }
    gates.push({ gate: "expiry", passed: true });

    // Gate 3: Merchant authorized
    if (mandate.merchants !== null && !mandate.merchants.includes(req.merchant)) {
      gates.push({
        gate: "merchant",
        passed: false,
        reason: `${req.merchant} not in allowed list`,
      });
      return { authorized: false, gateResults: gates, mandate, error: "Merchant not authorized" };
    }
    gates.push({ gate: "merchant", passed: true });

    // Gate 4: Per-transaction limit
    if (req.amount > mandate.per_tx_limit) {
      gates.push({
        gate: "per_tx_limit",
        passed: false,
        reason: `${req.amount} exceeds limit ${mandate.per_tx_limit}`,
      });
      return { authorized: false, gateResults: gates, mandate, error: "Exceeds per-tx limit" };
    }
    gates.push({ gate: "per_tx_limit", passed: true });

    // Gate 5: Replay protection
    const state = this.getSpendingState(req.mandateHash);
    if (state.consumedNonces.has(req.nonce)) {
      gates.push({ gate: "replay", passed: false, reason: "Nonce already consumed" });
      return { authorized: false, gateResults: gates, mandate, error: "Replay detected" };
    }
    gates.push({ gate: "replay", passed: true });

    // Gate 6: Period spending limit
    const newPeriodSpend = state.periodSpend + req.amount;
    if (newPeriodSpend > mandate.period_limit) {
      gates.push({
        gate: "period_limit",
        passed: false,
        reason: `${newPeriodSpend.toFixed(2)} would exceed ${mandate.period_limit}/period`,
      });
      return { authorized: false, gateResults: gates, mandate, error: "Period limit exceeded" };
    }
    gates.push({ gate: "period_limit", passed: true });

    // Gate 7: Consume (atomic state update)
    state.periodSpend = newPeriodSpend;
    state.consumedNonces.add(req.nonce);
    gates.push({ gate: "consume", passed: true });

    return { authorized: true, gateResults: gates, mandate };
  }

  getSpendingState(mandateHash: string): SpendingState {
    if (!this.spendingState.has(mandateHash)) {
      this.spendingState.set(mandateHash, {
        periodSpend: 0,
        consumedNonces: new Set(),
      });
    }
    return this.spendingState.get(mandateHash)!;
  }

  getRemainingBudget(mandateHash: string, periodLimit: number): number {
    const state = this.getSpendingState(mandateHash);
    return periodLimit - state.periodSpend;
  }
}
