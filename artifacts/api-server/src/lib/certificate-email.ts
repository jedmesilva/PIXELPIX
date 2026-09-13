type CertificateEmailInput = {
  cellId: number;
  certificateCode: string;
  certificateToken: string;
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

export function buildCertificateEmail(input: CertificateEmailInput) {
  const hasPrize = input.prizeValueCents > 0;
  const prizeValue = formatBRL(input.prizeValueCents);
  const issuedAt = formatDate(input.issuedAt);
  const emoji = input.emoji || "·";
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(input.backgroundColor ?? "")
    ? input.backgroundColor
    : "#20262d";
  const prizeLabel = input.prizeLabel
    ? escapeHtml(input.prizeLabel)
    : "Prêmio em dinheiro";
  const tokenLabel = hasPrize
    ? "Token privado de resgate"
    : "Token privado do certificado";
  const safeCode = escapeHtml(input.certificateCode);
  const safeToken = escapeHtml(input.certificateToken);
  const safeVisualizeUrl = escapeHtml(input.visualizeUrl);
  const safeRedemptionUrl = input.redemptionUrl
    ? escapeHtml(input.redemptionUrl)
    : null;

  const prizeSection = hasPrize
    ? `
      <tr>
        <td style="padding:0 0 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#20262d" style="background:#20262d;border:1px solid #00b85c;border-radius:14px;">
            <tr>
              <td style="padding:18px 20px;">
                <p style="margin:0 0 7px;color:#8b93a1;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Prêmio liberado</p>
                <div style="color:#16d878;font-size:28px;line-height:1.1;font-weight:900;">${prizeValue}</div>
                <div style="margin-top:5px;color:#e5e7eb;font-size:13px;line-height:1.4;">Faixa ${prizeLabel}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="padding:0 0 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#20262d" style="background:#20262d;border:1px solid #2b333c;border-radius:14px;">
            <tr>
              <td style="padding:16px 20px;color:#aeb8b2;font-size:13px;line-height:1.5;">
                Esta revelação não possui prêmio em dinheiro. Este certificado continua sendo a prova de que o pixel é seu.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

  const redemptionButton = safeRedemptionUrl
    ? `
      <tr>
        <td align="center" style="padding:0 0 10px;">
          <a href="${safeRedemptionUrl}" style="display:inline-block;width:100%;padding:15px 20px;border-radius:10px;background:#00b85c;color:#07150d;font-size:15px;font-weight:900;text-align:center;text-decoration:none;">
            Resgatar prêmio
          </a>
        </td>
      </tr>
    `
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>
  <body bgcolor="#0b0d10" style="margin:0;padding:0;background:#0b0d10;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Seu certificado PIXELPIX está pronto. O pixel #${input.cellId.toLocaleString("pt-BR")} agora é seu.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#0b0d10" style="background:#0b0d10;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#14171b" style="max-width:560px;background:#14171b;border:1px solid #2b333c;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 22px;border-bottom:1px solid #2b333c;">
                <div style="font-size:19px;font-weight:900;letter-spacing:.04em;color:#e5e7eb;">
                  ${logoMark()}<span style="vertical-align:middle;">PIXELPIX</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 10px;">
                <p style="margin:0 0 8px;color:#00d36c;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">
                  Certificado de revelação
                </p>
                <h1 style="margin:0;color:#f4f7f5;font-size:30px;line-height:1.1;">
                  O pixel #${input.cellId.toLocaleString("pt-BR")} é seu.
                </h1>
                <p style="margin:14px 0 0;color:#aeb8b2;font-size:15px;line-height:1.6;">
                  A revelação foi confirmada. Este e-mail é a prova de titularidade do pixel que você revelou.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#171b20" style="border:1px solid #2b333c;border-radius:16px;background:#171b20;">
                  <tr>
                    <td align="center" style="padding:26px 20px 18px;">
                      <div style="display:inline-block;width:128px;height:128px;border-radius:18px;background:${backgroundColor};font-size:58px;line-height:128px;text-align:center;">
                        ${escapeHtml(emoji)}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 20px 25px;">
                      <div style="color:#e5e7eb;font-size:18px;font-weight:900;">Item do pixel</div>
                      <div style="margin-top:6px;color:#8b93a1;font-size:13px;">Revelação #${input.cellId.toLocaleString("pt-BR")}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${prizeSection}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:14px 0 7px;color:#00b85c;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Código do certificado</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 14px;border:1px solid #00b85c;border-radius:10px;background:#20262d;color:#f4f7f5;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:900;letter-spacing:.03em;word-break:break-all;">${safeCode}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 0 7px;color:#00b85c;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">${tokenLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 14px;border:1px solid #34423a;border-radius:10px;background:#11161a;color:#e5e7eb;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.5;word-break:break-all;">${safeToken}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0 0;color:#8b93a1;font-size:12px;">Revelado em <strong style="color:#e5e7eb;">${escapeHtml(issuedAt)}</strong></td>
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
              <td bgcolor="#0f1316" style="padding:18px 28px;background:#0f1316;color:#8b93a1;font-size:11px;line-height:1.6;text-align:center;">
                Guarde este e-mail. O código e o token são pessoais e comprovam a titularidade do seu pixel.
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
    "PIXELPIX — Certificado de revelação",
    "",
    `O pixel #${input.cellId.toLocaleString("pt-BR")} é seu.`,
    `Item do pixel: ${emoji}`,
    ...(hasPrize
      ? [`Prêmio liberado: ${prizeValue}`, `Faixa: ${prizeLabel}`]
      : ["Esta revelação não possui prêmio em dinheiro."]),
    "",
    `Código do certificado: ${input.certificateCode}`,
    `Token privado: ${input.certificateToken}`,
    `Revelado em: ${issuedAt}`,
    "",
    `Visualizar pixel: ${input.visualizeUrl}`,
    ...(input.redemptionUrl
      ? [`Resgatar prêmio: ${input.redemptionUrl}`]
      : ["Não há resgate em dinheiro para esta revelação."]),
  ].join("\n");

  return {
    html,
    text,
    subject: `Seu certificado PIXELPIX · pixel #${input.cellId} revelado`,
  };
}