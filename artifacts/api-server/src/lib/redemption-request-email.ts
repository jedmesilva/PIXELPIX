import { makeEmailClientSafe } from "./email-compatibility";
import { pixelpixEmailLogoMark } from "./pixelpix-email-logo";

type RedemptionRequestEmailInput = {
  redemptionId: number;
  cellId: number;
  certificateCode: string;
  email: string;
  pixKey: string;
  requestedAmountCents: number;
  requestedAt: Date;
  manageUrl: string;
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

export function buildRedemptionRequestEmail(input: RedemptionRequestEmailInput) {
  const amount = formatBRL(input.requestedAmountCents);
  const requestedAt = formatDate(input.requestedAt);
  const safeCode = escapeHtml(input.certificateCode);
  const safeEmail = escapeHtml(input.email);
  const safePixKey = escapeHtml(input.pixKey);
  const safeManageUrl = escapeHtml(input.manageUrl);

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>PIXELPIX — Resgate solicitado</title>
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>
  <body class="email-body" bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Sua solicitação de resgate foi recebida. Confira os dados e acompanhe o status pelo link seguro.
    </div>
    <table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;padding:32px 12px;">
      <tr>
        <td align="center" bgcolor="#000000">
          <table class="email-card" role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#0b0d10" style="max-width:520px;width:100%;background-color:#0b0d10;border:1px solid #1e2126;">
            <tr><td style="padding:24px 28px;border-bottom:1px solid #1e2126;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:54px;">${pixelpixEmailLogoMark()}</td>
                    <td style="font-size:16px;font-weight:800;color:#f4f4f4;letter-spacing:0.5px;padding-left:10px;">PIXELPIX</td>
                  </tr></table>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:32px 28px 4px 28px;">
              <div style="font-size:12px;font-weight:700;color:#2ee66b;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Resgate solicitado</div>
              <div style="font-size:32px;font-weight:800;color:#f4f4f4;line-height:1.2;letter-spacing:-0.5px;">Sua solicitação de resgate foi recebida.</div>
            </td></tr>

            <tr><td style="padding:10px 28px 28px 28px;">
              <div style="font-size:14px;font-weight:600;color:#9aa1ab;line-height:1.5;">Recebemos a sua solicitação de resgate do prêmio de ${amount} do pixel #${input.cellId.toLocaleString("pt-BR")}, pelo certificado ${safeCode}.</div>
            </td></tr>

            <tr><td style="padding:0 28px 4px 28px;">
              <div style="font-size:11px;font-weight:700;color:#2ee66b;letter-spacing:1px;text-transform:uppercase;">Dados da solicitação</div>
            </td></tr>

            <tr><td style="padding:16px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2126;">
                <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:13px;color:#9aa1ab;">Valor do resgate</td>
                    <td align="right" style="font-size:15px;color:#2ee66b;font-weight:800;">${amount}</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:13px;color:#9aa1ab;">E-mail informado</td>
                    <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${safeEmail}</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:13px;color:#9aa1ab;">Chave Pix informada</td>
                    <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${safePixKey}</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:14px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:13px;color:#9aa1ab;">Solicitado em</td>
                    <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;word-break:break-word;">${requestedAt}</td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding:24px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2ee66b" style="background-color:#2ee66b;">
                <a href="${safeManageUrl}" style="display:block;width:auto;max-width:100%;box-sizing:border-box;padding:14px;font-size:14px;font-weight:800;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">ACOMPANHAR SOLICITAÇÃO</a>
              </td></tr></table>
            </td></tr>

            <tr><td style="padding:12px 28px 0 28px;">
              <div style="font-size:12px;color:#5c6470;text-align:center;line-height:1.5;">Você receberá um e-mail assim que o status do resgate for atualizado.</div>
            </td></tr>

            <tr><td style="padding:20px 28px 28px 28px;">
              <div style="font-size:13px;color:#9aa1ab;text-align:center;line-height:1.6;margin-bottom:12px;">
                Não reconhece este pedido ou informou algo errado? <a href="${safeManageUrl}" style="color:#2ee66b;text-decoration:underline;font-weight:700;">Cancelar solicitação</a>
              </div>
              <div style="font-size:11px;color:#4a4f57;text-align:center;line-height:1.6;">
                Se você reconhece o resgate, não é necessário realizar nenhuma ação.
              </div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const safeHtml = makeEmailClientSafe(html);

  const text = [
    "PIXELPIX — Resgate solicitado",
    "",
    "Sua solicitação de resgate foi recebida.",
    `Recebemos a sua solicitação de resgate do prêmio de ${amount} do pixel #${input.cellId.toLocaleString("pt-BR")}, pelo certificado ${input.certificateCode}.`,
    "",
    "Dados da solicitação",
    `Valor do resgate: ${amount}`,
    `E-mail informado: ${input.email}`,
    `Chave Pix informada: ${input.pixKey}`,
    `Solicitado em: ${requestedAt}`,
    "",
    `Acompanhar solicitação: ${input.manageUrl}`,
    "",
    "Você receberá um e-mail assim que o status do resgate for atualizado.",
    "",
    "Não reconhece este pedido ou informou algo errado? Acesse o link acima para conferir e cancelar a solicitação.",
    "",
    "Se você reconhece o resgate, não é necessário realizar nenhuma ação.",
  ].join("\n");

  return {
    html: safeHtml,
    text,
    subject: "PIXELPIX — Resgate solicitado",
  };
}