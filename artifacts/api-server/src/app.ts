import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import webhookRouter from "./routes/webhook";

const app: Express = express();

const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "0");
app.set(
  "trust proxy",
  Number.isInteger(configuredProxyHops) && configuredProxyHops > 0
    ? configuredProxyHops
    : false,
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(
  express.json({
    verify: (request, _response, buffer) => {
      (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(
        buffer,
      );
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Payment providers call this public route directly. Keep the /api alias too,
// because the API artifact is also mounted behind the /api preview path.
app.use(webhookRouter);
app.use("/api", router);

export default app;
