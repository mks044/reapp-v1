# REAPP API Notes

## Mandate Authorization

`POST /api/mandates/authorize-payment`

Validates whether an agent may satisfy an x402 payment requirement under a
signed mandate.

Request:

```json
{
  "mandateJwt": "signed-ap2-style-intent-mandate",
  "mandateHash": "sha256-hash",
  "userPublicJwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  },
  "nonce": "optional-client-nonce",
  "x402Requirement": {
    "price": "$0.01",
    "payTo": "GB...",
    "network": "stellar:testnet",
    "resource": "POST /api/capabilities/search"
  }
}
```

The endpoint returns the 7-gate validation result and the Soroban follow-up
call expected before payment signing.

## Paid Capability

`POST /api/capabilities/search`

Protected by x402. Unpaid requests return `402 Payment Required`. Paid retries
return capability output and expose `PAYMENT-RESPONSE` for receipt persistence.

`POST /api/search` remains available as a short-form alias for the same paid
capability.

## Agent Runner

The agent runner composes the same paid capability into multi-step agent
execution. Its current task is paid research, but the useful REAPP
primitive is broader: an agent can encounter a paid capability, pass through
mandate authorization, sign the x402 payload, retry, and record proof.
