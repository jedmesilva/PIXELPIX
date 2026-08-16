import { Router, type IRouter, type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  GetAdminPrizePoolResponse,
  GetAdminRedemptionParams,
  GetAdminRedemptionResponse,
  GetAdminOverviewResponse,
  ListAdminRedemptionsQueryParams,
  ListAdminRedemptionsResponse,
  UpdateAdminRedemptionBody,
  UpdateAdminRedemptionParams,
  UpdateAdminRedemptionResponse,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function sameSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

const requireAdmin: RequestHandler = (request, response, next) => {
  const configuredKey = process.env.ADMIN_ACCESS_KEY;
  if (!configuredKey && process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  if (!configuredKey) {
    response.status(503).json({ error: "Admin access is not configured" });
    return;
  }

  const providedKey = request.header("x-admin-access-key") ?? "";
  if (!sameSecret(providedKey, configuredKey)) {
    response.status(401).json({ error: "Admin access key is invalid" });
    return;
  }

  next();
};

function iso(value: unknown) {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value as string | number).toISOString();
}

function mapRedemption(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    cellId: Number(row.cell_id),
    email: String(row.email),
    pixKey: String(row.pix_key),
    certificateCode: String(row.certificate_code),
    requestedAmountCents: Number(row.requested_amount_cents),
    prizeValueCents: Number(row.prize_value_cents),
    wonAt: iso(row.won_at)!,
    status: String(row.status),
    requestedAt: iso(row.requested_at)!,
    processedAt: iso(row.processed_at),
    processedBy: row.processed_by ? String(row.processed_by) : null,
    rejectionReason: row.rejection_reason
      ? String(row.rejection_reason)
      : null,
    cellStatus: row.cell_status ? String(row.cell_status) : null,
    paymentStatus: row.payment_status ? String(row.payment_status) : null,
  };
}

router.use(requireAdmin);

router.get("/admin/overview", async (request, response): Promise<void> => {
  const result = await pool.query(`
    SELECT
      COALESCE((SELECT SUM(remaining_value_cents) FROM prize_pool), 0) AS available_prize_balance_cents,
      COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type = 'prize_payout'), 0) AS distributed_prize_cents,
      COALESCE((SELECT SUM(requested_amount_cents) FROM prize_redemption_requests WHERE status = 'paid'), 0) AS redeemed_prize_cents,
      COALESCE((SELECT SUM(total_value_cents) FROM prize_pool), 0) AS total_prize_to_distribute_cents,
      COALESCE((SELECT SUM(requested_amount_cents) FROM prize_redemption_requests WHERE status IN ('pending', 'approved')), 0) AS pending_redemption_cents,
      COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type = 'revenue'), 0) AS gross_revenue_cents,
      COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type = 'refund'), 0) AS refunds_cents,
      GREATEST(
        0,
        COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type = 'revenue'), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type IN ('refund', 'prize_payout')), 0)
      ) AS cash_available_cents,
      (SELECT COUNT(*) FROM cells WHERE status = 'available') AS available_cells,
      (SELECT COUNT(*) FROM cells WHERE status IN ('reserved', 'paid_pending_prize')) AS reserved_cells,
      (SELECT COUNT(*) FROM cells WHERE status = 'paid') AS paid_cells,
      (SELECT COUNT(*) FROM winning_positions WHERE claimed = true) AS winners_count,
      COALESCE((SELECT jsonb_object_agg(status, count) FROM (
        SELECT status, COUNT(*)::int AS count
        FROM prize_redemption_requests
        GROUP BY status
      ) redemption_counts), '{}'::jsonb) AS redemption_counts
  `);
  const row = result.rows[0];
  const data = {
    availablePrizeBalanceCents: Number(row.available_prize_balance_cents),
    distributedPrizeCents: Number(row.distributed_prize_cents),
    redeemedPrizeCents: Number(row.redeemed_prize_cents),
    totalPrizeToDistributeCents: Number(row.total_prize_to_distribute_cents),
    pendingRedemptionCents: Number(row.pending_redemption_cents),
    grossRevenueCents: Number(row.gross_revenue_cents),
    refundsCents: Number(row.refunds_cents),
    cashAvailableCents: Number(row.cash_available_cents),
    availableCells: Number(row.available_cells),
    reservedCells: Number(row.reserved_cells),
    paidCells: Number(row.paid_cells),
    winnersCount: Number(row.winners_count),
    redemptionCounts: Object.fromEntries(
      Object.entries(row.redemption_counts as Record<string, number>).map(
        ([key, value]) => [key, Number(value)],
      ),
    ),
    generatedAt: new Date().toISOString(),
  };
  response.json(GetAdminOverviewResponse.parse(data));
});

