import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export const capturePaymentResponse = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const paymentResponseHeader =
      res.getHeader("PAYMENT-RESPONSE") ??
      res.getHeader("payment-response") ??
      null;

    res.locals.paymentResponseHeader =
      typeof paymentResponseHeader === "string" ? paymentResponseHeader : null;

    logger.debug(
      {
        hasPaymentResponseHeader: Boolean(res.locals.paymentResponseHeader)
      },
      "Captured outgoing PAYMENT-RESPONSE header"
    );

    return originalJson(body);
  }) as Response["json"];

  next();
};
