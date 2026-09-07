import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
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
  canRedeem: boolean;
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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
      if (!data.canRedeem) {
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
      await readJson(response);
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o resgate.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="redeem-page">
      <div className="redeem-shell">
        <Link href="/" className="redeem-back">
          <ArrowLeft size={16} /> Voltar ao PIXELPIX
        </Link>
        <div className="redeem-brand">PIXELPIX</div>
        <section className="redeem-card">
          <div className="redeem-icon"><BadgeCheck size={25} /></div>
          <p className="redeem-kicker">Certificado de prêmio</p>
          <h1>{submitted ? "Solicitação recebida" : "Resgate seu prêmio"}</h1>
          {submitted ? (
            <div className="redeem-success">
              <CheckCircle2 size={26} />
              <p>
                Seu pedido foi enviado para análise. A administração conferirá o certificado e a chave Pix antes de realizar o pagamento.
              </p>
            </div>
          ) : (
            <>
              <p className="redeem-copy">
                Valide o certificado recebido por e-mail e informe a chave Pix que deverá receber o valor liberado.
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
                  {loading ? "Validando…" : "Validar certificado"}
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