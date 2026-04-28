import { Router } from "express";
import { getPricing } from "../controllers/pricing.controller.js";

const pricingRouter = Router();

pricingRouter.get("/pricing", getPricing);

export { pricingRouter };
