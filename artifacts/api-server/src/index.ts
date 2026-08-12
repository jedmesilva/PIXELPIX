import app from "./app";
import { logger } from "./lib/logger";
import { expireReservations } from "./routes/cells";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  await pool.query(`
    INSERT INTO payout_safety_config (id, safety_margin_bps, updated_by)
    VALUES (1, 2000, 'setup-inicial')
    ON CONFLICT (id) DO NOTHING
  `);
  await expireReservations();
  setInterval(() => {
    void expireReservations().catch((error) =>
      logger.error({ error }, "Reservation expiration failed"),
    );
  }, 30_000);
  app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  });
}

void start().catch((error) => {
  logger.error({ error }, "Server startup failed");
  process.exit(1);
});
