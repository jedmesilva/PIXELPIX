import { makeEmailClientSafe } from "./email-compatibility";

type CertificateEmailInput = {
  cellId: number;
  certificateCode: string;
  certificateToken: string;
  prizeValueCents: number;
  remainingPrizeValueCents?: number;
  emoji?: string | null;
  backgroundColor?: string | null;
  issuedAt: Date;
  visualizeUrl: string;
  revealUrl: string;
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

export function logoMark() {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;width:44px;height:58px;vertical-align:middle;margin-right:10px;">
      <tr>
        <td width="12" height="12"></td>
        <td width="2"></td>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
        <td width="2"></td>
        <td width="12" height="12"></td>
      </tr>
      <tr><td height="2" colspan="5"></td></tr>
      <tr>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
        <td width="2"></td>
        <td width="12" height="12"></td>
        <td width="2"></td>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
      </tr>
      <tr><td height="2" colspan="5"></td></tr>
      <tr>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
        <td width="2"></td>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
        <td width="2"></td>
        <td width="12" height="12"></td>
      </tr>
      <tr><td height="2" colspan="5"></td></tr>
      <tr>
        <td width="12" height="12" bgcolor="#00b85c" style="width:12px;height:12px;background:#00b85c;"></td>
        <td width="2" colspan="4"></td>
      </tr>
    </table>
  `;
}

function pixelSummary(input: {
  cellId: number;
  emoji: string;
  backgroundColor: string;
}) {
  return `
    <tr>
      <td style="padding:0 28px 28px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2126;">
          <tr>
            <td style="width:76px;padding:16px 0 16px 16px;">
              <div class="email-pixel-tile" style="width:60px;height:60px;background-color:${input.backgroundColor};border:1px solid #2ee66b;text-align:center;line-height:60px;font-size:28px;">
                ${escapeHtml(input.emoji)}
              </div>
            </td>
            <td style="padding:16px;vertical-align:middle;">
              <div style="font-size:20px;font-weight:800;color:#f4f4f4;">Pixel #${input.cellId.toLocaleString("pt-BR")}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function buildCertificateEmail(input: CertificateEmailInput) {
  const hasPrize = input.prizeValueCents > 0;
  const prizeValue = formatBRL(input.prizeValueCents);
  const issuedAt = formatDate(input.issuedAt);
  const emoji = input.emoji || "·";
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(input.backgroundColor ?? "")
    ? input.backgroundColor!
    : "#15181d";
  const safeCode = escapeHtml(input.certificateCode);
  const safeToken = escapeHtml(input.certificateToken);
  const safeVisualizeUrl = escapeHtml(input.visualizeUrl);
  const safeRevealUrl = escapeHtml(input.revealUrl);
  const safeRedemptionUrl = input.redemptionUrl
    ? escapeHtml(input.redemptionUrl)
    : null;
  const remainingPrizeCopy =
    input.remainingPrizeValueCents && input.remainingPrizeValueCents > 0
      ? ` ${formatBRL(input.remainingPrizeValueCents)} em Pix ainda estão escondidos por aí.`
      : "";
  const prizeSection = hasPrize
    ? `
      <tr>
        <td style="padding:0 28px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1f16;border:1px solid #2ee66b;">
            <tr><td style="padding:20px 20px 4px 20px;">
              <div style="font-size:11px;font-weight:700;color:#2ee66b;letter-spacing:1px;text-transform:uppercase;">Prêmio deste pixel</div>
            </td></tr>
            <tr><td style="padding:2px 20px 18px 20px;">
              <div style="font-size:34px;font-weight:800;color:#f4f4f4;letter-spacing:-0.5px;">${prizeValue}</div>
            </td></tr>
            ${
              safeRedemptionUrl
                ? `<tr><td style="padding:0 20px 20px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background-color:#2ee66b;">
                      <a href="${safeRedemptionUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">RESGATAR PRÊMIO</a>
                    </td></tr></table>
                  </td></tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="padding:0 28px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#15181d;border:1px solid #2a2f37;">
            <tr><td style="padding:20px 20px 14px 20px;">
              <div style="font-size:14px;font-weight:600;color:#9aa1ab;line-height:1.6;">Nenhum Pix neste pixel. Continue revelando.${remainingPrizeCopy}</div>
            </td></tr>
            <tr><td style="padding:0 20px 20px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background-color:#2ee66b;">
                <a href="${safeRevealUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">REVELAR OUTRO PIXEL</a>
              </td></tr></table>
            </td></tr>
          </table>
        </td>
      </tr>
    `;
  const footerCopy = hasPrize
    ? "O código e o token do certificado devem ser guardados com segurança — são os dados necessários para solicitar o resgate do prêmio."
    : "O código e o token do certificado devem ser guardados com segurança — são os dados que comprovam a titularidade deste pixel.";
  const preheader = hasPrize
    ? `O pixel #${input.cellId.toLocaleString("pt-BR")} foi revelado e tem um prêmio disponível para resgate.`
    : `O certificado do pixel #${input.cellId.toLocaleString("pt-BR")} está pronto.`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body class="email-body" bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#0b0d10;border:1px solid #1e2126;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #1e2126;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:16px;font-weight:800;color:#f4f4f4;letter-spacing:0.5px;">
                ${logoMark()}<span style="vertical-align:middle;">PIXELPIX</span>
              </div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 28px 4px 28px;">
          <div style="font-size:12px;font-weight:700;color:#2ee66b;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Certificado</div>
          <div style="font-size:38px;font-weight:800;color:#f4f4f4;line-height:1.15;letter-spacing:-0.5px;">Pixel <span style="color:#2ee66b;">#${input.cellId.toLocaleString("pt-BR")}</span></div>
        </td></tr>
        <tr><td style="padding:10px 28px 24px 28px;">
          <div style="font-size:14px;font-weight:600;color:#9aa1ab;line-height:1.5;">Este certificado é a prova de titularidade de que você revelou o pixel #${input.cellId.toLocaleString("pt-BR")} em ${escapeHtml(issuedAt)}.</div>
        </td></tr>
        ${pixelSummary({
          cellId: input.cellId,
          emoji,
          backgroundColor,
        })}
        ${prizeSection}
        <tr><td style="padding:0 28px;"><hr style="border:none;border-top:1px solid #1e2126;margin:0;"></td></tr>
        <tr><td style="padding:24px 28px 4px 28px;">
          <div style="font-size:11px;font-weight:700;color:#f4f4f4;letter-spacing:1px;text-transform:uppercase;">Registro do certificado</div>
        </td></tr>
        <tr><td style="padding:16px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2126;">
            <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
              <div style="font-size:10px;color:#5c6470;margin-bottom:4px;">Revelado em</div>
              <div style="font-size:13px;color:#f4f4f4;font-weight:600;">${escapeHtml(issuedAt)}</div>
            </td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
              <div style="font-size:10px;color:#5c6470;margin-bottom:4px;">Código do certificado</div>
              <div style="font-size:13px;color:#2ee66b;font-family:'SF Mono',Consolas,monospace;word-break:break-all;">${safeCode}</div>
            </td></tr>
            <tr><td style="padding:14px 16px;">
              <div style="font-size:10px;color:#5c6470;margin-bottom:4px;">Token privado do certificado</div>
              <div style="font-size:11px;color:#6b7280;font-family:'SF Mono',Consolas,monospace;word-break:break-all;">${safeToken}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:1px solid #2ee66b;">
            <a href="${safeVisualizeUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#2ee66b;text-decoration:none;letter-spacing:0.3px;">VER PIXEL</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <div style="font-size:11px;color:#4a4f57;text-align:center;line-height:1.6;">${footerCopy}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "PIXELPIX — Certificado",
    "",
    `Pixel #${input.cellId.toLocaleString("pt-BR")}`,
    `Este certificado é a prova de titularidade de que você revelou o pixel #${input.cellId.toLocaleString("pt-BR")} em ${issuedAt}.`,
    `Item do pixel: ${emoji}`,
    "",
    ...(hasPrize
      ? [
          `Prêmio deste pixel: ${prizeValue}`,
          ...(input.redemptionUrl
            ? [`Resgatar prêmio: ${input.redemptionUrl}`]
            : []),
        ]
      : [
          `Nenhum Pix neste pixel. Continue revelando.${remainingPrizeCopy}`,
          `Revelar outro pixel: ${input.revealUrl}`,
        ]),
    "",
    "Registro do certificado",
    `Revelado em: ${issuedAt}`,
    `Código do certificado: ${input.certificateCode}`,
    `Token privado do certificado: ${input.certificateToken}`,
    "",
    `Ver pixel: ${input.visualizeUrl}`,
    "",
    footerCopy,
  ].join("\n");

  return {
    html: makeEmailClientSafe(html),
    text,
    subject: `Seu certificado PIXELPIX · pixel #${input.cellId} revelado`,
  };
}