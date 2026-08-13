import { Router, type IRouter } from "express";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { releaseActiveReservationByCell } from "./cells";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const MAX_DIRECT_ALERTS_PER_HOUR = 100;
const ALERT_DEDUP_WINDOW_MS = 10 * 60_000;
const alertByCell = new Map<number, number>();
let alertsThisHour = 0;
let alertWindowStartedAt = Date.now();

async function alertOperationsWithLimit(cellId: number, paymentId: string) {
  const now = Date.now();
  if (now - alertWindowStartedAt >= 60 * 60_000) {
    alertWindowStartedAt = now;
    alertsThisHour = 0;
  }
  const lastAlert = alertByCell.get(cellId) ?? 0;
  if (
    now - lastAlert < ALERT_DEDUP_WINDOW_MS ||
    alertsThisHour >= MAX_DIRECT_ALERTS_PER_HOUR
  ) {
    return;
  }
  alertByCell.set(cellId, now);
  alertsThisHour += 1;
  const payment = await pool.query(
    `SELECT ip_address, device_id FROM payments
     WHERE provider_payment_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [paymentId],
  );
  logger.warn(
    {
      event: "stale_token_conflict",
      cellId,
      paymentId,
      ipAddress: payment.rows[0]?.ip_address ?? null,
      deviceId: payment.rows[0]?.device_id ?? null,
      alertSuppressedAfterHourlyLimit: false,
    },
    "Payment requires manual review",
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

async function calculateAvailableCash(client: { query: Function }) {
  const result = await client.query(
    `SELECT
       COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'revenue'), 0)
       - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'prize_payout'), 0)
       - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'refund'), 0)
       AS balance_cents
     FROM cash_ledger`,
  );
  return Number(result.rows[0]?.balance_cents ?? 0);
}

async function recordWebhookEvent(
  paymentId: string,
  cellId: number | null,
  payload: unknown,
  signatureValid: boolean,
  result: string,
) {
  await pool.query(
    `INSERT INTO webhook_events
       (payment_id, cell_id, payload, signature_valid, result)
     VALUES ($1, $2, $3, $4, $5)`,
    [paymentId, cellId, payload, signatureValid, result],
  );
}

async function safeRecordWebhookEvent(
  paymentId: string,
  cellId: number | null,
  payload: unknown,
  signatureValid: boolean,
  result: string,
) {
  try {
    await recordWebhookEvent(paymentId, cellId, payload, signatureValid, result);
  } catch (error) {
    logger.error(
      { error, paymentId, cellId, result },
      "Could not persist webhook audit event",
    );
  }
}

async function sendCertificateEmail(input: {
  email: string;
  cellId: number;
  prizeValueCents: number;
}) {
  const deliveryUrl = process.env.CERTIFICATE_DELIVERY_URL;
  if (!deliveryUrl) {
    logger.warn(
      { cellId: input.cellId },
      "Certificate delivery deferred; provider is not configured",
    );
    return false;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.CERTIFICATE_DELIVERY_SECRET) {
      headers.Authorization = `Bearer ${process.env.CERTIFICATE_DELIVERY_SECRET}`;
    }
    const result = await fetch(deliveryUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    if (!result.ok) {
      logger.warn(
        { cellId: input.cellId, statusCode: result.status },
        "Certificate provider rejected delivery",
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.warn({ error, cellId: input.cellId }, "Certificate delivery failed");
    return false;
  }
}

export async function deliverCertificateForCell(cellId: number) {
  const claimed = await pool.query(
    `UPDATE cells
       SET certificate_attempts = certificate_attempts + 1,
           certificate_last_attempt_at = NOW(),
           certificate_last_error = NULL
     WHERE id = $1
       AND status = 'paid'
       AND email IS NOT NULL
       AND certificate_sent_at IS NULL
       AND (
         certificate_last_attempt_at IS NULL
         OR certificate_last_attempt_at < NOW() - INTERVAL '1 minute'
       )
     RETURNING email, prize_value_cents`,
    [cellId],
  );
  if (!claimed.rows[0]) return false;

  const delivered = await sendCertificateEmail({
    email: String(claimed.rows[0].email),
    cellId,
    prizeValueCents: Number(claimed.rows[0].prize_value_cents ?? 0),
  });
  if (delivered) {
    await pool.query(
      `UPDATE cells
          SET certificate_sent_at = NOW(), certificate_last_error = NULL
        WHERE id = $1 AND status = 'paid' AND certificate_sent_at IS NULL`,
      [cellId],
    );
  } else {
    await pool.query(
      `UPDATE cells
          SET certificate_last_error = 'delivery_failed'
        WHERE id = $1 AND certificate_sent_at IS NULL`,
      [cellId],
    );
  }
  return delivered;
}

export async function processPendingCertificates() {
  const pending = await pool.query(
    `SELECT id FROM cells
      WHERE status = 'paid'
        AND email IS NOT NULL
        AND certificate_sent_at IS NULL
      ORDER BY id
      LIMIT 25`,
  );
  for (const row of pending.rows) {
    await deliverCertificateForCell(Number(row.id));
  }
}

export async function calculatePrize(
  client: { query: Function },
  cellId: number,
) {
  const winning = await client.query(
    `SELECT tier_id, claimed
     FROM winning_positions
     WHERE cell_id = $1
     FOR UPDATE`,
    [cellId],
  );
  if (!winning.rows.length) return { releasedValueCents: 0, tierId: null };
  const tierId = Number(winning.rows[0].tier_id);
  if (winning.rows[0].claimed) {
    return { releasedValueCents: 0, tierId };
  }

  const poolResult = await client.query(
    `SELECT remaining_value_cents, remaining_positions
     FROM prize_pool
     WHERE tier_id = $1
     FOR UPDATE`,
    [tierId],
  );
  const tier = poolResult.rows[0];
  if (!tier || Number(tier.remaining_positions) <= 0) {
    throw new Error(`Prize tier ${tierId} is exhausted or missing`);
  }

  const availableCashCents = await calculateAvailableCash(client);
  const configResult = await client.query(
    `SELECT safety_margin_bps FROM payout_safety_config WHERE id = 1`,
  );
  const safetyMarginBps = Number(configResult.rows[0]?.safety_margin_bps ?? 2000);
  const safetyCapCents = Math.floor(
    (availableCashCents * safetyMarginBps) / 10_000,
  );
  const fairShareCents = Math.floor(
    Number(tier.remaining_value_cents) / Number(tier.remaining_positions),
  );
  const releasedValueCents = Math.max(
    0,
    Math.min(fairShareCents, safetyCapCents),
  );

  await client.query(
    `UPDATE prize_pool
     SET remaining_value_cents = remaining_value_cents - $1,
         remaining_positions = remaining_positions - 1
     WHERE tier_id = $2`,
    [releasedValueCents, tierId],
  );
  await client.query(
    `UPDATE winning_positions
     SET claimed = true, claimed_at = NOW()
     WHERE cell_id = $1`,
    [cellId],
  );
  await client.query(
    `INSERT INTO prize_calculation_log
       (cell_id, tier_id, pool_remaining_before_cents, positions_remaining_before,
        cota_justa_cents, caixa_disponivel_cents, safety_margin_bps,
        teto_seguranca_cents, valor_liberado_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      cellId,
      tierId,
      Number(tier.remaining_value_cents),
      Number(tier.remaining_positions),
      fairShareCents,
      availableCashCents,
      safetyMarginBps,
      safetyCapCents,
      releasedValueCents,
    ],
  );
  return { releasedValueCents, tierId };
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
        await safeRecordWebhookEvent(
          input.paymentId,
          input.cellId,
          input.payload,
          true,
          "duplicate",
        );
        return { result: "duplicate" as const };
      }
      await client.query("COMMIT");
      await safeRecordWebhookEvent(
        input.paymentId,
        input.cellId,
        input.payload,
        true,
        "stale_token_conflict",
      );
      void alertOperationsWithLimit(input.cellId, input.paymentId).catch((error) =>
        logger.error({ error }, "Could not alert operations about token conflict"),
      );
      return { result: "stale_token_conflict" as const };
    }

    const payment = await client.query(
      `UPDATE payments
       SET status = 'confirmed', confirmed_at = NOW()
       WHERE provider_payment_id = $1
         AND cell_id = $2
         AND status = 'pending'
       RETURNING amount_cents`,
      [input.paymentId, input.cellId],
    );
    if (!payment.rows.length) {
      await client.query("ROLLBACK");
      await safeRecordWebhookEvent(
        input.paymentId,
        input.cellId,
        input.payload,
        true,
        "payment_not_pending",
      );
      return { result: "payment_not_pending" as const };
    }
    const revenueCents = Number(payment.rows[0].amount_cents);
    await client.query(
      `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
       VALUES ('revenue', $1, $2)
       ON CONFLICT (entry_type, cell_id) DO NOTHING`,
      [input.cellId, revenueCents],
    );

    const prize = await calculatePrize(client, input.cellId);
    await client.query(
      `UPDATE cells
       SET status = 'paid', prize_value_cents = $1, emoji = $2,
           revealed_by = 'você'
       WHERE id = $3`,
      [prize.releasedValueCents, randomEmoji(), input.cellId],
    );
    if (prize.releasedValueCents > 0) {
      await client.query(
        `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
         VALUES ('prize_payout', $1, $2)
         ON CONFLICT (entry_type, cell_id) DO NOTHING`,
        [input.cellId, prize.releasedValueCents],
      );
    }
    await client.query("COMMIT");
    releaseActiveReservationByCell(input.cellId);
    await safeRecordWebhookEvent(
      input.paymentId,
      input.cellId,
      input.payload,
      true,
      "processed",
    );
    await deliverCertificateForCell(input.cellId);
    return { result: "processed" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const EMOJIS = [
  "🌟",
  "🔥",
  "🌊",
  "🍀",
  "⚡",
  "🎯",
  "🪐",
  "🌙",
  "🦋",
  "🍁",
  "🌵",
  "🐚",
  "🍄",
  "🎈",
  "🧿",
  "🪁",
  "🌈",
  "🍉",
  "🦖",
  "🎲",
];

function randomEmoji() {
  return EMOJIS[randomInt(0, EMOJIS.length)];
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
    typeof request.body?.paymentId === "string"
      ? request.body.paymentId
      : "unknown";

  let parsedCellId: number | null = null;
  try {
    let reference: Record<string, unknown> | null = null;
    if (typeof request.body?.referenciaExterna === "string") {
      try {
        const parsed = JSON.parse(request.body.referenciaExterna);
        reference =
          parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : null;
      } catch {
        reference = null;
      }
    } else if (
      request.body?.referenciaExterna &&
      typeof request.body.referenciaExterna === "object"
    ) {
      reference = request.body.referenciaExterna as Record<string, unknown>;
    } else if (request.body?.reference && typeof request.body.reference === "object") {
      reference = request.body.reference as Record<string, unknown>;
    }
    const cellId = Number(reference?.cellId);
    parsedCellId = Number.isInteger(cellId) ? cellId : null;
    const token = typeof reference?.token === "string" ? reference.token : "";
    if (!signatureOk) {
      await safeRecordWebhookEvent(
        paymentId,
        Number.isInteger(cellId) ? cellId : null,
        request.body,
        false,
        "invalid_signature",
      );
      response.status(401).send("Assinatura inválida");
      return;
    }
    if (
      !Number.isInteger(cellId) ||
      cellId < 0 ||
      cellId >= 1_000_000 ||
      !/^[0-9a-f-]{36}$/i.test(token) ||
      !paymentId ||
      paymentId === "unknown"
    ) {
      await safeRecordWebhookEvent(
        paymentId,
        Number.isInteger(cellId) ? cellId : null,
        request.body,
        true,
        "invalid_reference",
      );
      response.status(400).send("Referência externa inválida");
      return;
    }
    const result = await processPaymentConfirmed({
      paymentId,
      cellId,
      token,
      payload: request.body,
    });
    if (result.result === "payment_not_pending") {
      response.status(200).send("OK");
      return;
    }
    response.status(200).send("OK");
  } catch (error) {
    request.log?.error({ error }, "Payment webhook failed");
    await safeRecordWebhookEvent(
      paymentId,
      parsedCellId,
      request.body,
      signatureOk,
      "error",
    );
    response.status(500).send("Erro interno");
  }
});

export default router;