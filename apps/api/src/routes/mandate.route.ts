import { Router } from "express";
import { postMandateAuthorization } from "../controllers/mandate.controller.js";
import { mandateRateLimiter } from "../middleware/rateLimit.js";

const mandateRouter = Router();

mandateRouter.use("/mandates", mandateRateLimiter);
mandateRouter.post("/mandates/authorize-payment", postMandateAuthorization);

export { mandateRouter };
