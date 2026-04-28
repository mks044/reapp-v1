# REAPP Mandate Registry

Soroban contract for REAPP mandate enforcement.

The contract stores a user's mandate and lets an authorized agent consume budget only when the payment matches the mandate bounds.

Implemented and tested checks:

- user-authenticated mandate registration
- user-authenticated revocation
- agent-authenticated spend consumption
- expiry by ledger sequence
- merchant scope
- token scope
- per-transaction limit
- period budget limit
- nonce replay protection

Build in a Rust/Soroban environment:

```bash
cargo test
cargo build --target wasm32v1-none --release
```

The test suite covers successful registration/consumption, replay rejection,
merchant/token mismatches, per-transaction limits, period budget overruns,
revocation, and expiry.

The resulting WASM is the on-chain enforcement component that the TypeScript validator and x402 API will call before an agent signs a payment.
