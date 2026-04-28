import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { healthRouter } from "./routes/health.route.js";
import { searchRouter } from "./routes/search.route.js";
import { pricingRouter } from "./routes/pricing.route.js";
import { usageRouter } from "./routes/usage.route.js";
import { paymentRouter } from "./routes/payment.route.js";
import { agentRouter } from "./routes/agent.route.js";
import { mandateRouter } from "./routes/mandate.route.js";
import { logger } from "./lib/logger.js";
import { ALLOWED_ORIGINS } from "./constants/cors.js";
import { globalRateLimiter } from "./middleware/rateLimit.js";

const app = express();

logger.debug("Creating Express application...");

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      logger.debug(
        {
          origin: origin ?? null
        },
        "Evaluating CORS origin"
      );

      if (!origin) {
        logger.debug("Allowing request with no origin header");
        callback(null, true);
        return;
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        logger.info(
          {
            origin
          },
          "CORS origin allowed"
        );
        callback(null, true);
        return;
      }

      logger.warn(
        {
          origin
        },
        "CORS origin rejected"
      );

      callback(new Error("Not allowed by CORS"));
    },
    exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"]
  })
);

app.use(globalRateLimiter);
app.use(express.json({ limit: "1mb" }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(
    {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip
    },
    "Incoming request"
  );
  next();
});

app.use("/api", healthRouter);
app.use("/api", searchRouter);
app.use("/api", pricingRouter);
app.use("/api", usageRouter);
app.use("/api", paymentRouter);
app.use("/api", agentRouter);
app.use("/api", mandateRouter);

app.use((req: Request, res: Response) => {
  logger.warn(
    {
      method: req.method,
      path: req.path
    },
    "Route not found"
  );

  res.status(404).json({
    ok: false,
    error: "Route not found"
  });
});

export { app };
