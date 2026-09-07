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
  const existing = await client.query(
    `SELECT id, cell_id, certificate_code, token_ciphertext, token_iv,
            token_auth_tag, prize_value_cents, email, issued_at, status
       FROM prize_certificates
      WHERE cell_id = $1`,
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
    };
  }

  const cellResult = await client.query(
    `SELECT email, prize_value_cents, revealed_at
       FROM cells
      WHERE id = $1 AND status = 'paid'`,
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
    };
  }
  return ensureCertificateForCell(client, cellId);
}