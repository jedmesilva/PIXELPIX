import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual, randomInt } from "node:crypto";
import { pool } from "@workspace/db";
import { PRICE_CENTS } from "./cells";
import { releaseActiveReservationByCell } from "./cells";

const router: IRouter = Router();
const EMOJIS = ["🌟", "🔥", "🌊", "🍀", "⚡", "🎯", "🪐", "🌙", "🦋", "🍁", "🌵", "🐚", "🍄", "🎈", "🧿", "🪁", "🌈", "🍉", "🦖", "🎲"];
const alertByCell = new Map<number, number>();
let alertsThisHour = 0;
let alertWindowStartedAt = Date.now();

function alertOperationsWithLimit(cellId: number, paymentId: string) {
  const now = Date.now();
  if (now - alertWindowStartedAt >= 60 * 60_000) {
    alertWindowStartedAt = now;
    alertsThisHour = 0;
  }
  const lastAlert = alertByCell.get(cellId) ?? 0;
  if (now - lastAlert < 10 * 60_000 || alertsThisHour >= 100) return;
  alertByCell.set(cellId, now);
  alertsThisHour += 1;
  // This is the bounded operational notification hook. A production deployment
  // can replace the log with its incident connector without changing the flow.
  console.warn(
    JSON.stringify({
      event: "stale_token_conflict",
      cellId,
      paymentId,
      alertSuppressedAfterHourlyLimit: false,
    }),
  );
}

function validSignature(rawBody: Buffer, signature: unknown) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string") return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

async function pickPrize(client: { query: Function }) {
  const result = await client.query(
    `SELECT id, label, weight, stock, value_cents
     FROM prizes
     WHERE active = true AND weight > 0 AND (stock IS NULL OR stock > 0)
     FOR UPDATE`,
  );
  if (!result.rows.length) {
    throw new Error("No active prizes available");
  }
  const totalWeight = result.rows.reduce(
    (sum: number, prize: { weight: number }) => sum + prize.weight,
    0,
  );
  let cursor = randomInt(totalWeight);
  const prize = result.rows.find((candidate: { weight: number }) => {
    cursor -= candidate.weight;
    return cursor < 0;
  }) ?? result.rows[0];
  if (prize.stock !== null) {
    await client.query(
      `UPDATE prizes SET stock = stock - 1 WHERE id = $1 AND stock > 0`,
      [prize.id],
    );
  }
  return prize;
}

export async function processPaymentConfirmed(input: {
  paymentId: string;
  cellId: number;
  token: string;
  payload: unknown;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const marked = await client.query(
      `UPDATE cells
       SET status = 'paid_pending_prize', payment_id = $1
       WHERE id = $2 AND reservation_token = $3
         AND status IN ('reserved', 'expired')
       RETURNING email`,
      [input.paymentId, input.cellId, input.token],
    );
    if (!marked.rows.length) {
      const current = await client.query(
        `SELECT payment_id FROM cells WHERE id = $1`,
        [input.cellId],
      );
      if (current.rows[0]?.payment_id === input.paymentId) {
        await client.query("ROLLBACK");
        return { result: "duplicate" as const };
      }
      await client.query(
        `INSERT INTO webhook_events
         (payment_id, cell_id, payload, signature_valid, result)
         VALUES ($1, $2, $3, true, 'stale_token_conflict')`,
        [input.paymentId, input.cellId, input.payload],
      );
      await client.query("COMMIT");
      alertOperationsWithLimit(input.cellId, input.paymentId);
      return { result: "stale_token_conflict" as const };
    }

    const prize = await pickPrize(client);
    const emoji = EMOJIS[randomInt(EMOJIS.length)];
    await client.query(
      `UPDATE cells SET status = 'paid', prize_id = $1, emoji = $2,
       revealed_by = 'você' WHERE id = $3`,
      [prize.id, emoji, input.cellId],
    );
    const payment = await client.query(
      `UPDATE payments
       SET status = 'confirmed', confirmed_at = NOW()
       WHERE provider_payment_id = $1
       RETURNING amount_cents`,
      [input.paymentId],
    );
    const amountCents = payment.rows[0]?.amount_cents ?? PRICE_CENTS;
    await client.query(
      `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
       VALUES ('revenue', $1, $2)
       ON CONFLICT (entry_type, cell_id) DO NOTHING`,
      [input.cellId, amountCents],
    );
    if (prize.value_cents > 0) {
      await client.query(
        `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
         VALUES ('prize_payout', $1, $2)
         ON CONFLICT (entry_type, cell_id) DO NOTHING`,
        [input.cellId, prize.value_cents],
      );
    }
    await client.query(
      `INSERT INTO webhook_events
       (payment_id, cell_id, payload, signature_valid, result)
       VALUES ($1, $2, $3, true, 'processed')`,
      [input.paymentId, input.cellId, input.payload],
    );
    await client.query("COMMIT");
    releaseActiveReservationByCell(input.cellId);
    // Real email delivery is intentionally outside the transaction.
    await pool.query(
      `UPDATE cells SET certificate_sent_at = NOW()
       WHERE id = $1 AND status = 'paid' AND certificate_sent_at IS NULL`,
      [input.cellId],
    );
    return { result: "processed" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

router.post("/webhook/payment-confirmed", async (request, response) => {
  const rawBody =
    (request as typeof request & { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(request.body));
  const signatureOk = validSignature(
    rawBody,
    request.headers["x-webhook-signature"],
  );
  const paymentId =
    typeof request.body?.paymentId === "string" ? request.body.paymentId : "unknown";
  try {
    const reference =
      typeof request.body?.referenciaExterna === "string"
        ? JSON.parse(request.body.referenciaExterna)
        : request.body?.reference;
    const cellId = Number(reference?.cellId);
    const token = typeof reference?.token === "string" ? reference.token : "";
    if (!signatureOk) {
      await pool.query(
        `INSERT INTO webhook_events
         (payment_id, cell_id, payload, signature_valid, result)
         VALUES ($1, $2, $3, false, 'invalid_signature')`,
        [paymentId, Number.isInteger(cellId) ? cellId : null, request.body],
      );
      response.status(401).send("Assinatura inválida");
      return;
    }
    if (!Number.isInteger(cellId) || !/^[0-9a-f-]{36}$/i.test(token)) {
      response.status(400).send("Referência externa inválida");
      return;
    }
    await processPaymentConfirmed({
      paymentId,
      cellId,
      token,
      payload: request.body,
    });
    response.status(200).send("OK");
  } catch (error) {
    request.log?.error({ error }, "Payment webhook failed");
    response.status(500).send("Erro interno");
  }
});

export default router;