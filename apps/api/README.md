# REAPP x402 Agent API

This app is the REAPP paid-capability API. It exposes x402/Stellar payment
requirements for agent-facing capabilities and connects those requests to
REAPP's mandate-first authorization model.

## Core Responsibilities

- Stellar x402 resource-server setup.
- Paid request middleware.
- Autonomous x402 client flow for agent-side payment.
- Receipt and settlement metadata capture.
- Supabase persistence patterns.
- A paid search capability used as the first capability resource.

## REAPP Integration

- `POST /api/mandates/authorize-payment` maps an x402 payment requirement to
  an AP2-style IntentMandate validation request.
- `@reapp/mandate-validator` performs the seven authorization gates before an
  agent signs payment.
- The API response points to the Soroban `validate_and_consume` call that
  should anchor replay protection and budget enforcement on-chain.
- The paid capability endpoint is exposed as `POST /api/capabilities/search`;
  `POST /api/search` remains available as a short-form alias.

## Core Routes

- `GET /api/health`
- `GET /api/pricing`
- `POST /api/mandates/authorize-payment`
- `POST /api/capabilities/search`
- `POST /api/payment/receipt`
- `GET /api/usage/:sessionId`
- `POST /api/agent/research-plan`
- `POST /api/agent/research/start`
- `GET /api/agent/runs/:agentRunId`

Agent orchestration routes under `/api/agent/*` require an API key:

```http
Authorization: Bearer YOUR_REAPP_AGENT_API_KEY
```

or:

```http
x-reapp-agent-key: YOUR_REAPP_AGENT_API_KEY
```

## Local Development

```bash
cp .env.example .env
npm run dev
```

Required environment:

- `AGENT_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X402_NETWORK`
- `X402_FACILITATOR_URL`
- `X402_OZ_API_KEY`
- `X402_PAY_TO`
- `X402_TESTNET_SECRET` for autonomous agent payment tests

Optional:

- `TAVILY_API_KEY` for real search results
- `GEMINI_API_KEY` for plan/evaluation/report generation
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AGENT_RATE_LIMIT_MAX`, and
  `MANDATE_RATE_LIMIT_MAX` for API rate-limit tuning

## Test x402 Flow

```bash
npm run test:x402
```

The test client expects a running local API and `X402_TESTNET_SECRET`.
