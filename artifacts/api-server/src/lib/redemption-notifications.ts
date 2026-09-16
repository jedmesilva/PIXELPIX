import { pool } from "@workspace/db";
import { logger } from "./logger";
import { getPublicAppUrl } from "./public-app-url";
import { sendResendEmail } from "./resend";
import {
  buildRedemptionStatusEmail,
  type RedemptionNotificationKind,
  type RedemptionNotificationStatus,
} from "./redemption-status-email";

const NOTIFIABLE_STATUSES = new Set<RedemptionNotificationStatus>([
  "approved",
  "payment_pending",
  "paid",
  "rejected",
  "failed",
]);

function isNotifiableStatus(value: unknown): value is RedemptionNotificationStatus {
  return typeof value === "string" && NOTIFIABLE_STATUSES.has(value as RedemptionNotificationStatus);
}

export async function notifyRedemptionStatusChange(
  redemptionId: number,
  expectedStatus?: string,
) {
  const result = await pool.query(
    `SELECT id, cell_id, certificate_code, email, pix_key,
            COALESCE(approved_amount_cents, requested_amount_cents) AS amount_cents,
            status, processed_by, rejection_reason,
            COALESCE(processed_at, reviewed_at, NOW()) AS updated_at
       FROM prize_redemption_requests
      WHERE id = $1`,
    [redemptionId],
  );
  const current = result.rows[0];
  if (
    !current ||
    (expectedStatus && String(current.status) !== expectedStatus) ||
    !isNotifiableStatus(String(current.status))
  ) {
    return false;
  }

  const claimed = await pool.query(
    `UPDATE prize_redemption_requests
        SET status_email_attempts = status_email_attempts + 1,
            status_email_last_attempt_at = NOW(),
            status_email_last_error = NULL
      WHERE id = $1
        AND status = $2
        AND status_email_pending = true
        AND (
          status_email_last_attempt_at IS NULL
          OR status_email_last_attempt_at < NOW() - INTERVAL '1 minute'
        )
      RETURNING id`,
    [redemptionId, String(current.status)],
  );
  if (!claimed.rows.length) return false;

  try {
    const publicUrl = getPublicAppUrl();
    const notificationKind: RedemptionNotificationKind =
      String(current.status) === "rejected"
        ? String(current.processed_by) === "certificate-holder"
          ? "cancelled"
          : "rejected"
        : (String(current.status) as RedemptionNotificationStatus);
    const email = buildRedemptionStatusEmail({
      redemptionId,
      cellId: Number(current.cell_id),
      certificateCode: String(current.certificate_code),
      email: String(current.email),
      pixKey: String(current.pix_key),
      amountCents: Number(current.amount_cents),
      status: String(current.status) as RedemptionNotificationStatus,
      notificationKind,
      rejectionReason: current.rejection_reason
        ? String(current.rejection_reason)
        : null,
      updatedAt: new Date(current.updated_at),
      publicUrl,
      shareUrl: `${publicUrl}/?pixel=${Number(current.cell_id)}&from=redemption`,
    });
    await sendResendEmail({
      from:
        process.env.CERTIFICATE_FROM_EMAIL?.trim() ||
        "PIXELPIX <onboarding@resend.dev>",
      to: [String(current.email)],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(process.env.CERTIFICATE_REPLY_TO?.trim()
        ? { reply_to: process.env.CERTIFICATE_REPLY_TO.trim() }
        : {}),
    });
    await pool.query(
      `UPDATE prize_redemption_requests
          SET status_email_pending = false,
              status_email_sent_at = NOW(),
              status_email_last_error = NULL
        WHERE id = $1 AND status = $2`,
      [redemptionId, String(current.status)],
    );
    return true;
  } catch (error) {
    await pool.query(
      `UPDATE prize_redemption_requests
          SET status_email_last_error = $2
        WHERE id = $1`,
      [
        redemptionId,
        error instanceof Error ? error.message.slice(0, 500) : "delivery_failed",
      ],
    );
    logger.warn(
      { error, redemptionId, status: String(current.status) },
      "Redemption status email delivery failed",
    );
    return false;
  }
}

export async function processPendingRedemptionStatusEmails() {
  const pending = await pool.query(
    `SELECT id, status
       FROM prize_redemption_requests
      WHERE status_email_pending = true
        AND status IN ('approved', 'payment_pending', 'paid', 'rejected', 'failed')
      ORDER BY id
      LIMIT 25`,
  );
  for (const row of pending.rows) {
    try {
      await notifyRedemptionStatusChange(Number(row.id), String(row.status));
    } catch (error) {
      logger.error(
        { error, redemptionId: Number(row.id) },
        "Pending redemption status email processing failed",
      );
    }
  }
}