type CertificateEmailInput = {
  cellId: number;
  certificateCode: string;
  prizeValueCents: number;
  prizeLabel?: string | null;
  emoji?: string | null;
  backgroundColor?: string | null;
  issuedAt: Date;
  visualizeUrl: string;
  redemptionUrl: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function logoMark() {
  return `
    <span style="display:inline-block;width:30px;height:40px;vertical-align:middle;margin-right:10px;">
      <span style="display:block;width:9px;height:9px;margin:0 auto 2px;background:#00b85c;"></span>
      <span style="display:block;width:9px;height:9px;margin-bottom:2px;background:#00b85c;box-shadow:11px 0 0 #00b85c;"></span>
      <span style="display:block;width:9px;height:9px;margin-bottom:2px;background:#00b85c;box-shadow:11px 0 0 #00b85c;"></span>
      <span style="display:block;width:9px;height:9px;background:#00b85c;"></span>
    </span>
  `;
}

export function buildCertificateEmail(input: CertificateEmailInput) {
  const prizeValue = formatBRL(input.prizeValueCents);
  const issuedAt = formatDate(input.issuedAt);
  const emoji = input.emoji || "💰";
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(input.backgroundColor ?? "")
    ? input.backgroundColor
    : "#1b2521";
  const label = input.prizeLabel ? escapeHtml(input.prizeLabel) : "Prêmio liberado";
  const safeCode = escapeHtml(input.certificateCode);
  const safeVisualizeUrl = escapeHtml(input.visualizeUrl);
  const safeRedemptionUrl = input.redemptionUrl
    ? escapeHtml(input.redemptionUrl)
    : null;

  const redemptionButton = safeRedemptionUrl
    ? `
      <tr>
        <td align="center" style="padding:0 0 12px;">
          <a href="${safeRedemptionUrl}" style="display:inline-block;width:100%;padding:15px 20px;border-radius:10px;background:#00b85c;color:#07150d;font-size:15px;font-weight:800;text-align:center;text-decoration:none;">
            Resgatar prêmio
          </a>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="padding:0 0 12px;color:#8b93a1;font-size:13px;line-height:1.5;text-align:center;">
          Este pixel não possui valor de resgate.
        </td>
      </tr>
    `;

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#0e1114;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Seu pixel foi revelado no PIXELPIX.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e1114;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#171b20;border:1px solid #2b333c;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 22px;border-bottom:1px solid #273039;">
                <div style="font-size:19px;font-weight:800;letter-spacing:.04em;color:#e5e7eb;">
                  ${logoMark()}<span style="vertical-align:middle;">PIXELPIX</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 10px;">
                <p style="margin:0 0 8px;color:#00d36c;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">
                  Pixel revelado
                </p>
                <h1 style="margin:0;color:#f4f7f5;font-size:30px;line-height:1.1;">
                  O pixel #${input.cellId.toLocaleString("pt-BR")} é seu.
                </h1>
                <p style="margin:14px 0 0;color:#aeb8b2;font-size:15px;line-height:1.6;">
                  O pagamento foi confirmado e o certificado abaixo comprova a revelação do seu pixel.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #34423a;border-radius:16px;background:#11161a;">
                  <tr>
                    <td align="center" style="padding:24px 20px 18px;">
                      <div style="display:inline-block;width:116px;height:116px;border-radius:18px;background:${backgroundColor};font-size:52px;line-height:116px;text-align:center;">
                        ${escapeHtml(emoji)}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 20px 22px;">
                      <div style="color:#e5e7eb;font-size:17px;font-weight:800;">${label}</div>
                      <div style="margin-top:7px;color:#00d36c;font-size:25px;font-weight:800;">${prizeValue}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #273039;color:#8b93a1;font-size:12px;">Certificado</td>
                    <td align="right" style="padding:8px 0;border-bottom:1px solid #273039;color:#e5e7eb;font-size:12px;font-weight:700;">${safeCode}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#8b93a1;font-size:12px;">Revelado em</td>
                    <td align="right" style="padding:8px 0;color:#e5e7eb;font-size:12px;font-weight:700;">${escapeHtml(issuedAt)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${redemptionButton}
                  <tr>
                    <td align="center">
                      <a href="${safeVisualizeUrl}" style="display:inline-block;width:100%;padding:14px 20px;border:1px solid #3b4b42;border-radius:10px;color:#dce8df;font-size:14px;font-weight:800;text-align:center;text-decoration:none;">
                        Visualizar pixel
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#11161a;color:#718078;font-size:11px;line-height:1.6;text-align:center;">
                Guarde este e-mail. O código do certificado e o link de resgate são pessoais.
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:18px auto 0;color:#5f6c65;font-size:11px;line-height:1.5;text-align:center;">
            PIXELPIX · um milhão de pixels, uma revelação por vez
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "PIXELPIX — Pixel revelado",
    "",
    `O pixel #${input.cellId.toLocaleString("pt-BR")} foi revelado.`,
    `Valor liberado: ${prizeValue}`,
    `Certificado: ${input.certificateCode}`,
    `Revelado em: ${issuedAt}`,
    "",
    `Visualizar pixel: ${input.visualizeUrl}`,
    ...(input.redemptionUrl
      ? [`Resgatar prêmio: ${input.redemptionUrl}`]
      : ["Este pixel não possui valor de resgate."]),
  ].join("\n");

  return { html, text, subject: `Seu pixel #${input.cellId} foi revelado` };
}