router.get("/admin/redemptions", async (request, response): Promise<void> => {
  const parsed = ListAdminRedemptionsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, search, limit, offset } = parsed.data;
  const params: Array<string | number> = [];
  const conditions: string[] = [];
  if (status && status !== "all") {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (search) {
    params.push(search);
    conditions.push(
      `(r.email ILIKE '%' || $${params.length} || '%' OR r.pix_key ILIKE '%' || $${params.length} || '%' OR r.certificate_code ILIKE '%' || $${params.length} || '%' OR CAST(r.cell_id AS text) = $${params.length})`,
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM prize_redemption_requests r ${where}`,
    params,
  );
  params.push(limit ?? 50, offset ?? 0);
  const rows = await pool.query(
    `SELECT r.*, c.status AS cell_status, p.status AS payment_status
     FROM prize_redemption_requests r
     LEFT JOIN cells c ON c.id = r.cell_id
     LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
     ${where}
     ORDER BY r.requested_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  response.json(
    ListAdminRedemptionsResponse.parse({
      items: rows.rows.map(mapRedemption),
      total: Number(countResult.rows[0]?.total ?? 0),
    }),
  );
});

router.get("/admin/redemptions/:id", async (request, response): Promise<void> => {
  const parsed = GetAdminRedemptionParams.safeParse(request.params);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await pool.query(
    `SELECT r.*, c.status AS cell_status, p.status AS payment_status
     FROM prize_redemption_requests r
     LEFT JOIN cells c ON c.id = r.cell_id
     LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
     WHERE r.id = $1`,
    [parsed.data.id],
  );
  const row = result.rows[0];
  if (!row) {
    response.status(404).json({ error: "Redemption request not found" });
    return;
  }
  response.json(GetAdminRedemptionResponse.parse(mapRedemption(row)));
});

router.patch("/admin/redemptions/:id", async (request, response): Promise<void> => {
  const params = UpdateAdminRedemptionParams.safeParse(request.params);
  const body = UpdateAdminRedemptionBody.safeParse(request.body);
  if (!params.success) {
    response.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    response.status(400).json({ error: body.error.message });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT status FROM prize_redemption_requests WHERE id = $1 FOR UPDATE",
      [params.data.id],
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      response.status(404).json({ error: "Redemption request not found" });
      return;
    }

    const allowed =
      (current.status === "pending" &&
        ["approved", "rejected"].includes(body.data.status)) ||
      (current.status === "approved" && body.data.status === "paid");
    if (!allowed) {
      await client.query("ROLLBACK");
      response.status(400).json({ error: "Invalid redemption status transition" });
      return;
    }

    const processedBy = request.header("x-admin-actor") ?? "admin";
    const updated = await client.query(
      `UPDATE prize_redemption_requests
       SET status = $1,
           processed_at = CASE WHEN $1 IN ('paid', 'rejected') THEN NOW() ELSE processed_at END,
           processed_by = CASE WHEN $1 IN ('paid', 'rejected') THEN $2 ELSE processed_by END,
           rejection_reason = CASE WHEN $1 = 'rejected' THEN $3 ELSE NULL END
       WHERE id = $4
       RETURNING *`,
      [
        body.data.status,
        processedBy,
        body.data.rejectionReason ?? null,
        params.data.id,
      ],
    );
    await client.query("COMMIT");
    const enriched = await pool.query(
      `SELECT r.*, c.status AS cell_status, p.status AS payment_status
       FROM prize_redemption_requests r
       LEFT JOIN cells c ON c.id = r.cell_id
       LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
       WHERE r.id = $1`,
      [params.data.id],
    );
    response.json(
      UpdateAdminRedemptionResponse.parse(mapRedemption(enriched.rows[0] ?? updated.rows[0])),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    request.log.error({ error }, "Admin redemption update failed");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/admin/prize-pool", async (_request, response): Promise<void> => {
  const [tiers, batch, safety] = await Promise.all([
    pool.query(
      `SELECT tier_id, label, nominal_value_cents, total_value_cents,
              total_positions, remaining_value_cents, remaining_positions
       FROM prize_pool ORDER BY nominal_value_cents DESC`,
    ),
    pool.query(
      `SELECT commit_hash, created_at, revealed_at
       FROM prize_tier_batch WHERE id = 1`,
    ),
    pool.query(
      `SELECT safety_margin_bps FROM payout_safety_config WHERE id = 1`,
    ),
  ]);
  const batchRow = batch.rows[0];
  response.json(
    GetAdminPrizePoolResponse.parse({
      tiers: tiers.rows.map((row) => ({
        tierId: Number(row.tier_id),
        label: String(row.label),
        nominalValueCents: Number(row.nominal_value_cents),
        totalValueCents: Number(row.total_value_cents),
        totalPositions: Number(row.total_positions),
        remainingValueCents: Number(row.remaining_value_cents),
        remainingPositions: Number(row.remaining_positions),
      })),
      commitHash: batchRow?.commit_hash ?? null,
      batchCreatedAt: iso(batchRow?.created_at),
      batchRevealedAt: iso(batchRow?.revealed_at),
      safetyMarginBps:
        safety.rows[0]?.safety_margin_bps == null
          ? null
          : Number(safety.rows[0].safety_margin_bps),
    }),
  );
});

export default router;