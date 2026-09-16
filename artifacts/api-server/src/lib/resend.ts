import { ReplitConnectors } from "@replit/connectors-sdk";

const RESEND_API_URL = "https://api.resend.com/emails";

export type ResendEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
};

const DEVELOPMENT_FROM_EMAIL = "PIXELPIX <onboarding@resend.dev>";

export function getResendFromEmail() {
  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_FROM_EMAIL;
  }
  return process.env.CERTIFICATE_FROM_EMAIL?.trim() || DEVELOPMENT_FROM_EMAIL;
}

export function assertResendConfiguration() {
  if (process.env.NODE_ENV !== "production") return;

  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error(
      "RESEND_API_KEY must be configured in production for certificate email delivery.",
    );
  }

  if (
    !process.env.CERTIFICATE_FROM_EMAIL?.trim() ||
    /@resend\.dev[>\s]*$/i.test(process.env.CERTIFICATE_FROM_EMAIL.trim())
  ) {
    throw new Error(
      "CERTIFICATE_FROM_EMAIL must be a verified production sender in the Resend account.",
    );
  }
}

async function responseError(response: Response) {
  const message = await response.text().catch(() => "");
  return message.slice(0, 500) || `HTTP ${response.status}`;
}

export async function sendResendEmail(payload: ResendEmailPayload) {
  const body = JSON.stringify(payload);
  if (process.env.NODE_ENV === "production") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY must be configured in production for certificate email delivery.",
      );
    }
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Resend rejected email: ${await responseError(response)}`);
    }
    return;
  }

  // Development uses Replit's managed connector, even when a production
  // RESEND_API_KEY is present in the shared environment.
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Resend rejected email: ${await responseError(response)}`);
  }
}