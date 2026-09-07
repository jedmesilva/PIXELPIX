import { pool } from "@workspace/db";

export async function confirmEfiPayout(input: {
  providerTransactionId?: string | null;
  providerEndToEndId?: string | null;
  amountCents?: number | null;
}) {
  const references = [input.providerTransactionId, input.providerEndToEndId].filter(
    (value): value is string => Boolean(value),
  );
  if (!references.length) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT pp.id, pp.amount_cents, pp.status, pp.redemption_request_id,
              r.cell_id, r.status AS redemption_status
         FROM prize_payouts pp
         INNER JOIN prize_redemption_requests r ON r.id = pp.redemption_request_id
        WHERE (pp.provider_transaction_id = ANY($1::text[])
            OR pp.provider_end_to_end_id = ANY($1::text[]))
        ORDER BY pp.requested_at DESC
        LIMIT 1
        FOR UPDATE`,
      [references],
    );
    const payout = result.rows[0];
    if (!payout) {
      await client.query("ROLLBACK");
      return false;
    }
    if (
      input.amountCents != null &&
      Number(payout.amount_cents) !== input.amountCents
    ) {
      await client.query("ROLLBACK");
      throw new Error("Valor do payout Efí não corresponde ao valor aprovado.");
    }
    if (payout.status === "confirmed" || payout.redemption_status === "paid") {
      await client.query("ROLLBACK");
      return true;
    }

    await client.query(
      `UPDATE prize_payouts
          SET status = 'confirmed', confirmed_at = NOW()
        WHERE id = $1`,
      [payout.id],
    );
    await client.query(
      `UPDATE prize_redemption_requests
          SET status = 'paid', processed_at = NOW(), processed_by = 'efi-webhook'
        WHERE id = $1 AND status = 'payment_pending'`,
      [payout.redemption_request_id],
    );
    await client.query(
      `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
       VALUES ('prize_commitment_released', $1, $2)
       ON CONFLICT (entry_type, cell_id) DO NOTHING`,
      [payout.cell_id, Number(payout.amount_cents)],
    );
    await client.query(
      `INSERT INTO cash_ledger (entry_type, cell_id, amount_cents)
       VALUES ('prize_payout', $1, $2)
       ON CONFLICT (entry_type, cell_id) DO NOTHING`,
      [payout.cell_id, Number(payout.amount_cents)],
    );
    await client.query(
      `INSERT INTO prize_redemption_audit
         (redemption_request_id, from_status, to_status, actor, reason, metadata)
       VALUES ($1, 'payment_pending', 'paid', 'efi-webhook',
               'transferência Pix confirmada pela Efí', $2)`,
      [
        payout.redemption_request_id,
        JSON.stringify({
          providerTransactionId: input.providerTransactionId ?? null,
          providerEndToEndId: input.providerEndToEndId ?? null,
        }),
      ],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}