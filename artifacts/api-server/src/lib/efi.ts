import https from "node:https";
import { randomBytes } from "node:crypto";

type EfiEnvironment = "sandbox" | "production";

type EfiConfig = {
  environment: EfiEnvironment;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  pfx: Buffer;
  passphrase?: string;
};

export type EfiCharge = {
  txid: string;
  status?: string;
  calendario?: {
    expiracao?: number;
  };
  valor?: {
    original?: string;
  };
  pixCopiaECola?: string;
};

export class EfiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EfiConfigurationError";
  }
}

export class EfiApiError extends Error {
  readonly statusCode: number;
  readonly responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody: unknown) {
    super(message);
    this.name = "EfiApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

let cachedToken: {
  value: string;
  expiresAt: number;
  clientId: string;
  environment: EfiEnvironment;
} | null = null;

export function isEfiConfigured() {
  return Boolean(process.env.EFI_ENVIRONMENT?.trim());
}

export function isEfiWebhookRegistrationConfigured() {
  return Boolean(
    process.env.EFI_PIX_KEY?.trim() &&
      process.env.EFI_WEBHOOK_URL?.trim() &&
      process.env.EFI_WEBHOOK_TOKEN?.trim(),
  );
}

export function createEfiTxid() {
  return randomBytes(16).toString("hex");
}

function getConfig(): EfiConfig {
  const environment = process.env.EFI_ENVIRONMENT?.trim().toLowerCase();
  if (environment !== "sandbox" && environment !== "production") {
    throw new EfiConfigurationError(
      "EFI_ENVIRONMENT deve ser sandbox ou production.",
    );
  }

  const clientId = process.env.EFI_CLIENT_ID?.trim();
  const clientSecret = process.env.EFI_CLIENT_SECRET?.trim();
  const certificateBase64 = process.env.EFI_CERTIFICATE_BASE64?.trim();
  if (!clientId || !clientSecret || !certificateBase64) {
    throw new EfiConfigurationError(
      "Configure EFI_CLIENT_ID, EFI_CLIENT_SECRET e EFI_CERTIFICATE_BASE64.",
    );
  }

  let pfx: Buffer;
  try {
    pfx = Buffer.from(certificateBase64, "base64");
  } catch {
    throw new EfiConfigurationError(
      "EFI_CERTIFICATE_BASE64 não contém um certificado válido.",
    );
  }
  if (pfx.length < 100) {
    throw new EfiConfigurationError(
      "EFI_CERTIFICATE_BASE64 parece estar vazio ou incompleto.",
    );
  }

  return {
    environment,
    baseUrl:
      environment === "production"
        ? "https://pix.api.efipay.com.br"
        : "https://pix-h.api.efipay.com.br",
    clientId,
    clientSecret,
    pfx,
    passphrase: process.env.EFI_CERTIFICATE_PASSWORD?.trim() || undefined,
  };
}

function requestJson<T>(
  config: EfiConfig,
  path: string,
  input: {
    method: "GET" | "POST" | "PUT";
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<T> {
  const url = new URL(path, config.baseUrl);
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: input.method,
        headers: input.headers,
        pfx: config.pfx,
        passphrase: config.passphrase,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let body: unknown = raw;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            // Keep non-JSON provider errors available to the caller.
          }

          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            const providerMessage =
              body &&
              typeof body === "object" &&
              "mensagem" in body &&
              typeof body.mensagem === "string"
                ? body.mensagem
                : `A Efí respondeu com HTTP ${statusCode}.`;
            reject(new EfiApiError(statusCode, providerMessage, body));
            return;
          }
          resolve(body as T);
        });
      },
    );
    request.on("error", reject);
    if (input.body) request.write(input.body);
    request.end();
  });
}

async function getAccessToken(config: EfiConfig) {
  if (
    cachedToken &&
    cachedToken.clientId === config.clientId &&
    cachedToken.environment === config.environment &&
    cachedToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedToken.value;
  }

  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const result = await requestJson<{
    access_token?: string;
    expires_in?: number;
  }>(config, "/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!result.access_token) {
    throw new EfiApiError(502, "A Efí não retornou um access_token.", result);
  }

  cachedToken = {
    value: result.access_token,
    clientId: config.clientId,
    environment: config.environment,
    expiresAt: Date.now() + Number(result.expires_in ?? 300) * 1_000,
  };
  return result.access_token;
}

async function authenticatedRequest<T>(
  path: string,
  input: {
    method: "GET" | "PUT";
    body?: unknown;
  },
) {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  return requestJson<T>(config, path, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
}

export async function createImmediateCharge(input: {
  txid: string;
  amountCents: number;
  cellId: number;
}) {
  const pixKey = process.env.EFI_PIX_KEY?.trim();
  if (!pixKey) {
    throw new EfiConfigurationError(
      "Configure EFI_PIX_KEY com a chave Pix recebedora da conta Efí.",
    );
  }

  const charge = await authenticatedRequest<EfiCharge>(
    `/v2/cob/${encodeURIComponent(input.txid)}`,
    {
      method: "PUT",
      body: {
        calendario: {
          expiracao: 300,
        },
        valor: {
          original: (input.amountCents / 100).toFixed(2),
        },
        chave: pixKey,
        solicitacaoPagador: `Pagamento da célula ${input.cellId} no PIXELPIX.`,
      },
    },
  );
  if (!charge.pixCopiaECola) {
    throw new EfiApiError(
      502,
      "A Efí criou a cobrança, mas não retornou o Pix copia e cola.",
      charge,
    );
  }
  return {
    txid: charge.txid || input.txid,
    pixCopiaECola: charge.pixCopiaECola,
    status: charge.status ?? "ATIVA",
  };
}

export function getEfiCharge(txid: string) {
  return authenticatedRequest<EfiCharge>(
    `/v2/cob/${encodeURIComponent(txid)}`,
    { method: "GET" },
  );
}

function getConfiguredWebhookUrl() {
  const configuredUrl = process.env.EFI_WEBHOOK_URL?.trim();
  const hmac = process.env.EFI_WEBHOOK_TOKEN?.trim();
  if (!configuredUrl || !hmac) {
    throw new EfiConfigurationError(
      "Configure EFI_WEBHOOK_URL e EFI_WEBHOOK_TOKEN para registrar o webhook Efí.",
    );
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new EfiConfigurationError(
      "EFI_WEBHOOK_URL deve ser uma URL HTTPS pública válida.",
    );
  }
  if (url.protocol !== "https:") {
    throw new EfiConfigurationError(
      "EFI_WEBHOOK_URL deve usar HTTPS para atender ao requisito mTLS da Efí.",
    );
  }

  // Efí normally appends /pix to the registered URL. `ignorar=` keeps the
  // callback on the exact route exposed by this API.
  url.searchParams.set("ignorar", "");
  url.searchParams.set("hmac", hmac);
  return url.toString();
}

export async function registerEfiWebhook() {
  const pixKey = process.env.EFI_PIX_KEY?.trim();
  if (!pixKey) {
    throw new EfiConfigurationError(
      "Configure EFI_PIX_KEY antes de registrar o webhook Efí.",
    );
  }

  const result = await authenticatedRequest<unknown>(
    `/v2/webhook/${encodeURIComponent(pixKey)}`,
    {
      method: "PUT",
      body: { webhookUrl: getConfiguredWebhookUrl() },
    },
  );
  return result;
}