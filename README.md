# REAPP v1

REAPP is a Stellar-native agentic payment system for delegated AI agent payments. This repository contains the core payment, authorization, and policy-enforcement layers:

- `apps/api` - a working TypeScript x402/Stellar paid capability API.
- `packages/mandate-validator` - an AP2-style mandate signing and 7-gate validation package.
- `contracts/mandate-registry` - a Soroban contract for mandate registration, spend limits, replay protection, and revocation.

The implementation connects a real x402 Stellar payment rail with REAPP-specific mandate authorization and Soroban enforcement surfaces.

## What Is Implemented

### x402 Stellar Paid Capability API

`apps/api` protects `POST /api/capabilities/search` with x402 middleware on Stellar testnet. Unpaid requests receive a machine-readable `402 Payment Required`; paid retries unlock capability output and store receipt / transaction metadata in Supabase.

Important files:

- `apps/api/src/lib/x402Server.ts`
- `apps/api/src/middleware/requireX402Payment.ts`
- `apps/api/src/services/agentPaidQuery.service.ts`
- `apps/api/src/services/researchOrchestrator.service.ts`
- `apps/api/src/controllers/mandate.controller.ts`

### AP2-Style Mandate Validator

`packages/mandate-validator` implements a signed IntentMandate and validates payment attempts through seven gates:

1. mandate signature
2. expiry
3. merchant scope
4. per-transaction limit
5. replay protection
6. period spend limit
7. consume / state update

This is the off-chain validator that sits between a 402 payment requirement and an agent's decision to authorize payment. The API exposes this path at `POST /api/mandates/authorize-payment`.

### Soroban Mandate Registry

`contracts/mandate-registry` is the on-chain policy anchor. It stores mandate configuration, enforces per-transaction and period spend limits, consumes nonces, and lets users revoke mandates.

This is the Soroban work that connects the REAPP validator model to Stellar-native enforcement.

## Quick Start

Install dependencies:

```bash
npm install
```

Create the API environment file:

```bash
cp .env.example apps/api/.env
```

Fill in the values in `apps/api/.env`. The repository includes the same stubbed
template at `.env.example` and `apps/api/.env.example`:

```bash
# Runtime
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug
TEST_BASE_URL=http://localhost:8080
AGENT_API_KEY=YOUR_REAPP_AGENT_API_KEY

# Supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Tavily
TAVILY_API_KEY=YOUR_TAVILY_API_KEY

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# Stellar x402
X402_NETWORK=stellar:testnet
X402_FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
X402_OZ_API_KEY=YOUR_OPENZEPPELIN_CHANNELS_API_KEY
X402_PAY_TO=YOUR_STELLAR_TESTNET_PUBLIC_ADDRESS
X402_TESTNET_SECRET=YOUR_STELLAR_TESTNET_SECRET_KEY

# Agent pricing
AGENT_PLAN_PRICE_USDC=0.01
AGENT_EVAL_PRICE_USDC=0.00
AGENT_REPORT_PRICE_USDC=0.01

# Rate limits
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
AGENT_RATE_LIMIT_MAX=20
MANDATE_RATE_LIMIT_MAX=60
```

Build TypeScript packages:

```bash
npm run build
```

Run the x402 API locally:

```bash
npm run dev:api
```

Run the x402 client test after setting `X402_TESTNET_SECRET`, `X402_PAY_TO`,
and the OpenZeppelin Channels API key:

```bash
npm run test:x402
```

Agent orchestration routes under `/api/agent/*` require either:

```bash
Authorization: Bearer $AGENT_API_KEY
```

or:

```bash
x-reapp-agent-key: $AGENT_API_KEY
```

The Soroban contract is in `contracts/mandate-registry`. Build it with the Stellar/Soroban Rust toolchain:

```bash
cd contracts/mandate-registry
cargo test
cargo build --target wasm32v1-none --release
```

## Intended REAPP Flow

1. A user signs an IntentMandate defining merchant scope, per-transaction limits, period budgets, and expiry.
2. The mandate is registered in the Soroban mandate registry.
3. An agent calls a paid x402 endpoint such as `POST /api/capabilities/search`.
4. The endpoint returns a `402 Payment Required` challenge.
5. The agent maps the x402 requirement into a mandate validation request.
6. The TypeScript validator checks signature, scope, expiry, replay, and budget.
7. The Soroban registry consumes the nonce and updates spend counters.
8. The agent signs the x402 Stellar payment and retries the request.
9. The API stores the receipt, transaction hash, and mandate linkage for auditability.

## Development Status

The x402 paid API builds. The mandate validator builds as a standalone TypeScript package. The Soroban contract compiles, has focused unit tests, and builds to WASM with the `wasm32v1-none` target.

Verified locally:

```bash
npm run typecheck
npm run build
cd contracts/mandate-registry && cargo test
cd contracts/mandate-registry && cargo build --target wasm32v1-none --release
```
