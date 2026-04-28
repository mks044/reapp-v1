import { Router } from "express";
import { getPaymentQuote } from "../controllers/payment.controller.js";
import { postPaymentComplete } from "../controllers/paymentComplete.controller.js";
import { postPaymentReceipt } from "../controllers/paymentReceipt.controller.js";

const paymentRouter = Router();

paymentRouter.get("/payment/quote", getPaymentQuote);
paymentRouter.post("/payment/complete", postPaymentComplete);
paymentRouter.post("/payment/receipt", postPaymentReceipt);

export { paymentRouter };
