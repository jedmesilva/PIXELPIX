import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  GetAdminPrizePoolResponse,
  ListAdminPrizePositionsQueryParams,
  ListAdminPrizePositionsResponse,
  GetAdminRedemptionParams,
  GetAdminRedemptionResponse,
  GetAdminOverviewResponse,
  AddAdminPrizeTierBody,
  AddAdminPrizeTierResponse,
  DeleteAdminPrizeTierParams,
  DrawAdminPrizeTierBody,
  ListAdminRedemptionsQueryParams,
  ListAdminRedemptionsResponse,
  UpdateAdminRedemptionBody,
  UpdateAdminRedemptionParams,
  UpdateAdminRedemptionResponse,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requireAdminAccess } from "../middlewares/require-admin-access";
import {
  hashCertificateToken,
  verifyCertificateToken,
} from "../lib/certificates";
import { sendPixTransfer } from "../lib/efi";
import {
  generatePrizeBatch,
  addPrizeTier,
  deletePrizeTier,
  drawPrizeTier,
  getPrizeBatchStatus,
  PrizeBatchAlreadyExistsError,
  PrizeBatchNotGeneratedError,
  PrizeTierConfigurationError,
} from "@workspace/prize-engine";

const router: IRouter = Router();

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
    tokenVerifiedAt: iso(row.token_verified_at),
    approvedAmountCents:
      row.approved_amount_cents == null ? null : Number(row.approved_amount_cents),
    reviewedAt: iso(row.reviewed_at),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    cellStatus: row.cell_status ? String(row.cell_status) : null,
    paymentStatus: row.payment_status ? String(row.payment_status) : null,
    payoutStatus: row.payout_status ? String(row.payout_status) : null,
    payoutProviderReference: row.payout_provider_reference
      ? String(row.payout_provider_reference)
      : null,
  };
}

// This router is mounted at /api/admin by routes/index.ts. Keeping the
// authentication boundary here means every administrative endpoint is
// protected before it reaches a handler.
router.use(requireAdminAccess);

router.get("/prize-batch", async (_request, response): Promise<void> => {
  const batch = await getPrizeBatchStatus(pool);
  response.json(batch);
});

router.post("/prize-batch/generate", async (request, response): Promise<void> => {
  if (request.body?.confirm !== true) {
    response.status(400).json({
      error: "A confirmação explícita é obrigatória para gerar o lote.",
    });
    return;
  }

  try {
    const batch = await generatePrizeBatch(pool);
    response.status(201).json(batch);
  } catch (error) {
    if (error instanceof PrizeBatchAlreadyExistsError) {
      response.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "O lote de prêmios já foi gerado e não pode ser substituído.",
        code: "prize_batch_already_generated",
      });
      return;
    }
    request.log.error({ error }, "Prize batch generation failed");
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o lote de prêmios.",
    });
  }
});

router.post("/prize-tiers", async (request, response): Promise<void> => {
  const parsed = AddAdminPrizeTierBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const tier = await addPrizeTier(pool, {
      label: parsed.data.label,
      totalValueCents: parsed.data.totalValueCents,
      nominalValueCents: parsed.data.nominalValueCents,
    });
    response.status(201).json(AddAdminPrizeTierResponse.parse(tier));
  } catch (error) {
    if (error instanceof PrizeBatchNotGeneratedError) {
      response.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof PrizeTierConfigurationError) {
      response.status(400).json({ error: error.message });
      return;
    }
    request.log.error({ error }, "Admin prize tier creation failed");
    throw error;
  }
});

router.post("/prize-tiers/:tierId/draw", async (request, response): Promise<void> => {
  const tierId = Number(request.params.tierId);
  const parsed = DrawAdminPrizeTierBody.safeParse(request.body);
  if (!Number.isInteger(tierId) || tierId <= 0 || !parsed.success) {
    response.status(400).json({
      error: parsed.success ? "Tier inválido." : parsed.error.message,
    });
    return;
  }

  try {
    const tier = await drawPrizeTier(pool, tierId);
    response.json(AddAdminPrizeTierResponse.parse(tier));
  } catch (error) {
    if (error instanceof PrizeTierConfigurationError) {
      response.status(409).json({ error: error.message });
      return;
    }
    request.log.error({ error }, "Admin prize tier draw failed");
    throw error;
  }
});

