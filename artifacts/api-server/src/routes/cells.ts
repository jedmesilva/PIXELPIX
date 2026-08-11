import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const TOTAL_CELLS = 1_000_000;
const RESERVATION_TTL_MS = 5 * 60 * 1000;
const PRICE_CENTS = 50;
const ACTIVE_LIMIT = 5;
const ATTEMPT_LIMIT = 12;
const WINDOW_MS = 60_000;
const ESCALATION_WINDOW_MS = 10 * 60_000;
const ESCALATION_THRESHOLD = 3;

type Counter = { startedAt: number; attempts: number };
type Escalation = { startedAt: number; hits: number };
const ipCounters = new Map<string, Counter>();
const deviceCounters = new Map<string, Counter>();
const escalations = new Map<string, Escalation>();
const activeReservations = new Map<
  number,
  { ip: string; deviceId: string; expiresAt: number }
>();

function numericId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id >= 0 && id < TOTAL_CELLS ? id : null;
}

function clientIp(request: Request) {
  // Express req.ip is trustworthy only after trust proxy is explicitly configured.
  return request.ip || request.socket.remoteAddress || "unknown";
}

function cleanCounter(counter: Counter | undefined, now: number): Counter {
  if (!counter || now - counter.startedAt >= WINDOW_MS) {
    return { startedAt: now, attempts: 0 };
  }
  return counter;
}

function pruneActiveReservations(now: number) {
  for (const [cellId, reservation] of activeReservations) {
    if (reservation.expiresAt <= now) activeReservations.delete(cellId);
  }
}

function registerLimitHit(key: string) {
  const now = Date.now();
  const current = escalations.get(key);
  if (!current || now - current.startedAt >= ESCALATION_WINDOW_MS) {
    escalations.set(key, { startedAt: now, hits: 1 });
    return;
  }
  current.hits += 1;
}

function captchaRequired(key: string) {
  const current = escalations.get(key);
  return Boolean(
    current &&
      Date.now() - current.startedAt < ESCALATION_WINDOW_MS &&
      current.hits >= ESCALATION_THRESHOLD,
  );
}

function checkReserveLimit(request: Request, deviceId: string) {
  const now = Date.now();
  pruneActiveReservations(now);
  const ipKey = `ip:${clientIp(request)}`;
  const deviceKey = `device:${deviceId}`;
  const ipCounter = cleanCounter(ipCounters.get(ipKey), now);
  const deviceCounter = cleanCounter(deviceCounters.get(deviceKey), now);
  ipCounters.set(ipKey, ipCounter);
  deviceCounters.set(deviceKey, deviceCounter);

  if (captchaRequired(ipKey) || captchaRequired(deviceKey)) {
    return { code: 428, message: "Verificação adicional necessária", captcha: true };
  }

  if (
    ipCounter.attempts >= ATTEMPT_LIMIT ||
    [...activeReservations.values()].filter((item) => item.ip === clientIp(request))
      .length >= ACTIVE_LIMIT ||
    [...activeReservations.values()].filter((item) => item.deviceId === deviceId)
      .length >= ACTIVE_LIMIT
  ) {
    registerLimitHit(ipKey);
    registerLimitHit(deviceKey);
    return { code: 429, message: "Muitas tentativas, aguarde e tente novamente" };
  }

  ipCounter.attempts += 1;
  deviceCounter.attempts += 1;
  return null;
}

export function releaseActiveReservationByCell(cellId: number) {
  activeReservations.delete(cellId);
}

function parseDeviceId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(value)
    ? value
    : null;
}

router.get("/cells", async (request, response) => {
  const from = numericId(request.query.from);
  const to = numericId(request.query.to);
  if (from === null || to === null || to < from || to - from > 10_000) {
    response.status(400).json({ error: "Intervalo de células inválido" });
    return;
  }

  const rows = await pool.query(
    `SELECT id, status FROM cells WHERE id BETWEEN $1 AND $2`,
    [from, to],
  );
  const existing = new Map(
    rows.rows.map((row: { id: number; status: string }) => [
      row.id,
      row.status === "expired" ? "available" : row.status,
    ]),
  );
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3, stale-while-revalidate=5");
  response.json(
    Array.from({ length: to - from + 1 }, (_, index) => {
      const id = from + index;
      return { id, status: existing.get(id) ?? "available" };
    }),
  );
});

router.get("/cells/:id", async (request, response) => {
  const id = numericId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Id de célula inválido" });
    return;
  }
  const result = await pool.query(
    `SELECT id, status, emoji, revealed_by, social_network, social_handle, prize_id
     FROM cells WHERE id = $1`,
    [id],
  );
  const cell = result.rows[0];
  if (!cell || cell.status === "expired" || cell.status === "reserved") {
    response.json({ id, status: "available" });
    return;
  }
  const prize = cell.prize_id
    ? await pool.query(`SELECT label FROM prizes WHERE id = $1`, [cell.prize_id])
    : null;
  response.json({
    id,
    status: cell.status,
    emoji: cell.emoji,
    prizeLabel: prize?.rows[0]?.label ?? null,
    revealedBy: cell.revealed_by,
    socialProfile: cell.social_handle
      ? { network: cell.social_network, handle: cell.social_handle }
      : { network: "instagram", handle: "" },
  });
});

