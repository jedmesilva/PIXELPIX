import { makeEmailClientSafe } from "./email-compatibility";

export type RedemptionNotificationStatus =
  | "approved"
  | "payment_pending"
  | "paid"
  | "rejected"
  | "failed";

export type RedemptionNotificationKind =
  | RedemptionNotificationStatus
  | "cancelled";

export type RedemptionStatusEmailInput = {
  redemptionId: number;
  cellId: number;
  certificateCode: string;
  email: string;
  pixKey: string;
  amountCents: number;
  status: RedemptionNotificationStatus;
  notificationKind: RedemptionNotificationKind;
  rejectionReason?: string | null;
  updatedAt: Date;
  publicUrl: string;
  shareUrl: string;
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

function copyForStatus(status: RedemptionNotificationKind) {
  switch (status) {
    case "approved":
      return {
        label: "Resgate aprovado",
        headline: "Seu resgate foi aprovado.",
        description:
          "A solicitação do seu prêmio foi aprovada e o pagamento será preparado.",
        footer: "Você receberá um novo e-mail quando o pagamento for concluído.",
      };
    case "payment_pending":
      return {
        label: "Pagamento em processamento",
        headline: "Seu pagamento está sendo processado.",
        description:
          "O pagamento do resgate foi iniciado. Avisaremos assim que o valor for confirmado.",
        footer: "Não é necessário realizar nenhuma ação enquanto o pagamento é processado.",
      };
    case "rejected":
      return {
        label: "Resgate recusado",
        headline: "Sua solicitação de resgate foi recusada.",
        description: "Não foi possível concluir o resgate.",
        footer:
          "O prêmio deste pixel continua disponível. Nenhum valor foi debitado ou transferido.",
      };
    case "cancelled":
      return {
        label: "Resgate cancelado",
        headline: "Sua solicitação de resgate foi cancelada.",
        description: "A solicitação foi cancelada a seu pedido.",
        footer:
          "O prêmio deste pixel continua disponível. Você pode solicitar o resgate novamente quando quiser.",
      };
    case "failed":
      return {
        label: "Pagamento não concluído",
        headline: "O pagamento não foi concluído.",
        description:
          "Não conseguimos concluir o pagamento deste resgate. O status foi atualizado no PIXELPIX.",
        footer: "Se precisar de ajuda, responda a este e-mail.",
      };
    case "paid":
      return {
        label: "Pagamento realizado",
        headline: "Seu Pix caiu na conta.",
        description:
          "O pagamento do resgate foi concluído. O valor já está disponível na chave Pix informada.",
        footer: "Guarde este e-mail como comprovante do pagamento.",
      };
  }
}

function logoMark() {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:32px;">
        <table role="presentation" cellpadding="0" cellspacing="2"><tr>
          <td width="9" height="9" bgcolor="#2ee66b" style="width:9px;height:9px;background-color:#2ee66b;"></td>
          <td width="9" height="9" bgcolor="#0b0d10" style="width:9px;height:9px;background-color:#0b0d10;"></td>
        </tr>
        <tr>
          <td width="9" height="9" bgcolor="#0b0d10" style="width:9px;height:9px;background-color:#0b0d10;"></td>
          <td width="9" height="9" bgcolor="#2ee66b" style="width:9px;height:9px;background-color:#2ee66b;"></td>
        </tr></table>
      </td>
      <td style="font-size:16px;font-weight:800;color:#f4f4f4;letter-spacing:0.5px;padding-left:10px;">PIXELPIX</td>
    </tr></table>
  `;
}

function buildCancelledOrRejectedEmail(
  input: RedemptionStatusEmailInput,
  kind: "cancelled" | "rejected",
  amount: string,
  cellLabel: string,
) {
  const copy = copyForStatus(kind);
  const safeCode = escapeHtml(input.certificateCode);
  const safeReason = escapeHtml(
    input.rejectionReason?.trim() ||
      "Os dados informados não puderam ser validados. Confira os dados e envie uma nova solicitação.",
  );
  const resubmitUrl = escapeHtml(
    `${input.publicUrl}/resgatar?code=${encodeURIComponent(input.certificateCode)}`,
  );
  const isCancelled = kind === "cancelled";
  const detail = isCancelled
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2126;background-color:#15181d;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:13px;color:#9aa1ab;line-height:1.5;">Nenhum valor foi transferido. O prêmio deste pixel continua disponível e você pode solicitar o resgate novamente quando quiser.</div>
        </td></tr>
      </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #4a2a26;background-color:#1a1210;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:11px;font-weight:700;color:#ff6b5c;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Motivo da recusa</div>
          <div style="font-size:13px;color:#c9beba;line-height:1.5;">${safeReason}</div>
        </td></tr>
      </table>`;
  const cta = isCancelled ? "SOLICITAR RESGATE NOVAMENTE" : "TENTAR NOVAMENTE";
  const text = [
    `PIXELPIX — ${copy.label}`,
    "",
    copy.headline,
    isCancelled
      ? `A solicitação de resgate do prêmio de ${amount} do pixel #${cellLabel}, pelo certificado ${input.certificateCode}, foi cancelada a seu pedido.`
      : `Não foi possível concluir o resgate do prêmio de ${amount} do pixel #${cellLabel}, pelo certificado ${input.certificateCode}.`,
    "",
    ...(isCancelled
      ? [
          "Nenhum valor foi transferido.",
          "O prêmio deste pixel continua disponível e você pode solicitar o resgate novamente quando quiser.",
        ]
      : [`Motivo da recusa: ${input.rejectionReason?.trim() || "Os dados informados não puderam ser validados. Confira os dados e envie uma nova solicitação."}`]),
    "",
    `${cta[0] + cta.slice(1).toLowerCase()}: ${`${input.publicUrl}/resgatar?code=${encodeURIComponent(input.certificateCode)}`}`,
    "",
    copy.footer,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>PIXELPIX — ${copy.label}</title>
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body class="email-body" bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.headline)} Pixel #${cellLabel}.</div>
  <table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;padding:32px 12px;">
    <tr><td align="center" bgcolor="#000000">
      <table class="email-card" role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#0b0d10" style="max-width:520px;width:100%;background-color:#0b0d10;border:1px solid #1e2126;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #1e2126;">
          ${logoMark()}
        </td></tr>
        <tr><td style="padding:32px 28px 4px 28px;">
          <div style="font-size:12px;font-weight:700;color:${isCancelled ? "#9aa1ab" : "#ff6b5c"};letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${copy.label}</div>
          <div style="font-size:32px;font-weight:800;color:#f4f4f4;line-height:1.2;letter-spacing:-0.5px;">${copy.headline}</div>
        </td></tr>
        <tr><td style="padding:10px 28px 28px 28px;">
          <div style="font-size:14px;font-weight:600;color:#9aa1ab;line-height:1.5;">${isCancelled ? `A solicitação de resgate do prêmio de ${amount} do pixel #${cellLabel}, pelo certificado ${safeCode}, foi cancelada a seu pedido.` : `Não foi possível concluir o resgate do prêmio de ${amount} do pixel #${cellLabel}, pelo certificado ${safeCode}.`}</div>
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;">
          ${detail}
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2ee66b" style="background-color:#2ee66b;">
            <a href="${resubmitUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">${cta}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;">
          <div style="font-size:11px;color:#4a4f57;text-align:center;line-height:1.6;">${copy.footer}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    html: makeEmailClientSafe(html),
    text,
    subject: `PIXELPIX — ${copy.label} · pixel #${input.cellId}`,
  };
}

