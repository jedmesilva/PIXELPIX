import { logoMark } from "./certificate-email";
import { makeEmailClientSafe } from "./email-compatibility";

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
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>
  <body class="email-body" bgcolor="#0b0d10" style="margin:0;padding:0;background:#0b0d10 !important;background-color:#0b0d10 !important;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Sua solicitação de resgate do PIXELPIX foi registrada. Confira os dados e cancele se algo estiver errado.
    </div>
    <table class="email-outer" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#0b0d10" style="background:#0b0d10 !important;background-color:#0b0d10 !important;">
      <tr>
        <td class="email-outer-cell" align="center" bgcolor="#0b0d10" style="padding:32px 16px;background:#0b0d10 !important;background-color:#0b0d10 !important;">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#14171b" style="max-width:560px;background:#14171b !important;background-color:#14171b !important;border:1px solid #2b333c;border-top:4px solid #00b85c;border-radius:0;box-shadow:4px 4px 0 #0b5b36;overflow:hidden;">
            <tr>
              <td style="padding:28px;border-bottom:1px solid #2b333c;">
                <div style="font-size:19px;font-weight:900;letter-spacing:.04em;color:#e5e7eb;">
                  ${logoMark()}<span style="vertical-align:middle;">PIXELPIX</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 10px;">
                <p style="margin:0 0 8px;color:#00d36c;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">
                  Resgate solicitado
                </p>
                <h1 style="margin:0;color:#f4f7f5;font-size:29px;line-height:1.1;">
                  Sua solicitação foi registrada.
                </h1>
                <p style="margin:14px 0 0;color:#aeb8b2;font-size:15px;line-height:1.6;">
                  Recebemos sua solicitação de resgate do prêmio do pixel #${input.cellId.toLocaleString("pt-BR")}. Você receberá um e-mail sobre o status da solicitação e poderá acompanhar o resgate pelo mesmo link.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#171b20" style="border:1px solid #2b333c;border-radius:0;background:#171b20 !important;background-color:#171b20 !important;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 13px;color:#00b85c;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">Dados da solicitação</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:8px 0;border-bottom:1px solid #2b333c;color:#8b93a1;font-size:12px;">Valor do resgate</td>
                          <td align="right" style="padding:8px 0;border-bottom:1px solid #2b333c;color:#16d878;font-size:16px;font-weight:900;">${amount}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;border-bottom:1px solid #2b333c;color:#8b93a1;font-size:12px;">E-mail informado</td>
                          <td align="right" style="padding:8px 0;border-bottom:1px solid #2b333c;color:#e5e7eb;font-size:12px;font-weight:700;word-break:break-word;">${safeEmail}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;border-bottom:1px solid #2b333c;color:#8b93a1;font-size:12px;">Chave Pix informada</td>
                          <td align="right" style="padding:8px 0;border-bottom:1px solid #2b333c;color:#e5e7eb;font-size:12px;font-weight:700;word-break:break-word;">${safePixKey}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#8b93a1;font-size:12px;">Solicitado em</td>
                          <td align="right" style="padding:8px 0;color:#e5e7eb;font-size:12px;font-weight:700;">${requestedAt}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#20262d" style="background:#20262d !important;background-color:#20262d !important;border:1px solid #00b85c;border-radius:0;">
                  <tr>
                    <td style="padding:16px 20px;color:#e5e7eb;font-size:13px;line-height:1.55;">
                      <strong style="color:#16d878;">Não reconhece este pedido ou informou algo errado?</strong><br>
                      Acesse a tela segura do certificado para conferir os dados e cancelar a solicitação enquanto ela ainda não entrou em pagamento.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;">
                <a href="${safeManageUrl}" style="display:inline-block;width:100%;padding:15px 20px;border-radius:0;background:#00b85c;color:#07150d;font-size:15px;font-weight:900;text-align:center;text-decoration:none;">
                  Conferir ou cancelar resgate
                </a>
                <p style="margin:14px 0 0;color:#8b93a1;font-size:11px;line-height:1.5;text-align:center;">
                  Solicitação #${input.redemptionId} · certificado ${safeCode}
                </p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#0f1316" style="padding:18px 28px;background:#0f1316 !important;background-color:#0f1316 !important;color:#8b93a1;font-size:11px;line-height:1.6;text-align:center;">
                Se os dados estiverem corretos, não é necessário fazer nada. O status poderá ser acompanhado pelo mesmo link.
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

  const safeHtml = makeEmailClientSafe(html);

  const text = [
    "PIXELPIX — Resgate solicitado",
    "",
    `Sua solicitação de resgate do pixel #${input.cellId.toLocaleString("pt-BR")} foi registrada.`,
    "Você receberá um e-mail sobre o status da solicitação e poderá acompanhar o resgate pelo mesmo link.",
    "",
    `Valor do resgate: ${amount}`,
    `E-mail informado: ${input.email}`,
    `Chave Pix informada: ${input.pixKey}`,
    `Solicitado em: ${requestedAt}`,
    `Solicitação: #${input.redemptionId}`,
    `Certificado: ${input.certificateCode}`,
    "",
    "Se os dados estiverem errados ou você não reconhecer o pedido, acesse o link abaixo para conferir e cancelar a solicitação:",
    input.manageUrl,
    "",
    "Se os dados estiverem corretos, não é necessário fazer nada. O status poderá ser acompanhado pelo mesmo link.",
  ].join("\n");

  return {
    html: safeHtml,
    text,
    subject: `PIXELPIX · Resgate solicitado — pixel #${input.cellId}`,
  };
}