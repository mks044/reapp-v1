export interface DerivedSettlementDetails {
  paymentSettleResponse: unknown;
  transactionHash: string | null;
  transactionUrl: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const findStringDeep = (value: unknown, keys: string[]): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  for (const nested of Object.values(value)) {
    if (isRecord(nested)) {
      const found = findStringDeep(nested, keys);
      if (found) {
        return found;
      }
    }
  }

  return null;
};

export const deriveSettlementDetails = (
  paymentSettleResponse: unknown
): DerivedSettlementDetails => {
  const transactionHash = findStringDeep(paymentSettleResponse, [
    "transactionHash",
    "txHash",
    "hash",
    "transaction_hash",
    "tx_hash",
    "transaction"
  ]);

  const transactionUrl = transactionHash
    ? `https://testnet.stellarchain.io/tx/${transactionHash}`
    : null;

  return {
    paymentSettleResponse,
    transactionHash,
    transactionUrl
  };
};