router.post("/cells/reserve", async (request, response) => {
  const id = numericId(request.body?.id);
  const deviceId = parseDeviceId(request.body?.deviceId);
  if (id === null || !deviceId) {
    response.status(400).json({ error: "id e deviceId são obrigatórios" });
    return;
  }
  const limit = checkReserveLimit(request, deviceId);
  if (limit) {
    response.status(limit.code).json({
      error: limit.message,
      ...(limit.captcha ? { captchaRequired: true } : {}),
    });
    return;
  }

  const ip = clientIp(request);
  try {
    const result = await pool.query(
      `INSERT INTO cells (id, status)
       VALUES ($1, 'reserved')
       ON CONFLICT (id) DO UPDATE
         SET reservation_token = gen_random_uuid(),
             email = NULL,
             status = 'reserved',
             reserved_at = NOW(),
             payment_id = NULL,
             prize_id = NULL,
             emoji = NULL,
             revealed_by = NULL,
             social_network = NULL,
             social_handle = NULL,
             certificate_sent_at = NULL
       WHERE cells.status = 'expired'
       RETURNING id, reservation_token`,
      [id],
    );
    if (result.rows.length === 0) {
      response.status(409).json({ error: "Célula já reservada ou revelada" });
      return;
    }
    activeReservations.set(id, {
      ip,
      deviceId,
      expiresAt: Date.now() + RESERVATION_TTL_MS,
    });
    response.json({
      cellId: result.rows[0].id,
      token: result.rows[0].reservation_token,
    });
  } catch (error) {
    request.log?.error({ error }, "Could not reserve cell");
    response.status(500).json({ error: "Não foi possível reservar a célula" });
  }
});

router.post("/cells/email", async (request, response) => {
  const cellId = numericId(request.body?.cellId);
  const token = typeof request.body?.token === "string" ? request.body.token : "";
  const email =
    typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
  const deviceId = parseDeviceId(request.body?.deviceId);
  if (
    cellId === null ||
    !/^[0-9a-f-]{36}$/i.test(token) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    response.status(400).json({ error: "Reserva inválida, e-mail ou token incorreto" });
    return;
  }

  const updated = await pool.query(
    `UPDATE cells SET email = $1
     WHERE id = $2 AND reservation_token = $3 AND status = 'reserved'
     RETURNING id`,
    [email, cellId, token],
  );
  if (updated.rows.length === 0) {
    response.status(400).json({ error: "Reserva inválida, expirada ou token incorreto" });
    return;
  }

  const existing = await pool.query(
    `SELECT checkout_url FROM payments
     WHERE cell_id = $1 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [cellId],
  );
  if (existing.rows[0]) {
    response.json({ checkoutUrl: existing.rows[0].checkout_url });
    return;
  }

  const providerPaymentId = `local_${randomUUID()}`;
  const checkoutUrl = `/api/checkout/local/${providerPaymentId}`;
  await pool.query(
    `INSERT INTO payments
       (cell_id, provider_payment_id, checkout_url, amount_cents, status,
        device_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)`,
    [
      cellId,
      providerPaymentId,
      checkoutUrl,
      PRICE_CENTS,
      deviceId,
      clientIp(request),
      request.get("user-agent") ?? null,
    ],
  );
  response.json({ checkoutUrl });
});

router.get("/checkout/local/:paymentId", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    response.status(404).send("Not found");
    return;
  }
  const paymentId = request.params.paymentId;
  const payment = await pool.query(
    `SELECT cell_id, checkout_url, status FROM payments WHERE provider_payment_id = $1`,
    [paymentId],
  );
  if (!payment.rows[0]) {
    response.status(404).json({ error: "Cobrança não encontrada" });
    return;
  }
  response.json({
    mode: "development",
    paymentId,
    cellId: payment.rows[0].cell_id,
    status: payment.rows[0].status,
    message: "Checkout local de desenvolvimento. Use o botão de simulação no app.",
  });
});

router.post("/checkout/local/:paymentId/confirm", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    response.status(404).send("Not found");
    return;
  }
  const paymentId = request.params.paymentId;
  const payment = await pool.query(
    `SELECT cell_id FROM payments WHERE provider_payment_id = $1 AND status = 'pending'`,
    [paymentId],
  );
  const cellId = payment.rows[0]?.cell_id;
  if (!cellId) {
    response.status(404).json({ error: "Cobrança pendente não encontrada" });
    return;
  }
  const cell = await pool.query(
    `SELECT reservation_token FROM cells WHERE id = $1`,
    [cellId],
  );
  const token = cell.rows[0]?.reservation_token;
  if (!token) {
    response.status(409).json({ error: "Reserva não encontrada" });
    return;
  }
  const { processPaymentConfirmed } = await import("./webhook");
  await processPaymentConfirmed({
    paymentId,
    cellId,
    token: String(token),
    payload: { paymentId, referenciaExterna: { cellId, token }, source: "local-development" },
  });
  response.json({ ok: true, cellId });
});

export async function expireReservations() {
  await pool.query(
    `UPDATE cells SET status = 'expired'
     WHERE status = 'reserved'
       AND reserved_at < NOW() - INTERVAL '5 minutes'`,
  );
}

export { PRICE_CENTS };
export default router;