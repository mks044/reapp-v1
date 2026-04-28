# Security Model

REAPP separates public paid capabilities from internal agent orchestration.
Capability routes use x402 payment enforcement. Agent orchestration routes use
API-key authentication because they trigger Gemini, Tavily, and internal paid
capability calls.

## API Controls

The Express API enforces:

- security headers at the application boundary
- global request rate limiting
- tighter rate limiting on expensive agent and mandate authorization routes
- API-key authentication on `/api/agent/*`
- structured validation for public mandate keys before cryptographic import

The built-in rate limiter is process-local. Multi-instance deployments should
use a shared limiter store or an upstream gateway-level limiter.

## State Boundaries

The TypeScript mandate validator is an off-chain pre-check. Durable replay and
budget enforcement belongs to the Soroban mandate registry through
`validate_and_consume`.

The Supabase service-role key is used only by the server process. It should not
be exposed to browser clients or user-controlled code. A future user-session
model can add scoped per-user clients, but the current API is a server-side
control plane.

## CORS

Requests without an `Origin` header are accepted to support server-to-server,
CLI, and x402 client flows. This depends on authentication and rate limiting for
non-public agent routes.
