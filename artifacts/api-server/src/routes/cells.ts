import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";

const router: IRouter = Router();

export const TOTAL_CELLS = 1_000_000;
export const RESERVATION_TTL_MS = 5 * 60 * 1000;
export const PRICE_CENTS = 50;

const ACTIVE_LIMIT = 5;
const ATTEMPT_LIMIT = 12;
const WINDOW_MS = 60_000;
const ESCALATION_WINDOW_MS = 10 * 60_000;
const ESCALATION_THRESHOLD = 3;
const RAPID_CLICK_MS = 1_500;

type Counter = { startedAt: number; attempts: number };
type Escalation = { startedAt: number; hits: number };
type Behavior = { lastAt: number; rapidHits: number };

const ipCounters = new Map<string, Counter>();
const deviceCounters = new Map<string, Counter>();
const escalations = new Map<string, Escalation>();
const behaviorByNetwork = new Map<string, Behavior>();
const activeReservations = new Map<
  number,
  { ip: string; deviceId: string; expiresAt: number }
>();

function numericId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id >= 0 && id < TOTAL_CELLS ? id : null;
}

function clientIp(request: Request) {
  // Express req.ip is only trusted for the configured number of proxy hops.
  return request.ip || request.socket.remoteAddress || "unknown";
}

function ipNetwork(ip: string) {
  const normalized = ip.replace(/^::ffff:/, "");
  if (normalized.includes(":")) return normalized.split(":").slice(0, 4).join(":");
  const parts = normalized.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : normalized;
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

function checkBehavioralLimit(request: Request) {
  const key = `network:${ipNetwork(clientIp(request))}`;
  const now = Date.now();
  const current = behaviorByNetwork.get(key);
  if (!current || now - current.lastAt >= WINDOW_MS) {
    behaviorByNetwork.set(key, { lastAt: now, rapidHits: 0 });
    return false;
  }
  const wasTooFast = now - current.lastAt < RAPID_CLICK_MS;
  current.lastAt = now;
  if (wasTooFast) current.rapidHits += 1;
  if (current.rapidHits >= ATTEMPT_LIMIT) {
    registerLimitHit(key);
    return true;
  }
  return false;
}

function checkReserveLimit(request: Request, deviceId: string) {
  const now = Date.now();
  pruneActiveReservations(now);
  const ip = clientIp(request);
  const ipKey = `ip:${ip}`;
  const deviceKey = `device:${deviceId}`;
  const networkKey = `network:${ipNetwork(ip)}`;
  const ipCounter = cleanCounter(ipCounters.get(ipKey), now);
  const deviceCounter = cleanCounter(deviceCounters.get(deviceKey), now);
  ipCounters.set(ipKey, ipCounter);
  deviceCounters.set(deviceKey, deviceCounter);

  if (
    captchaRequired(ipKey) ||
    captchaRequired(deviceKey) ||
    captchaRequired(networkKey)
  ) {
    return {
      code: 428,
      message: "Verificação adicional necessária",
      captcha: true,
    };
  }

  const activeForIp = [...activeReservations.values()].filter(
    (item) => item.ip === ip,
  ).length;
  const activeForDevice = [...activeReservations.values()].filter(
    (item) => item.deviceId === deviceId,
  ).length;
  if (
    ipCounter.attempts >= ATTEMPT_LIMIT ||
    activeForIp >= ACTIVE_LIMIT ||
    activeForDevice >= ACTIVE_LIMIT ||
    checkBehavioralLimit(request)
  ) {
    registerLimitHit(ipKey);
    registerLimitHit(deviceKey);
    registerLimitHit(networkKey);
    return {
      code: 429,
      message: "Muitas tentativas, aguarde e tente novamente",
    };
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

function parseToken(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
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
  response.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3, stale-while-revalidate=5",
  );
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
    `SELECT c.id, c.status, c.emoji, c.revealed_by, c.prize_value_cents,
            s.platform, s.handle
       FROM cells c
       LEFT JOIN cell_signatures s
         ON s.cell_id = c.id AND s.moderation_status = 'approved'
      WHERE c.id = $1`,
    [id],
  );
  const cell = result.rows[0];
  if (!cell || cell.status === "expired" || cell.status === "reserved") {
    response.json({ id, status: "available" });
    return;
  }
  response.json({
    id,
    status: cell.status,
    emoji: cell.emoji,
    prizeValueCents: Number(cell.prize_value_cents ?? 0),
    revealedBy: cell.revealed_by,
    signature: cell.handle
      ? { platform: cell.platform, handle: cell.handle }
      : null,
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
             prize_value_cents = 0,
             emoji = NULL,
             revealed_by = NULL,
             certificate_sent_at = NULL
       WHERE cells.status = 'expired'
       RETURNING id, reservation_token`,
      [id],
    );
    if (result.rows.length === 0) {
      response.status(409).json({ error: "Célula já reservada ou revelada" });
      return;
    }

    // A checkout from a previous expired reservation must never be reused.
    await pool.query(
      `UPDATE payments SET status = 'failed'
       WHERE cell_id = $1 AND status = 'pending'`,
      [id],
    );
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
  const token = parseToken(request.body?.token);
  const email =
    typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
  const deviceId = parseDeviceId(request.body?.deviceId);
  if (
    cellId === null ||
    !token ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    response
      .status(400)
      .json({ error: "Reserva inválida, e-mail ou token incorreto" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE cells SET email = $1
       WHERE id = $2 AND reservation_token = $3 AND status = 'reserved'
       RETURNING id`,
      [email, cellId, token],
    );
    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      response
        .status(400)
        .json({ error: "Reserva inválida, expirada ou token incorreto" });
      return;
    }

    const existing = await client.query(
      `SELECT checkout_url FROM payments
       WHERE cell_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [cellId],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      response.json({ checkoutUrl: existing.rows[0].checkout_url });
      return;
    }

    const providerPaymentId = `local_${randomUUID()}`;
    const checkoutUrl = `/api/checkout/local/${providerPaymentId}`;
    await client.query(
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
    await client.query("COMMIT");
    response.json({ checkoutUrl });
  } catch (error) {
    await client.query("ROLLBACK");
    request.log?.error({ error }, "Could not create checkout");
    response.status(500).json({ error: "Não foi possível criar o checkout" });
  } finally {
    client.release();
  }
});

router.post("/cells/sign", async (request, response) => {
  const cellId = numericId(request.body?.cellId);
  const token = parseToken(request.body?.token);
  const platform = request.body?.platform;
  const handle =
    typeof request.body?.handle === "string"
      ? request.body.handle.trim().replace(/^@/, "").toLowerCase()
      : "";
  if (
    cellId === null ||
    !token ||
    (platform !== "instagram" && platform !== "x") ||
    !/^[a-z0-9._]{1,30}$/.test(handle)
  ) {
    response.status(400).json({ error: "Rede, username ou reserva inválidos" });
    return;
  }

  const owned = await pool.query(
    `SELECT id FROM cells
     WHERE id = $1 AND reservation_token = $2 AND status = 'paid'`,
    [cellId, token],
  );
  if (owned.rows.length === 0) {
    response
      .status(400)
      .json({ error: "Reserva inválida ou pagamento não confirmado" });
    return;
  }
  const inserted = await pool.query(
    `INSERT INTO cell_signatures (cell_id, platform, handle, moderation_status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (cell_id) DO NOTHING
     RETURNING cell_id`,
    [cellId, platform, handle],
  );
  if (inserted.rows.length === 0) {
    response.status(409).json({
      error:
        "Esta célula já tem uma assinatura registrada. Para alterar ou remover, entre em contato com o suporte.",
    });
    return;
  }
  response.status(200).json({ ok: true, status: "pending" });
});

router.get("/checkout/local/:paymentId", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    response.status(404).send("Not found");
    return;
  }
  const payment = await pool.query(
    `SELECT cell_id, checkout_url, status FROM payments
     WHERE provider_payment_id = $1`,
    [request.params.paymentId],
  );
  if (!payment.rows[0]) {
    response.status(404).json({ error: "Cobrança não encontrada" });
    return;
  }
  response.json({
    mode: "development",
    paymentId: request.params.paymentId,
    cellId: payment.rows[0].cell_id,
    status: payment.rows[0].status,
    message: "Checkout local de desenvolvimento. Use a simulação no app.",
  });
});

router.post("/checkout/local/:paymentId/confirm", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    response.status(404).send("Not found");
    return;
  }
  const payment = await pool.query(
    `SELECT cell_id FROM payments
     WHERE provider_payment_id = $1 AND status = 'pending'`,
    [request.params.paymentId],
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
    paymentId: request.params.paymentId,
    cellId,
    token: String(token),
    payload: {
      paymentId: request.params.paymentId,
      referenciaExterna: { cellId, token },
      source: "local-development",
    },
  });
  response.json({ ok: true, cellId });
});

export async function expireReservations() {
  await pool.query(
    `UPDATE cells SET status = 'expired'
     WHERE status = 'reserved'
       AND reserved_at < NOW() - INTERVAL '5 minutes'`,
  );
  pruneActiveReservations(Date.now());
}

export default router;