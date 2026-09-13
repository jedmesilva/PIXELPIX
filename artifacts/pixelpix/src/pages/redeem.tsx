import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock3, Loader2, LockKeyhole, XCircle } from "lucide-react";
import { Link } from "wouter";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

type CertificateVerification = {
  certificateCode: string;
  cellId: number;
  prizeValueCents: number;
  email: string;
  issuedAt: string;
  status: string;
  redemptionStatus: string | null;
  redemption: {
    id: number;
    status: string;
    requestedAt: string;
    rejectionReason: string | null;
  } | null;
  canRedeem: boolean;
};

const redemptionStatusLabels: Record<string, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  payment_pending: "Pagamento em processamento",
  paid: "Pagamento realizado",
  rejected: "Solicitação rejeitada",
  failed: "Falha no pagamento",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function redemptionStatusLabel(status: string, rejectionReason?: string | null) {
  if (
    status === "rejected" &&
    rejectionReason?.toLowerCase().includes("cancelado pelo titular")
  ) {
    return "Cancelado pelo titular";
  }
  return redemptionStatusLabels[status] ?? "Status atualizado";
}

function RedemptionStatus({
  redemption,
  canRedeem,
  onCancel,
  cancelling,
  confirmingCancel,
  onAskCancel,
  onDismissCancel,
}: {
  redemption: NonNullable<CertificateVerification["redemption"]>;
  canRedeem: boolean;
  onCancel: () => void;
  cancelling: boolean;
  confirmingCancel: boolean;
  onAskCancel: () => void;
  onDismissCancel: () => void;
}) {
  const isRejected = redemption.status === "rejected" || redemption.status === "failed";
  const isPaid = redemption.status === "paid";
  const isCancelled =
    redemption.status === "rejected" &&
    redemption.rejectionReason?.toLowerCase().includes("cancelado pelo titular");
  const canCancel = redemption.status === "pending" || redemption.status === "approved";
  const StatusIcon = isRejected ? XCircle : isPaid ? CheckCircle2 : Clock3;

  return (
    <div className={`redeem-status ${isRejected ? "is-rejected" : isPaid ? "is-paid" : ""}`}>
      <div className="redeem-status-heading">
        <StatusIcon size={20} aria-hidden="true" />
        <div>
          <span>Status do resgate</span>
          <strong>{redemptionStatusLabel(redemption.status, redemption.rejectionReason)}</strong>
        </div>
      </div>
      <p>
        Solicitação registrada em {formatDate(redemption.requestedAt)}.
        {isCancelled
          ? " O pedido foi interrompido e você pode solicitar novamente."
          : isPaid
          ? " O pagamento foi concluído."
          : isRejected
            ? " Você pode enviar uma nova solicitação com os dados corrigidos."
            : redemption.status === "payment_pending"
              ? " O pagamento já foi iniciado e não pode mais ser interrompido."
            : " Você pode voltar a esta tela pelo link do e-mail para acompanhar a atualização."}
      </p>
      {canRedeem && isRejected && (
        <small>O formulário de solicitação está disponível novamente abaixo.</small>
      )}
      {canCancel && !confirmingCancel && (
        <button
          className="redeem-cancel-button"
          type="button"
          onClick={onAskCancel}
          disabled={cancelling}
        >
          Cancelar esta solicitação
        </button>
      )}
      {canCancel && confirmingCancel && (
        <div className="redeem-cancel-confirmation">
          <p>Confirme apenas se os dados estiverem errados ou se você não reconhece este pedido.</p>
          <div>
            <button
              className="redeem-button redeem-button-danger"
              type="button"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button
              className="redeem-cancel-button"
              type="button"
              onClick={onDismissCancel}
              disabled={cancelling}
            >
              Manter solicitação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PixelPixLogo() {
  return (
    <div className="redeem-brand">
      <svg
        className="redeem-brand-logo"
        viewBox="0 0 149 200"
        fill="none"
        aria-hidden="true"
      >
        <rect x="51.5" y="0" width="44.4" height="44.4" />
        <rect x="0" y="51.9" width="44.4" height="44.4" />
        <rect x="104.1" y="51.9" width="44.4" height="44.4" />
        <rect x="0" y="103.7" width="44.4" height="44.4" />
        <rect x="51.5" y="103.7" width="44.4" height="44.4" />
        <rect x="0" y="155.6" width="44.4" height="44.4" />
      </svg>
      <span>PIXELPIX</span>
    </div>
  );
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Não foi possível concluir a operação.",
    );
  }
  return data;
}

export default function RedeemPage() {
  const initialValues = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      code: params.get("code") ?? "",
      token: fragment.get("token") ?? params.get("token") ?? "",
    };
  }, []);
  const [certificateCode, setCertificateCode] = useState(initialValues.code);
  const [token, setToken] = useState(initialValues.token);
  const [email, setEmail] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [certificate, setCertificate] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(Boolean(initialValues.code && initialValues.token));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const verify = async () => {
    if (!certificateCode.trim() || !token.trim()) {
      setMessage("Informe o código e o token do certificado.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        code: certificateCode.trim().toUpperCase(),
        token: token.trim(),
      });
      const response = await fetch(`${apiBaseUrl}/api/certificates/verify?${params}`);
      const data = await readJson(response);
      setCertificate(data);
      if (Number(data.prizeValueCents) <= 0) {
        setMessage("Este pixel não possui valor em Pix disponível para resgate.");
      } else if (!data.canRedeem) {
        setMessage("Este certificado já possui um resgate em processamento.");
      }
    } catch (error) {
      setCertificate(null);
      setMessage(error instanceof Error ? error.message : "Certificado inválido.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialValues.code && initialValues.token) void verify();
    // The URL is intentionally read once: the token stays in the fragment and
    // is never sent to the server as part of the page request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!certificate?.canRedeem) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/redemptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateCode: certificate.certificateCode,
          token: token.trim(),
          email: email.trim(),
          pixKey: pixKey.trim(),
        }),
      });
      const data = await readJson(response);
      setCertificate((current) =>
        current
          ? {
              ...current,
              redemptionStatus: String(data.status),
              redemption: {
                id: Number(data.id),
                status: String(data.status),
                requestedAt: String(data.requestedAt),
                rejectionReason: null,
              },
              canRedeem: false,
            }
          : current,
      );
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o resgate.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRedemption = async () => {
    if (!certificate?.redemption) return;
    setCancelling(true);
    setMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/redemptions/${certificate.redemption.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            certificateCode: certificate.certificateCode,
            token: token.trim(),
          }),
        },
      );
      const data = await readJson(response);
      setCertificate((current) =>
        current?.redemption
          ? {
              ...current,
              redemptionStatus: "rejected",
              redemption: {
                ...current.redemption,
                status: "rejected",
                requestedAt: String(data.requestedAt ?? current.redemption.requestedAt),
                rejectionReason: "Cancelado pelo titular do certificado.",
              },
              canRedeem: true,
            }
          : current,
      );
      setSubmitted(false);
      setConfirmingCancel(false);
      setMessage("Solicitação cancelada. Você pode corrigir os dados e solicitar novamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="redeem-page">
      <div className="redeem-shell">
        <nav className="redeem-navigation" aria-label="Navegação da tela de resgate">
          <Link href="/" className="redeem-back">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao início
          </Link>
        </nav>
        <PixelPixLogo />
        <section className="redeem-card">
          <div className="redeem-icon"><BadgeCheck size={25} /></div>
          <p className="redeem-kicker">Certificado de prêmio</p>
          <h1>
            {submitted
              ? "Solicitação recebida"
              : certificate?.redemption
                ? "Acompanhe seu resgate"
                : "Resgate seu prêmio"}
          </h1>
          {submitted ? (
            <>
              <div className="redeem-success">
                <CheckCircle2 size={26} />
                <p>
                  Seu pedido foi enviado para análise. A administração conferirá o certificado e a chave Pix antes de realizar o pagamento.
                </p>
              </div>
              {certificate?.redemption && (
                <RedemptionStatus
                  redemption={certificate.redemption}
                  canRedeem={certificate.canRedeem}
                  onCancel={() => void cancelRedemption()}
                  cancelling={cancelling}
                  confirmingCancel={confirmingCancel}
                  onAskCancel={() => setConfirmingCancel(true)}
                  onDismissCancel={() => setConfirmingCancel(false)}
                />
              )}
            </>
          ) : (
            <>
              <p className="redeem-copy">
                Valide o certificado recebido por e-mail e informe a chave Pix que deverá receber o valor liberado. Você poderá voltar pelo mesmo link para acompanhar o status.
              </p>
              <div className="redeem-security-note">
                <LockKeyhole size={15} />
                O token é usado apenas para provar a posse do certificado e não é armazenado em texto aberto.
              </div>
              <div className="redeem-fields">
                <label>
                  Código do certificado
                  <input value={certificateCode} onChange={(event) => setCertificateCode(event.target.value)} placeholder="PPX-2026-000000-XXXXXXXX" />
                </label>
                <label>
                  Token do certificado
                  <textarea value={token} onChange={(event) => setToken(event.target.value)} placeholder="Cole o token ou use o link recebido por e-mail" rows={3} />
                </label>
                <button className="redeem-button redeem-button-secondary" type="button" onClick={() => void verify()} disabled={loading}>
                  {loading && <Loader2 className="redeem-spin" size={15} />}
                  {loading ? "Validando…" : certificate ? "Atualizar status" : "Validar certificado"}
                </button>
              </div>
              {certificate && (
                <div className="redeem-certificate-summary">
                  <div><span>Certificado</span><strong>{certificate.certificateCode}</strong></div>
                  <div><span>Célula</span><strong>#{certificate.cellId}</strong></div>
                  <div><span>Valor liberado</span><strong>{formatBRL(certificate.prizeValueCents)}</strong></div>
                  <div><span>E-mail cadastrado</span><strong>{certificate.email}</strong></div>
                </div>
              )}
              {certificate?.redemption && (
                <RedemptionStatus
                  redemption={certificate.redemption}
                  canRedeem={certificate.canRedeem}
                  onCancel={() => void cancelRedemption()}
                  cancelling={cancelling}
                  confirmingCancel={confirmingCancel}
                  onAskCancel={() => setConfirmingCancel(true)}
                  onDismissCancel={() => setConfirmingCancel(false)}
                />
              )}
              {certificate?.canRedeem && (
                <form className="redeem-fields redeem-form-divider" onSubmit={submit}>
                  <label>
                    E-mail usado na compra
                    <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" />
                  </label>
                  <label>
                    Chave Pix para receber
                    <input required value={pixKey} onChange={(event) => setPixKey(event.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" maxLength={120} />
                  </label>
                  <button className="redeem-button" type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="redeem-spin" size={15} />}
                    {submitting ? "Enviando solicitação…" : "Solicitar resgate"}
                  </button>
                </form>
              )}
            </>
          )}
          {message && <p className="redeem-message" role="alert">{message}</p>}
        </section>
      </div>
    </main>
  );
}