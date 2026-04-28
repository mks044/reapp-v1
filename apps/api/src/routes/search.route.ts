import { Router } from "express";
import { postSearch } from "../controllers/search.controller.js";
import { requireX402Payment } from "../middleware/requireX402Payment.js";
import { capturePaymentResponse } from "../middleware/capturePaymentResponse.js";

const searchRouter = Router();

searchRouter.use(requireX402Payment);
searchRouter.use(capturePaymentResponse);
searchRouter.post("/search", postSearch);
searchRouter.post("/capabilities/search", postSearch);

export { searchRouter };
