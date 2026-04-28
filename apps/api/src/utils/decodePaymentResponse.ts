export const decodePaymentResponseHeader = (
  headerValue: string | null | undefined
): unknown | null => {
  const raw = headerValue?.trim();

  if (!raw) {
    return null;
  }

  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
};