router.delete("/prize-tiers/:tierId", async (request, response): Promise<void> => {
  const parsed = DeleteAdminPrizeTierParams.safeParse(request.params);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await deletePrizeTier(pool, parsed.data.tierId);
    response.sendStatus(204);
  } catch (error) {
    if (error instanceof PrizeTierConfigurationError) {
      response.status(409).json({ error: error.message });
      return;
    }
    request.log.error({ error }, "Admin prize tier deletion failed");
    throw error;
  }
});

router.get("/overview", async (_request, response): Promise<void> => {
  const result = await pool.query(`
    SELECT
      COALESCE((SELECT SUM(remaining_value_cents) FROM prize_pool), 0) AS available_prize_balance_cents,
      COALESCE((SELECT SUM(amount_cents) FROM cash_ledger WHERE entry_type = 'prize_payout'), 0) AS distributed_prize_cents,
      COALESCE((SELECT SUM(requested_amount_cents) FROM prize_redemption_requests WHERE status = 'paid'), 0) AS redeemed_prize_cents,
      COALESCE((SELECT SUM(total_value_cents) FROM prize_pool), 0) AS total_prize_to_distribute_cents,
      COALESCE((SELECT SUM(requested_amount_cents) FROM prize_redemption_requests WHERE status IN ('pending', 'approved', 'payment_pending')), 0) AS pending_redemption_cents,
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

router.get("/redemptions", async (request, response): Promise<void> => {
  const parsed = ListAdminRedemptionsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, search, limit, offset } = parsed.data;
  const params: Array<string | number | boolean> = [];
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
            , payout.status AS payout_status
            , COALESCE(payout.provider_transaction_id, payout.provider_end_to_end_id) AS payout_provider_reference
     FROM prize_redemption_requests r
     LEFT JOIN cells c ON c.id = r.cell_id
     LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
      LEFT JOIN LATERAL (
        SELECT status, provider_transaction_id, provider_end_to_end_id
          FROM prize_payouts
         WHERE redemption_request_id = r.id
         ORDER BY requested_at DESC
         LIMIT 1
      ) payout ON true
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

router.get("/redemptions/:id", async (request, response): Promise<void> => {
  const parsed = GetAdminRedemptionParams.safeParse(request.params);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await pool.query(
    `SELECT r.*, c.status AS cell_status, p.status AS payment_status
            , payout.status AS payout_status
            , COALESCE(payout.provider_transaction_id, payout.provider_end_to_end_id) AS payout_provider_reference
     FROM prize_redemption_requests r
     LEFT JOIN cells c ON c.id = r.cell_id
     LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
      LEFT JOIN LATERAL (
        SELECT status, provider_transaction_id, provider_end_to_end_id
          FROM prize_payouts
         WHERE redemption_request_id = r.id
         ORDER BY requested_at DESC
         LIMIT 1
      ) payout ON true
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

router.patch("/redemptions/:id", async (request, response): Promise<void> => {
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
      (["pending", "failed"].includes(current.status) &&
        ["approved", "rejected"].includes(body.data.status));
    if (!allowed) {
      await client.query("ROLLBACK");
      response.status(400).json({ error: "Invalid redemption status transition" });
      return;
    }

    const processedBy = "admin-access-key";
    if (body.data.status === "approved") {
      const certificate = await client.query(
        `SELECT pc.id, pc.cell_id, pc.certificate_code, pc.token_hash,
                pc.prize_value_cents
           FROM prize_certificates pc
           INNER JOIN prize_redemption_requests r ON r.certificate_id = pc.id
          WHERE r.id = $1
          FOR UPDATE`,
        [params.data.id],
      );
      const cert = certificate.rows[0];
      const token = body.data.certificateToken?.trim() ?? "";
      const payload = verifyCertificateToken(token);
      if (
        !cert ||
        !payload ||
        payload.certificateId !== String(cert.id) ||
        payload.cellId !== Number(cert.cell_id) ||
        payload.prizeValueCents !== Number(cert.prize_value_cents) ||
        hashCertificateToken(token) !== String(cert.token_hash)
      ) {
        await client.query("ROLLBACK");
        response.status(400).json({ error: "Token do certificado inválido." });
        return;
      }
    }
    const updated = await client.query(
      `UPDATE prize_redemption_requests
       SET status = $1,
           processed_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE processed_at END,
           processed_by = CASE WHEN $1 = 'rejected' THEN $2 ELSE processed_by END,
           rejection_reason = CASE WHEN $1 = 'rejected' THEN $3 ELSE NULL END,
           approved_amount_cents = CASE
             WHEN $1 = 'approved' THEN prize_value_cents
             ELSE approved_amount_cents
           END,
           reviewed_at = NOW(),
           reviewed_by = $2
       WHERE id = $4
       RETURNING *`,
      [
        body.data.status,
        processedBy,
        body.data.rejectionReason ?? null,
        params.data.id,
      ],
    );
    await client.query(
      `INSERT INTO prize_redemption_audit
         (redemption_request_id, from_status, to_status, actor, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.data.id,
        current.status,
        body.data.status,
        processedBy,
        body.data.rejectionReason ?? "resgate aprovado para pagamento",
      ],
    );
    await client.query("COMMIT");
    const enriched = await pool.query(
      `SELECT r.*, c.status AS cell_status, p.status AS payment_status
              , payout.status AS payout_status
              , COALESCE(payout.provider_transaction_id, payout.provider_end_to_end_id) AS payout_provider_reference
       FROM prize_redemption_requests r
       LEFT JOIN cells c ON c.id = r.cell_id
       LEFT JOIN payments p ON p.cell_id = r.cell_id AND p.status = 'confirmed'
       LEFT JOIN LATERAL (
         SELECT status, provider_transaction_id, provider_end_to_end_id
           FROM prize_payouts
          WHERE redemption_request_id = r.id
          ORDER BY requested_at DESC
          LIMIT 1
       ) payout ON true
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

router.post("/redemptions/:id/payout", async (request, response): Promise<void> => {
  const params = GetAdminRedemptionParams.safeParse(request.params);
  const token =
    typeof request.body?.certificateToken === "string"
      ? request.body.certificateToken.trim()
      : "";
  const confirmPixKey = request.body?.confirmPixKey === true;
  if (!params.success || !token || !confirmPixKey) {
    response.status(400).json({
      error: "Confirme a chave Pix e informe o token do certificado.",
    });
    return;
  }

  const client = await pool.connect();
  let payoutId = "";
  let amountCents = 0;
  let pixKey = "";
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT r.*, pc.id AS certificate_id, pc.token_hash,
              pc.cell_id AS certificate_cell_id
         FROM prize_redemption_requests r
         INNER JOIN prize_certificates pc ON pc.id = r.certificate_id
        WHERE r.id = $1
        FOR UPDATE`,
      [params.data.id],
    );
    const redemption = result.rows[0];
    const payload = verifyCertificateToken(token);
    if (
      !redemption ||
      !["approved", "failed"].includes(String(redemption.status)) ||
      !payload ||
      payload.certificateId !== String(redemption.certificate_id) ||
      payload.cellId !== Number(redemption.certificate_cell_id) ||
      payload.prizeValueCents !== Number(redemption.prize_value_cents) ||
      hashCertificateToken(token) !== String(redemption.token_hash)
    ) {
      await client.query("ROLLBACK");
      response.status(400).json({ error: "Resgate, token ou status inválido." });
      return;
    }

    payoutId = randomUUID();
    amountCents = Number(redemption.approved_amount_cents ?? redemption.prize_value_cents);
    pixKey = String(redemption.pix_key);
    const idempotencyKey = `prize-redemption-${params.data.id}-${payoutId}`;
    await client.query(
      `INSERT INTO prize_payouts
         (id, redemption_request_id, idempotency_key, amount_cents, pix_key, created_by)
       VALUES ($1, $2, $3, $4, $5, 'admin-access-key')`,
      [payoutId, params.data.id, idempotencyKey, amountCents, pixKey],
    );
    await client.query(
      `UPDATE prize_redemption_requests
          SET status = 'payment_pending',
              processed_at = NOW(),
              processed_by = 'admin-access-key'
        WHERE id = $1`,
      [params.data.id],
    );
    await client.query(
      `INSERT INTO prize_redemption_audit
         (redemption_request_id, from_status, to_status, actor, reason, metadata)
       VALUES ($1, 'approved', 'payment_pending', 'admin-access-key',
               'transferência Pix enviada para a Efí', $2)`,
      [params.data.id, JSON.stringify({ payoutId })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    request.log.error({ error }, "Prize payout preparation failed");
    throw error;
  }
  client.release();

  try {
    const provider = await sendPixTransfer({
      idEnvio: payoutId.replace(/-/g, "").slice(0, 32),
      amountCents,
      pixKey,
      description: `PIXELPIX prêmio resgate #${params.data.id}`,
    });
    const providerReference = provider.e2eId ?? provider.endToEndId ?? null;
    await pool.query(
      `UPDATE prize_payouts
          SET status = 'submitted',
              provider_transaction_id = $1,
              provider_end_to_end_id = $2,
              provider_response = $3,
              submitted_at = NOW()
        WHERE id = $4`,
      [
        payoutId.replace(/-/g, "").slice(0, 32),
        providerReference,
        provider,
        payoutId,
      ],
    );
    response.status(202).json({
      ok: true,
      status: "payment_pending",
      payoutId,
      providerReference,
    });
  } catch (error) {
    await pool.query(
      `UPDATE prize_payouts
          SET status = 'failed', failure_reason = $1, failed_at = NOW()
        WHERE id = $2`,
      [error instanceof Error ? error.message.slice(0, 500) : "provider_error", payoutId],
    );
    await pool.query(
      `UPDATE prize_redemption_requests
          SET status = 'failed'
        WHERE id = $1 AND status = 'payment_pending'`,
      [params.data.id],
    );
    request.log.error({ error, redemptionId: params.data.id }, "Prize payout failed");
    response.status(502).json({ error: "A Efí não confirmou o envio do Pix." });
  }
});

router.post(
  "/redemptions/:id/payout/confirm",
  async (request, response): Promise<void> => {
    const params = GetAdminRedemptionParams.safeParse(request.params);
    const token =
      typeof request.body?.certificateToken === "string"
        ? request.body.certificateToken.trim()
        : "";
    if (!params.success || !token) {
      response.status(400).json({ error: "Token do certificado é obrigatório." });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT r.*, pc.token_hash
           FROM prize_redemption_requests r
           INNER JOIN prize_certificates pc ON pc.id = r.certificate_id
          WHERE r.id = $1
          FOR UPDATE`,
        [params.data.id],
      );
      const redemption = result.rows[0];
      const payload = verifyCertificateToken(token);
      if (
        !redemption ||
        String(redemption.status) !== "payment_pending" ||
        !payload ||
        payload.certificateId !== String(redemption.certificate_id) ||
        payload.prizeValueCents !== Number(redemption.prize_value_cents) ||
        hashCertificateToken(token) !== String(redemption.token_hash)
      ) {
        await client.query("ROLLBACK");
        response.status(400).json({ error: "Pagamento, token ou status inválido." });
        return;
      }

      const payout = await client.query(
        `SELECT id, amount_cents FROM prize_payouts
          WHERE redemption_request_id = $1 AND status IN ('submitted', 'created')
          ORDER BY requested_at DESC LIMIT 1
          FOR UPDATE`,
        [params.data.id],
      );
      if (!payout.rows[0]) {
        await client.query("ROLLBACK");
        response.status(409).json({ error: "Nenhuma tentativa de pagamento aguardando confirmação." });
        return;
      }
      const amount = Number(payout.rows[0].amount_cents);
      await client.query(
        `UPDATE prize_payouts
            SET status = 'confirmed', confirmed_at = NOW()
          WHERE id = $1`,
        [payout.rows[0].id],
      );
      await client.query(
        `UPDATE prize_redemption_requests
            SET status = 'paid', processed_at = NOW(), processed_by = 'admin-access-key'
          WHERE id = $1`,
        [params.data.id],
      );
      await client.query(
        `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
         VALUES ('prize_commitment_released', $1, $2)
         ON CONFLICT (entry_type, cell_id) DO NOTHING`,
        [redemption.cell_id, amount],
      );
      await client.query(
        `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
         VALUES ('prize_payout', $1, $2)
         ON CONFLICT (entry_type, cell_id) DO NOTHING`,
        [redemption.cell_id, amount],
      );
      await client.query(
        `INSERT INTO prize_redemption_audit
           (redemption_request_id, from_status, to_status, actor, reason)
         VALUES ($1, 'payment_pending', 'paid', 'admin-access-key',
                 'pagamento Pix confirmado e auditado')`,
        [params.data.id],
      );
      await client.query("COMMIT");
      response.json({ ok: true, status: "paid", amountCents: amount });
    } catch (error) {
      await client.query("ROLLBACK");
      request.log.error({ error }, "Prize payout confirmation failed");
      throw error;
    } finally {
      client.release();
    }
  },
);

router.get("/prize-pool", async (_request, response): Promise<void> => {
  const [tiers, drafts, batch, safety] = await Promise.all([
    pool.query(
      `SELECT
         pp.tier_id,
         pp.label,
         pp.nominal_value_cents,
         pp.total_value_cents,
         pp.total_positions,
         pp.remaining_value_cents,
         pp.remaining_positions,
         COALESCE(found.found_positions, 0) AS found_positions,
         COALESCE(found.found_value_cents, 0) AS found_value_cents,
         COALESCE(redemptions.redeemed_positions, 0) AS redeemed_positions,
         COALESCE(redemptions.redeemed_value_cents, 0) AS redeemed_value_cents,
         COALESCE(redemptions.pending_redemption_positions, 0) AS pending_redemption_positions,
         COALESCE(redemptions.pending_redemption_value_cents, 0) AS pending_redemption_value_cents,
         COALESCE(redemptions.rejected_positions, 0) AS rejected_positions,
         COALESCE(redemptions.rejected_value_cents, 0) AS rejected_value_cents
       FROM prize_pool pp
       LEFT JOIN (
         SELECT
           wp.tier_id,
           COUNT(*) FILTER (WHERE wp.claimed = true)::int AS found_positions,
           COALESCE(SUM(c.prize_value_cents) FILTER (WHERE wp.claimed = true), 0)::int AS found_value_cents
         FROM winning_positions wp
         LEFT JOIN cells c ON c.id = wp.cell_id
         GROUP BY wp.tier_id
       ) found ON found.tier_id = pp.tier_id
       LEFT JOIN (
         SELECT
           wp.tier_id,
           COUNT(*) FILTER (WHERE r.status = 'paid')::int AS redeemed_positions,
           COALESCE(SUM(r.prize_value_cents) FILTER (WHERE r.status = 'paid'), 0)::int AS redeemed_value_cents,
           COUNT(*) FILTER (WHERE r.status IN ('pending', 'approved', 'payment_pending'))::int AS pending_redemption_positions,
           COALESCE(SUM(r.prize_value_cents) FILTER (WHERE r.status IN ('pending', 'approved', 'payment_pending')), 0)::int AS pending_redemption_value_cents,
           COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected_positions,
           COALESCE(SUM(r.prize_value_cents) FILTER (WHERE r.status = 'rejected'), 0)::int AS rejected_value_cents
         FROM prize_redemption_requests r
         INNER JOIN winning_positions wp ON wp.cell_id = r.cell_id
         GROUP BY wp.tier_id
       ) redemptions ON redemptions.tier_id = pp.tier_id
       ORDER BY pp.nominal_value_cents DESC`,
    ),
    pool.query(
      `SELECT tier_id, label, nominal_value_cents, total_value_cents,
              total_positions, created_at
         FROM prize_tier_drafts
        WHERE status = 'draft'
        ORDER BY tier_id`,
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
        foundPositions: Number(row.found_positions),
        foundValueCents: Number(row.found_value_cents),
        remainingValueCents: Number(row.remaining_value_cents),
        remainingPositions: Number(row.remaining_positions),
        redeemedPositions: Number(row.redeemed_positions),
        redeemedValueCents: Number(row.redeemed_value_cents),
        pendingRedemptionPositions: Number(row.pending_redemption_positions),
        pendingRedemptionValueCents: Number(row.pending_redemption_value_cents),
        rejectedPositions: Number(row.rejected_positions),
        rejectedValueCents: Number(row.rejected_value_cents),
      })),
       draftTiers: drafts.rows.map((row) => ({
         tierId: Number(row.tier_id),
         label: String(row.label),
         quantity: Number(row.total_positions),
         nominalValueCents: Number(row.nominal_value_cents),
         totalValueCents: Number(row.total_value_cents),
         createdAt: iso(row.created_at)!,
         status: "draft" as const,
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

router.get("/prize-positions", async (request, response): Promise<void> => {
  const parsed = ListAdminPrizePositionsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, tierId, search, limit, offset } = parsed.data;
  const params: Array<string | number | boolean> = [];
  const conditions: string[] = [];

  if (status && status !== "all") {
    params.push(status === "found");
    conditions.push(`wp.claimed = $${params.length}`);
  }
  if (tierId !== undefined) {
    params.push(tierId);
    conditions.push(`wp.tier_id = $${params.length}`);
  }
  if (search) {
    params.push(search);
    conditions.push(`CAST(wp.cell_id AS text) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countParams = [...params];
  const [count, rows] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
         FROM winning_positions wp
         INNER JOIN prize_pool pp ON pp.tier_id = wp.tier_id
         LEFT JOIN cells c ON c.id = wp.cell_id
         ${where}`,
      countParams,
    ),
    pool.query(
      `SELECT
         wp.cell_id,
         wp.tier_id,
         pp.label AS tier_label,
         pp.nominal_value_cents,
         CASE WHEN wp.claimed THEN c.prize_value_cents ELSE NULL END AS distributed_prize_value_cents,
         CASE WHEN wp.claimed THEN 'found' ELSE 'available' END AS position_status,
         c.status AS cell_status,
         wp.claimed_at,
         c.revealed_at,
         c.revealed_by
       FROM winning_positions wp
       INNER JOIN prize_pool pp ON pp.tier_id = wp.tier_id
       LEFT JOIN cells c ON c.id = wp.cell_id
       ${where}
       ORDER BY wp.cell_id
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);

  response.json(
    ListAdminPrizePositionsResponse.parse({
      items: rows.rows.map((row) => ({
        cellId: Number(row.cell_id),
        tierId: Number(row.tier_id),
        tierLabel: String(row.tier_label),
        plannedPrizeValueCents: Number(row.nominal_value_cents),
        distributedPrizeValueCents:
          row.distributed_prize_value_cents == null
            ? null
            : Number(row.distributed_prize_value_cents),
        positionStatus: String(row.position_status),
        cellStatus: row.cell_status ? String(row.cell_status) : null,
        claimedAt: iso(row.claimed_at),
        revealedAt: iso(row.revealed_at),
        revealedBy: row.revealed_by ? String(row.revealed_by) : null,
      })),
      total: Number(count.rows[0]?.total ?? 0),
    }),
  );
});

export default router;