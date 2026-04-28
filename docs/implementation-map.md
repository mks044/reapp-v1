# Implementation Map

This file maps the main REAPP execution layers to code in this repository.

## Stellar x402 Payment Layer

The Stellar-specific payment implementation is in `apps/api`.

- `apps/api/src/lib/x402Server.ts` initializes the x402 resource server with a Stellar exact payment scheme.
- `apps/api/src/middleware/requireX402Payment.ts` protects `POST /api/capabilities/search` with a Stellar testnet x402 payment requirement.
- `apps/api/src/controllers/mandate.controller.ts` maps an x402 payment requirement into REAPP mandate validation.
- `apps/api/src/services/agentPaidQuery.service.ts` acts as an autonomous paying client: it receives the 402 challenge, signs a Stellar payment payload, retries with payment headers, and reads the settlement response.
- `apps/api/src/services/researchOrchestrator.service.ts` composes multiple paid requests into an agent workflow.

## Soroban Mandate Registry

The Soroban contract is in `contracts/mandate-registry`.

The contract implements:

- mandate registration
- user revocation
- agent-scoped authorization
- merchant and token scope checks
- per-transaction limit checks
- period budget checks
- nonce consumption for replay protection

This is the on-chain policy layer REAPP uses before an agent payment is allowed to proceed.

## AP2 / Mandate Authorization

The mandate implementation is in `packages/mandate-validator`.

It implements:

- IntentMandate schema
- signed mandate JWTs
- mandate hashing
- 7-gate payment authorization
- an x402 requirement adapter

## End-to-End Flow

The API, validator, and contract share a single execution path: x402 challenge, mandate validation, Soroban nonce and budget consumption, signed Stellar payment retry, and receipt/audit record storage.
