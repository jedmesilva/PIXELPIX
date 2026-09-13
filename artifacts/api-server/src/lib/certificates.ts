import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

type QueryClient = { query: Function };

type CertificateTokenPayload = {
  v: 1;
  certificateId: string;
  cellId: number;
  prizeValueCents: number;
  issuedAt: string;
  nonce: string;
};

export type IssuedCertificate = {
  id: string;
  cellId: number;
  certificateCode: string;
  token: string;
  prizeValueCents: number;
  email: string;
  issuedAt: Date;
  status: string;
  emoji: string | null;
  backgroundColor: string | null;
  revealedAt: Date | null;
  prizeLabel: string | null;
};

function getTokenSecret() {
  const secret =
    process.env.CERTIFICATE_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Configure CERTIFICATE_TOKEN_SECRET ou SESSION_SECRET para emitir certificados.",
    );
  }
  return secret;
}

function encryptionKey() {
  return createHash("sha256").update(getTokenSecret()).digest();
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function issueCertificateToken(input: {
  certificateId: string;
  cellId: number;
  prizeValueCents: number;
  issuedAt: Date;
}) {
  const payload: CertificateTokenPayload = {
    v: 1,
    certificateId: input.certificateId,
    cellId: input.cellId,
    prizeValueCents: input.prizeValueCents,
    issuedAt: input.issuedAt.toISOString(),
    nonce: randomBytes(24).toString("base64url"),
  };
  const encodedPayload = encodeJson(payload);
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyCertificateToken(token: string): CertificateTokenPayload | null {
  if (!token || token.length > 4096) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expected = Buffer.from(signPayload(encodedPayload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = decodeJson<CertificateTokenPayload>(encodedPayload);
    if (
      payload.v !== 1 ||
      typeof payload.certificateId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.certificateId) ||
      !Number.isInteger(payload.cellId) ||
      payload.cellId < 0 ||
      payload.cellId >= 1_000_000 ||
      !Number.isInteger(payload.prizeValueCents) ||
      payload.prizeValueCents < 0 ||
      typeof payload.issuedAt !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hashCertificateToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    tokenCiphertext: ciphertext.toString("base64url"),
    tokenIv: iv.toString("base64url"),
    tokenAuthTag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptToken(input: {
  tokenCiphertext: string;
  tokenIv: string;
  tokenAuthTag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(input.tokenIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(input.tokenAuthTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.tokenCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function createCertificateCode(cellId: number) {
  return `PPX-${new Date().getUTCFullYear()}-${String(cellId).padStart(6, "0")}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function payloadHash(input: {
  certificateId: string;
  cellId: number;
  certificateCode: string;
  prizeValueCents: number;
  email: string;
  issuedAt: Date;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        certificateId: input.certificateId,
        cellId: input.cellId,
        certificateCode: input.certificateCode,
        prizeValueCents: input.prizeValueCents,
        email: input.email.toLowerCase(),
        issuedAt: input.issuedAt.toISOString(),
      }),
    )
    .digest("hex");
}

export async function ensureCertificateForCell(
  client: QueryClient,
  cellId: number,
): Promise<IssuedCertificate | null> {
  // Every revealed cell is persisted as `paid`, including cells whose
  // released prize value is zero. Certificate ownership must never depend on
  // whether the cell also won money.
  const existing = await client.query(
    `SELECT pc.id, pc.cell_id, pc.certificate_code, pc.token_ciphertext,
            pc.token_iv, pc.token_auth_tag, pc.prize_value_cents, pc.email,
            pc.issued_at, pc.status, c.emoji, c.background_color,
            c.revealed_at, pp.label AS prize_label
       FROM prize_certificates pc
       INNER JOIN cells c ON c.id = pc.cell_id
       LEFT JOIN winning_positions wp ON wp.cell_id = c.id
       LEFT JOIN prize_pool pp ON pp.tier_id = wp.tier_id
      WHERE pc.cell_id = $1`,
    [cellId],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    return {
      id: String(row.id),
      cellId: Number(row.cell_id),
      certificateCode: String(row.certificate_code),
      token: decryptToken({
        tokenCiphertext: String(row.token_ciphertext),
        tokenIv: String(row.token_iv),
        tokenAuthTag: String(row.token_auth_tag),
      }),
      prizeValueCents: Number(row.prize_value_cents),
      email: String(row.email),
      issuedAt: new Date(row.issued_at),
      status: String(row.status),
      emoji: row.emoji ? String(row.emoji) : null,
      backgroundColor: row.background_color
        ? String(row.background_color)
        : null,
      revealedAt: row.revealed_at ? new Date(row.revealed_at) : null,
      prizeLabel: row.prize_label ? String(row.prize_label) : null,
    };
  }

  const cellResult = await client.query(
    `SELECT c.email, c.prize_value_cents, c.revealed_at, c.emoji,
            c.background_color, pp.label AS prize_label
       FROM cells c
       LEFT JOIN winning_positions wp ON wp.cell_id = c.id
       LEFT JOIN prize_pool pp ON pp.tier_id = wp.tier_id
      WHERE c.id = $1 AND c.status = 'paid'`,
    [cellId],
  );
  const cell = cellResult.rows[0];
  if (!cell?.email) return null;

  const id = randomUUID();
  const issuedAt = cell.revealed_at ? new Date(cell.revealed_at) : new Date();
  const prizeValueCents = Number(cell.prize_value_cents ?? 0);
  const certificateCode = createCertificateCode(cellId);
  const token = issueCertificateToken({
    certificateId: id,
    cellId,
    prizeValueCents,
    issuedAt,
  });
  const encrypted = encryptToken(token);
  const inserted = await client.query(
    `INSERT INTO prize_certificates
       (id, cell_id, certificate_code, token_hash, token_ciphertext, token_iv,
        token_auth_tag, prize_value_cents, email, payload_hash, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (cell_id) DO NOTHING
     RETURNING id, cell_id, certificate_code, prize_value_cents, email, issued_at, status`,
    [
      id,
      cellId,
      certificateCode,
      hashCertificateToken(token),
      encrypted.tokenCiphertext,
      encrypted.tokenIv,
      encrypted.tokenAuthTag,
      prizeValueCents,
      String(cell.email),
      payloadHash({
        certificateId: id,
        cellId,
        certificateCode,
        prizeValueCents,
        email: String(cell.email),
        issuedAt,
      }),
      issuedAt,
    ],
  );

  if (inserted.rows[0]) {
    const row = inserted.rows[0];
    return {
      id,
      cellId,
      certificateCode,
      token,
      prizeValueCents,
      email: String(row.email),
      issuedAt,
      status: String(row.status),
      emoji: cell.emoji ? String(cell.emoji) : null,
      backgroundColor: cell.background_color
        ? String(cell.background_color)
        : null,
      revealedAt: cell.revealed_at ? new Date(cell.revealed_at) : null,
      prizeLabel: cell.prize_label ? String(cell.prize_label) : null,
    };
  }
  return ensureCertificateForCell(client, cellId);
}