export function buildRedemptionStatusEmail(input: RedemptionStatusEmailInput) {
  const copy = copyForStatus(input.status);
  const amount = formatBRL(input.amountCents);
  const updatedAt = formatDate(input.updatedAt);
  const cellLabel = input.cellId.toLocaleString("pt-BR");
  const safePixKey = escapeHtml(input.pixKey);
  const safeCode = escapeHtml(input.certificateCode);
  const safePublicUrl = escapeHtml(input.publicUrl);
  const safeShareUrl = escapeHtml(input.shareUrl);
  const isPaid = input.status === "paid";

  if (input.notificationKind === "cancelled" || input.notificationKind === "rejected") {
    return buildCancelledOrRejectedEmail(
      input,
      input.notificationKind,
      amount,
      cellLabel,
    );
  }

  const primaryCta = isPaid
    ? `<tr><td style="padding:28px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2ee66b" style="background-color:#2ee66b;">
          <a href="${safePublicUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">REVELAR OUTRO PIXEL</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:12px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:1px solid #2ee66b;">
          <a href="${safeShareUrl}" style="display:block;padding:13px;font-size:14px;font-weight:800;color:#2ee66b;text-decoration:none;letter-spacing:0.3px;">COMPARTILHAR</a>
        </td></tr></table>
      </td></tr>`
    : `<tr><td style="padding:28px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:1px solid #2ee66b;">
          <a href="${safeShareUrl}" style="display:block;padding:14px;font-size:14px;font-weight:800;color:#2ee66b;text-decoration:none;letter-spacing:0.3px;">VER PIXEL</a>
        </td></tr></table>
      </td></tr>`;

  const text = [
    `PIXELPIX — ${copy.label}`,
    "",
    copy.headline,
    `O status do resgate do pixel #${cellLabel} foi atualizado.`,
    "",
    "Dados do pagamento",
    `Valor do resgate: ${amount}`,
    `Chave Pix: ${input.pixKey}`,
    `${isPaid ? "Pago em" : "Atualizado em"}: ${updatedAt}`,
    `Certificado: ${input.certificateCode}`,
    "",
    `${isPaid ? "Revelar outro pixel" : "Ver pixel"}: ${isPaid ? input.publicUrl : input.shareUrl}`,
    "",
    copy.footer,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>PIXELPIX — ${copy.label}</title>
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body class="email-body" bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.headline)} O status do resgate do pixel #${cellLabel} foi atualizado.</div>
  <table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;padding:32px 12px;">
    <tr><td align="center" bgcolor="#000000">
      <table class="email-card" role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#0b0d10" style="max-width:520px;width:100%;background-color:#0b0d10;border:1px solid #1e2126;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #1e2126;">
          ${logoMark()}
        </td></tr>
        <tr><td style="padding:32px 28px 4px 28px;">
          <div style="font-size:12px;font-weight:700;color:#2ee66b;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${copy.label}</div>
          <div style="font-size:32px;font-weight:800;color:#f4f4f4;line-height:1.2;letter-spacing:-0.5px;">${copy.headline}</div>
        </td></tr>
        <tr><td style="padding:10px 28px 28px 28px;">
          <div style="font-size:14px;font-weight:600;color:#9aa1ab;line-height:1.5;">${copy.description} Pixel #${cellLabel}.</div>
        </td></tr>
        <tr><td style="padding:0 28px 4px 28px;">
          <div style="font-size:11px;font-weight:700;color:#2ee66b;letter-spacing:1px;text-transform:uppercase;">Dados do pagamento</div>
        </td></tr>
        <tr><td style="padding:16px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2126;">
            <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:13px;color:#9aa1ab;">${isPaid ? "Valor pago" : "Valor do resgate"}</td>
                <td align="right" style="font-size:15px;color:#2ee66b;font-weight:800;">${amount}</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:13px;color:#9aa1ab;">Chave Pix</td>
                <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${safePixKey}</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid #1e2126;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:13px;color:#9aa1ab;">${isPaid ? "Pago em" : "Atualizado em"}</td>
                <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;word-break:break-word;">${updatedAt}</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:13px;color:#9aa1ab;">Certificado</td>
                <td align="right" style="font-size:13px;color:#f4f4f4;font-weight:700;font-family:'SF Mono',Consolas,monospace;word-break:break-all;">${safeCode}</td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
        ${primaryCta}
        <tr><td style="padding:20px 28px 28px 28px;">
          <div style="font-size:11px;color:#4a4f57;text-align:center;line-height:1.6;">${copy.footer}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    html: makeEmailClientSafe(html),
    text,
    subject: `PIXELPIX — ${copy.label} · pixel #${input.cellId}`,
  };
}