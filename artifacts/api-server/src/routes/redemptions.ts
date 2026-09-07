import { Router, type IRouter, type Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import {
  hashCertificateToken,
  verifyCertificateToken,
} from "../lib/certificates";

const router: IRouter = Router();

function sameHash(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function readToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readCertificateCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function readEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPixKey(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function findCertificate(input: { certificateCode: string; token: string }) {
  const payload = verifyCertificateToken(input.token);
  if (!payload) return null;

  const result = await pool.query(
    `SELECT pc.id, pc.cell_id, pc.certificate_code, pc.token_hash,
            pc.prize_value_cents, pc.email, pc.issued_at, pc.status,
            c.status AS cell_status, c.revealed_at
       FROM prize_certificates pc
       INNER JOIN cells c ON c.id = pc.cell_id
      WHERE pc.certificate_code = $1
        AND pc.id = $2`,
    [input.certificateCode, payload.certificateId],
  );
  const certificate = result.rows[0];
  if (
    !certificate ||
    Number(certificate.cell_id) !== payload.cellId ||
    Number(certificate.prize_value_cents) !== payload.prizeValueCents ||
    !sameHash(hashCertificateToken(input.token), String(certificate.token_hash))
  ) {
    return null;
  }
  return { certificate, payload };
}

async function latestRedemption(certificateId: string) {
  const result = await pool.query(
    `SELECT id, status, requested_at
       FROM prize_redemption_requests
      WHERE certificate_id = $1
      ORDER BY requested_at DESC
      LIMIT 1`,
    [certificateId],
  );
  return result.rows[0] ?? null;
}

router.get("/certificates/verify", async (request, response): Promise<void> => {
  const certificateCode = readCertificateCode(request.query.code);
  const token = readToken(request.query.token);
  if (!certificateCode || !token) {
    response.status(400).json({ error: "Informe o código e o token do certificado." });
    return;
  }

  const found = await findCertificate({ certificateCode, token });
  if (!found) {
    response.status(404).json({ error: "Certificado inválido." });
    return;
  }

  const { certificate } = found;
  const redemption = await latestRedemption(String(certificate.id));
  const blockedStatuses = new Set(["pending", "approved", "payment_pending", "paid"]);
  const canRedeem =
    certificate.status !== "revoked" &&
    certificate.cell_status === "paid" &&
    (!redemption || !blockedStatuses.has(String(redemption.status)));

  response.setHeader("Cache-Control", "no-store");
  response.json({
    valid: true,
    certificateCode: String(certificate.certificate_code),
    cellId: Number(certificate.cell_id),
    prizeValueCents: Number(certificate.prize_value_cents),
    email: maskEmail(String(certificate.email)),
    issuedAt: new Date(certificate.issued_at).toISOString(),
    status: String(certificate.status),
    redemptionStatus: redemption ? String(redemption.status) : null,
    canRedeem,
  });
});

router.post("/redemptions", async (request: Request, response): Promise<void> => {
  const certificateCode = readCertificateCode(request.body?.certificateCode);
  const token = readToken(request.body?.token);
  const email = readEmail(request.body?.email);
  const pixKey = readPixKey(request.body?.pixKey);

  if (
    !certificateCode ||
    !token ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    pixKey.length < 1 ||
    pixKey.length > 120
  ) {
    response.status(400).json({ error: "Dados de resgate inválidos." });
    return;
  }

  const payload = verifyCertificateToken(token);
  if (!payload) {
    response.status(400).json({ error: "Token do certificado inválido." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT pc.id, pc.cell_id, pc.certificate_code, pc.token_hash,
              pc.prize_value_cents, pc.email, pc.issued_at, pc.status,
              c.status AS cell_status, c.revealed_at
         FROM prize_certificates pc
         INNER JOIN cells c ON c.id = pc.cell_id
        WHERE pc.certificate_code = $1
          AND pc.id = $2
        FOR UPDATE`,
      [certificateCode, payload.certificateId],
    );
    const certificate = result.rows[0];
    if (
      !certificate ||
      Number(certificate.cell_id) !== payload.cellId ||
      Number(certificate.prize_value_cents) !== payload.prizeValueCents ||
      !sameHash(hashCertificateToken(token), String(certificate?.token_hash ?? "")) ||
      String(certificate.email).toLowerCase() !== email ||
      String(certificate.cell_status) !== "paid" ||
      String(certificate.status) === "revoked"
    ) {
      await client.query("ROLLBACK");
      response.status(400).json({ error: "Certificado ou dados do resgate inválidos." });
      return;
    }

    const previousResult = await client.query(
      `SELECT id, status
         FROM prize_redemption_requests
        WHERE certificate_id = $1
        ORDER BY requested_at DESC
        LIMIT 1
        FOR UPDATE`,
      [certificate.id],
    );
    const previous = previousResult.rows[0];
    if (
      previous &&
      ["pending", "approved", "payment_pending", "paid"].includes(
        String(previous.status),
      )
    ) {
      await client.query("ROLLBACK");
      response.status(409).json({
        error: "Este certificado já possui um resgate em processamento.",
        redemptionId: Number(previous.id),
        status: String(previous.status),
      });
      return;
    }

    const inserted = await client.query(
      `INSERT INTO prize_redemption_requests
         (cell_id, certificate_id, email, pix_key, certificate_code,
          requested_amount_cents, prize_value_cents, won_at, token_verified_at,
          submitted_ip, submitted_user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, NOW(), $8, $9)
       RETURNING id, status, requested_at, prize_value_cents`,
      [
        Number(certificate.cell_id),
        String(certificate.id),
        email,
        pixKey,
        String(certificate.certificate_code),
        Number(certificate.prize_value_cents),
        certificate.revealed_at ?? certificate.issued_at,
        request.ip || null,
        request.get("user-agent")?.slice(0, 500) ?? null,
      ],
    );
    await client.query(
      `UPDATE prize_certificates
          SET status = 'redeemed', redeemed_at = NOW()
        WHERE id = $1`,
      [certificate.id],
    );
    await client.query(
      `INSERT INTO prize_redemption_audit
         (redemption_request_id, from_status, to_status, actor, reason)
       VALUES ($1, $2, 'pending', 'certificate-holder', 'resgate criado')`,
      [inserted.rows[0].id, previous?.status ?? null],
    );
    await client.query("COMMIT");

    response.status(201).json({
      id: Number(inserted.rows[0].id),
      status: String(inserted.rows[0].status),
      certificateCode: String(certificate.certificate_code),
      prizeValueCents: Number(inserted.rows[0].prize_value_cents),
      requestedAt: new Date(inserted.rows[0].requested_at).toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    request.log.error({ error }, "Prize redemption creation failed");
    throw error;
  } finally {
    client.release();
  }
});

export default router;