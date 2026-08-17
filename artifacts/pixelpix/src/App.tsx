import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, Copy, Loader2, Lock, Mail } from "lucide-react";
import { FiInstagram } from "react-icons/fi";
import { RiTwitterXFill } from "react-icons/ri";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";

const queryClient = new QueryClient();
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const TOTAL_PIXELS = 1_000_000;
const LOGICAL_COLUMNS = 1_000;
const MIN_CELL_PX = 34;
// A chunk of 10k cells keeps the request count low while remaining small
// enough for a quick sparse response. Available cells are rendered locally.
const CHUNK_SIZE = 10_000;
const STARTING_PIXEL_PRICE = 1;
const RECEIPT_EMAIL_STORAGE_KEY = "pixelpix-receipt-email";
const SOCIAL_PROFILE_STORAGE_KEY = "pixelpix-social-profile";
const CURRENT_USER_NICKNAME = "você";

type Pixel = {
  id: number;
  backgroundColor: string | null;
  revealed: boolean;
  emoji: string | null;
  revealedBy: string | null;
  revealedAt: Date | null;
  prizeValueCents: number;
  prizeLabel: string | null;
  socialProfile: SocialProfile;
  status: "available" | "reserved" | "paid";
};

type SignatureNetwork = "instagram" | "x";

type SocialProfile = {
  network: SignatureNetwork;
  handle: string;
};

const EMPTY_SOCIAL_PROFILE: SocialProfile = { network: "instagram", handle: "" };

const chunkCache = new Map<number, Map<number, Pixel>>();
type ChunkStatus = "loading" | "loaded" | "error";

function emptyPixel(id: number): Pixel {
  return {
    id,
    backgroundColor: generatedCellBackground(id),
    revealed: false,
    emoji: null,
    revealedBy: null,
    revealedAt: null,
    prizeValueCents: 0,
    prizeLabel: null,
    socialProfile: EMPTY_SOCIAL_PROFILE,
    status: "available",
  };
}

function generatedCellBackground(id: number) {
  // This mirrors the server's stable visual seed. Keeping it local means the
  // million-cell canvas never needs a million-row response just to paint locks.
  const hash = (id * 2_654_435_761) % 4_294_967_296;
  const lightness = 14 + (hash % 1_000) / 100;
  return `hsl(220, 8%, ${lightness}%)`;
}

function getChunk(chunkId: number) {
  const cached = chunkCache.get(chunkId);
  if (cached) return cached;

  const chunk = new Map<number, Pixel>();
  chunkCache.set(chunkId, chunk);
  return chunk;
}

function getPixel(id: number) {
  const chunk = getChunk(Math.floor(id / CHUNK_SIZE));
  const pixel = chunk.get(id);
  if (pixel) return pixel;
  const created = emptyPixel(id);
  chunk.set(id, created);
  return created;
}

function revealPixelInCache(
  id: number,
  emoji: string,
  backgroundColor: string,
  revealedBy: string | null,
  socialProfile: SocialProfile,
  prizeValueCents: number,
  prizeLabel: string | null,
  revealedAt: Date | null,
) {
  const pixel = getPixel(id);
  pixel.revealed = true;
  pixel.emoji = emoji;
  pixel.backgroundColor = backgroundColor;
  pixel.revealedBy = revealedBy;
  pixel.revealedAt = revealedAt;
  pixel.prizeValueCents = prizeValueCents;
  pixel.prizeLabel = prizeLabel;
  pixel.socialProfile = socialProfile;
  pixel.status = "paid";
  return pixel;
}

function applyCellStatus(
  id: number,
  status: "available" | "reserved" | "paid",
  visual?: {
    backgroundColor?: string | null;
    emoji?: string | null;
  },
) {
  const pixel = getPixel(id);
  if (visual?.backgroundColor !== undefined) {
    pixel.backgroundColor = visual.backgroundColor;
  }
  if (visual?.emoji !== undefined) {
    pixel.emoji = visual.emoji;
  }
  pixel.status = status;
  pixel.revealed = status === "paid";
  if (!pixel.revealed) {
    pixel.revealedBy = null;
    pixel.revealedAt = null;
    pixel.prizeValueCents = 0;
    pixel.prizeLabel = null;
    pixel.socialProfile = EMPTY_SOCIAL_PROFILE;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? "Não foi possível concluir a operação.");
  }
  return body;
}

function getDeviceId() {
  const key = "pixelpix-device-id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created =
      globalThis.crypto?.randomUUID?.() ??
      `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `device_${globalThis.crypto?.randomUUID?.() ?? "ephemeral"}`;
  }
}

function normalizeHandle(value: string) {
  return value.trim().replace(/^@+/, "");
}

function normalizeSocialProfile(value: unknown): SocialProfile {
  if (!value || typeof value !== "object") return EMPTY_SOCIAL_PROFILE;
  const profile = value as Partial<SocialProfile> & {
    instagram?: string;
    x?: string;
  };
  if (profile.network && (profile.network === "instagram" || profile.network === "x")) {
    return { network: profile.network, handle: normalizeHandle(profile.handle ?? "") };
  }
  if (profile.instagram) {
    return { network: "instagram", handle: normalizeHandle(profile.instagram) };
  }
  if (profile.x) {
    return { network: "x", handle: normalizeHandle(profile.x) };
  }
  return EMPTY_SOCIAL_PROFILE;
}

function validateSocialProfile(profile: SocialProfile) {
  const handle = normalizeHandle(profile.handle);
  if (!handle) return "";
  if (
    profile.network === "instagram" &&
    !/^[a-zA-Z0-9._]{1,30}$/.test(handle)
  ) {
    return "Use apenas letras, números, pontos e sublinhados.";
  }
  if (profile.network === "x" && !/^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
    return "Use até 15 caracteres: letras, números e sublinhados.";
  }
  return "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) return "Informe seu e-mail para receber o certificado do pixel.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Digite um e-mail válido.";
  }
  return "";
}

function getStoredReceiptEmail() {
  try {
    return window.localStorage.getItem(RECEIPT_EMAIL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeReceiptEmail(email: string) {
  try {
    window.localStorage.setItem(RECEIPT_EMAIL_STORAGE_KEY, email);
  } catch {
    // Some privacy modes block localStorage; the current checkout can continue.
  }
}

type ReceiptPayload = {
  pixelId: number;
  email: string;
  paymentId: string;
  revealedAt: string | null;
  value: number;
  emoji: string;
  backgroundColor: string;
  revealedBy: string | null;
  prizeValueCents: number;
  prizeLabel: string | null;
  socialProfile: SocialProfile;
};

function SignatureIcon({
  network,
  size = 16,
}: {
  network: SignatureNetwork;
  size?: number;
}) {
  return network === "instagram" ? (
    <FiInstagram size={size} aria-hidden="true" />
  ) : (
    <RiTwitterXFill size={size} aria-hidden="true" />
  );
}

function signatureUrl(profile: SocialProfile) {
  const base = profile.network === "instagram" ? "https://instagram.com/" : "https://x.com/";
  return `${base}${profile.handle}`;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatRevealedDate(date: Date | null) {
  if (!date) return "";
  const datePart = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} às ${timePart}`;
}

function PixelSheet({
  pixel,
  onClose,
  onReveal,
  onReserve,
  socialProfile,
  onSaveSocialProfile,
}: {
  pixel: Pixel;
  onClose: () => void;
  onReveal: (
    receipt: ReceiptPayload,
  ) => Promise<void>;
  onReserve: (id: number) => Promise<string>;
  socialProfile: SocialProfile;
  onSaveSocialProfile: (
    profile: SocialProfile,
    cellId: number,
    token: string,
  ) => Promise<void>;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [socialPromptOpen, setSocialPromptOpen] = useState(false);
  const [editingSocials, setEditingSocials] = useState(false);
  const [socialForm, setSocialForm] = useState<SocialProfile>(EMPTY_SOCIAL_PROFILE);
  const [socialError, setSocialError] = useState("");
  const [receiptEmail, setReceiptEmail] = useState(getStoredReceiptEmail);
  const [receiptEmailError, setReceiptEmailError] = useState("");
  const [isSubmittingReveal, setIsSubmittingReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reservationToken, setReservationToken] = useState("");
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutAmountCents, setCheckoutAmountCents] = useState(
    STARTING_PIXEL_PRICE * 100,
  );
  const checkoutReference = checkoutUrl || "checkout ainda não criado";
  const [secondsRemaining, setSecondsRemaining] = useState(300);

  const copyPix = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(checkoutReference);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    }
  }, [checkoutReference]);

  useEffect(() => {
    setCheckoutOpen(false);
    setEmailPromptOpen(false);
    setSocialPromptOpen(false);
    setEditingSocials(false);
    setCopied(false);
    setReceiptEmail(getStoredReceiptEmail());
    setReceiptEmailError("");
    setIsSubmittingReveal(false);
    setReservationToken("");
    setReservationExpiresAt(null);
    setSignatureSubmitted(false);
    setCheckoutUrl("");
    setCheckoutAmountCents(STARTING_PIXEL_PRICE * 100);
  }, [pixel.id]);

  useEffect(() => {
    if (!reservationExpiresAt) return;
    const update = () => {
      setSecondsRemaining(
        Math.max(0, Math.ceil((reservationExpiresAt - Date.now()) / 1000)),
      );
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [reservationExpiresAt]);

  useEffect(() => {
    if (pixel.revealed) {
      setSocialForm(pixel.socialProfile);
    }
  }, [pixel.revealed, pixel.socialProfile]);

  const saveSocials = () => {
    const normalized = {
      network: socialForm.network,
      handle: normalizeHandle(socialForm.handle),
    };
    const error = validateSocialProfile(normalized);
    setSocialError(error);
    if (error) return;
    if (!normalized.handle) {
      setSocialPromptOpen(false);
      return;
    }
    if (!reservationToken) {
      setSocialError("Esta assinatura só pode ser enviada pela reserva atual.");
      return;
    }
    setIsSubmittingReveal(true);
    void onSaveSocialProfile(normalized, pixel.id, reservationToken)
      .then(() => {
        setSocialForm(normalized);
        setSignatureSubmitted(true);
        setSocialPromptOpen(false);
        setEditingSocials(false);
      })
      .catch((saveError) => {
        setSocialError(
          saveError instanceof Error
            ? saveError.message
            : "Não foi possível enviar sua assinatura.",
        );
      })
      .finally(() => setIsSubmittingReveal(false));
  };

  const displayedSignature = pixel.socialProfile;
  const hasSignature = Boolean(displayedSignature.handle);

  const confirmDemoPayment = async () => {
    const normalizedEmail = normalizeEmail(receiptEmail);
    const error = validateEmail(normalizedEmail);
    setReceiptEmailError(error);
    if (error) return;

    storeReceiptEmail(normalizedEmail);
    setIsSubmittingReveal(true);
    try {
      const confirmation = await fetchJson<{ cellId: number }>(
        `${checkoutUrl}/confirm`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const detail = await fetchJson<{
        id: number;
        emoji: string;
        backgroundColor: string;
        status: string;
        revealedAt: string | null;
        revealedBy: string | null;
        prizeValueCents?: number;
        prizeLabel?: string | null;
      }>(`/api/cells/${confirmation.cellId}`);
      const receipt: ReceiptPayload = {
        pixelId: confirmation.cellId,
        email: normalizedEmail,
        paymentId: "server-confirmed",
        revealedAt: detail.revealedAt,
        value: Number(detail.prizeValueCents ?? 0) / 100,
        emoji: detail.emoji,
        backgroundColor: detail.backgroundColor,
        revealedBy: detail.revealedBy,
        prizeValueCents: Number(detail.prizeValueCents ?? 0),
        prizeLabel: detail.prizeLabel ?? null,
        socialProfile: EMPTY_SOCIAL_PROFILE,
      };
      await onReveal(receipt);
      setCheckoutOpen(false);
      setSocialForm(socialProfile);
      setSocialError("");
      setSocialPromptOpen(true);
    } catch (error) {
      setReceiptEmailError(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o certificado do pixel. Tente novamente.",
      );
    } finally {
      setIsSubmittingReveal(false);
    }
  };

  const continueToCheckout = () => {
    const normalizedEmail = normalizeEmail(receiptEmail);
    const error = validateEmail(normalizedEmail);
    setReceiptEmailError(error);
    if (error) return;

    void (async () => {
      setIsSubmittingReveal(true);
      try {
        const result = await fetchJson<{
          checkoutUrl: string;
          amountCents: number;
          currency: string;
        }>("/api/cells/email", {
          method: "POST",
          body: JSON.stringify({
            cellId: pixel.id,
            token: reservationToken,
            email: normalizedEmail,
            deviceId: getDeviceId(),
          }),
        });
        storeReceiptEmail(normalizedEmail);
        setReceiptEmail(normalizedEmail);
        setCheckoutUrl(result.checkoutUrl);
        setCheckoutAmountCents(result.amountCents);
        setEmailPromptOpen(false);
        setCheckoutOpen(true);
      } catch (error) {
        setReceiptEmailError(
          error instanceof Error
            ? error.message
            : "Não foi possível criar o checkout.",
        );
      } finally {
        setIsSubmittingReveal(false);
      }
    })();
  };

  return (
    <div className="prototype-overlay" onClick={onClose}>
      <div
        className={`prototype-sheet ${checkoutOpen ? "is-checkout" : "is-detail"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes do pixel ${pixel.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prototype-drag-handle" />

        {checkoutOpen ? (
          <>
            <div className="prototype-sheet-header">
              <button
                className="prototype-back-button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button className="prototype-close-button" onClick={onClose}>
                Fechar
              </button>
            </div>

            <div className="prototype-checkout-title">
              <div className="prototype-eyebrow">PAGAMENTO VIA PIX</div>
               <div className="prototype-price">
                 {formatBRL(checkoutAmountCents / 100)}
               </div>
               <div className="prototype-subtle">
                 Pixel #{pixel.id.toLocaleString("pt-BR")} · reserva expira em{" "}
                 {String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:
                 {String(secondsRemaining % 60).padStart(2, "0")}
               </div>
            </div>

             <div className="prototype-receipt-destination">
               <span>Certificado enviado para</span>
               <strong>{receiptEmail}</strong>
               <button
                 type="button"
                 onClick={() => {
                   setCheckoutOpen(false);
                   setEmailPromptOpen(true);
                 }}
               >
                 Alterar e-mail
               </button>
             </div>

            <div className="prototype-checkout-layout">
              <div className="prototype-qr-wrap">
                 <div className="prototype-qr prototype-qr-placeholder">
                   PIX
                 </div>
              </div>

              <div className="prototype-checkout-info">
                 <div className="prototype-pix-label">Checkout Pix seguro</div>
                <div className="prototype-pix-row">
                   <span className="prototype-pix-key">{checkoutReference}</span>
                  <button className="prototype-copy-button" onClick={copyPix}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="prototype-waiting">
                  <Loader2 size={14} className="prototype-spinner" />
                  {secondsRemaining > 0
                    ? `Aguardando pagamento · ${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, "0")}`
                    : "Reserva expirada"}
                </div>

                <button
                  className="prototype-demo-button"
                  onClick={confirmDemoPayment}
                  disabled={isSubmittingReveal}
                >
                  {isSubmittingReveal
          ? "Preparando seu certificado…"
                     : "(desenvolvimento) simular webhook confirmado"}
                </button>
              </div>
            </div>
          </>
        ) : emailPromptOpen ? (
          <ReceiptEmailView
            email={receiptEmail}
            error={receiptEmailError}
            onChange={(email) => {
              setReceiptEmail(email);
              setReceiptEmailError("");
            }}
            onBack={() => setEmailPromptOpen(false)}
            onContinue={continueToCheckout}
          />
        ) : socialPromptOpen || editingSocials ? (
          <SignatureFormView
            profile={socialForm}
            error={socialError}
            isEditing={editingSocials}
            onChange={setSocialForm}
            onClose={() => {
              setSocialPromptOpen(false);
              setEditingSocials(false);
            }}
            onSave={saveSocials}
            onRemove={undefined}
          />
        ) : (
          <>
            <div className="prototype-sheet-header">
              <div>
                <div className="prototype-eyebrow">PIXEL</div>
                <div className="prototype-id">
                  #{pixel.id.toLocaleString("pt-BR")}
                </div>
              </div>
              <button className="prototype-close-button" onClick={onClose}>
                Fechar
              </button>
            </div>

            <div className="prototype-detail-layout">
              <div
                className="prototype-pixel-hero"
                style={{ background: pixel.backgroundColor ?? undefined }}
              >
                {pixel.revealed ? (
                  <span className="prototype-hero-emoji">{pixel.emoji}</span>
                ) : (
                  <Lock size={28} color="rgba(255,255,255,.55)" />
                )}
              </div>

              <div className="prototype-detail-actions">
                {!pixel.revealed && (
                  <button
                    className="prototype-reveal-button"
                    disabled={isSubmittingReveal}
                    onClick={async () => {
                      setReceiptEmail(getStoredReceiptEmail());
                      setReceiptEmailError("");
                      setIsSubmittingReveal(true);
                      try {
                        const token = await onReserve(pixel.id);
                        setReservationToken(token);
                         setReservationExpiresAt(Date.now() + 5 * 60 * 1000);
                         setSecondsRemaining(300);
                        setEmailPromptOpen(true);
                      } catch (error) {
                        setReceiptEmailError(
                          error instanceof Error
                            ? error.message
                            : "Esta célula não está disponível.",
                        );
                      } finally {
                        setIsSubmittingReveal(false);
                      }
                    }}
                  >
                    {isSubmittingReveal ? "Reservando…" : "Revelar pixel"}
                  </button>
                )}

                {pixel.revealed && (
                  <div className="prototype-revealed-content">
                    <div className="prototype-revealed-by">
                      <span>Revelado em</span>
                      <span>{formatRevealedDate(pixel.revealedAt)}</span>
                    </div>

                    {hasSignature && (
                      <div className="prototype-social-section">
                        <div className="prototype-social-title">
                          Assinado por
                        </div>
                        <div className="prototype-social-links">
                          <a
                            href={signatureUrl(displayedSignature)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir @${displayedSignature.handle} no ${displayedSignature.network}`}
                          >
                            <SignatureIcon network={displayedSignature.network} size={17} />
                            <span>@{displayedSignature.handle}</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {reservationToken &&
                      pixel.revealedBy === CURRENT_USER_NICKNAME &&
                      !hasSignature &&
                      !signatureSubmitted && (
                      <button
                        className="prototype-edit-social-button"
                        onClick={() => {
                           setSocialForm(EMPTY_SOCIAL_PROFILE);
                          setSocialError("");
                           setEditingSocials(false);
                        }}
                      >
                         Assinar esse pixel publicamente
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function ReceiptEmailView({
  email,
  error,
  onChange,
  onBack,
  onContinue,
}: {
  email: string;
  error: string;
  onChange: (email: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="prototype-sheet-header">
        <button className="prototype-back-button" onClick={onBack} aria-label="Voltar">
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button className="prototype-close-button" onClick={onBack}>
          Fechar
        </button>
      </div>

      <div className="prototype-signature-title">
        <h2>Receba o certificado do seu pixel</h2>
        <p>
          Informe seu e-mail para receber o certificado do pixel que você está
          revelando.
        </p>
      </div>

      <label className="prototype-email-field">
        <span>E-mail para o certificado</span>
        <div className="prototype-identity-input prototype-email-input">
          <span className="prototype-email-icon" aria-hidden="true">
            <Mail size={17} />
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => onChange(event.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(error)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onContinue();
            }}
          />
        </div>
        {error && <strong>{error}</strong>}
      </label>

      <div className="prototype-email-actions">
        <button className="prototype-social-primary" onClick={onContinue}>
          Continuar para revelar meu pixel
        </button>
      </div>
    </>
  );
}

function SignatureFormView({
  profile,
  error,
  isEditing,
  onChange,
  onClose,
  onSave,
  onRemove,
}: {
  profile: SocialProfile;
  error: string;
  isEditing: boolean;
  onChange: (profile: SocialProfile) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <div className="prototype-sheet-header">
        <button className="prototype-back-button" onClick={onClose} aria-label="Voltar">
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button className="prototype-close-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="prototype-signature-title">
        <h2>
          {isEditing ? "Editar sua assinatura" : "Assinar esse pixel publicamente"}
        </h2>
          <p>
           Escolha uma rede e adicione seu @ para deixar sua assinatura pública
           neste pixel. A assinatura passa por moderação e, depois do envio,
           alterações ou remoções só podem ser solicitadas ao suporte.
        </p>
      </div>
      <SocialProfileForm
        profile={profile}
        error={error}
        onChange={onChange}
        onSave={onSave}
        onSkip={onRemove ?? onClose}
        saveLabel={isEditing ? "Salvar assinatura" : "Assinar esse pixel publicamente"}
        skipLabel={isEditing ? "Remover assinatura" : "Agora não"}
      />
    </>
  );
}

function SocialProfileForm({
  profile,
  error,
  onChange,
  onSave,
  onSkip,
  saveLabel,
  skipLabel = "Agora não",
}: {
  profile: SocialProfile;
  error: string;
  onChange: (profile: SocialProfile) => void;
  onSave: () => void;
  onSkip: () => void;
  saveLabel: string;
  skipLabel?: string;
}) {
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);

  return (
    <div className="prototype-social-form">
      <label className="prototype-handle-field">
        <span>Seu @usuário</span>
        <div className={`prototype-identity-input ${networkMenuOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="prototype-network-icon-button"
            aria-haspopup="listbox"
            aria-expanded={networkMenuOpen}
            aria-label={`Trocar rede social. Atual: ${
              profile.network === "instagram" ? "Instagram" : "X"
            }`}
            onClick={() => setNetworkMenuOpen((open) => !open)}
          >
            <SignatureIcon network={profile.network} size={17} />
          </button>
          {networkMenuOpen && (
            <div className="prototype-network-menu" role="listbox" aria-label="Redes sociais">
              {(["instagram", "x"] as const).map((network) => (
                <button
                  key={network}
                  type="button"
                  role="option"
                  aria-selected={profile.network === network}
                  className={`prototype-network-menu-option ${
                    profile.network === network ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    onChange({ ...profile, network });
                    setNetworkMenuOpen(false);
                  }}
                >
                  <SignatureIcon network={network} size={15} />
                  <span>{network === "instagram" ? "Instagram" : "X"}</span>
                  {profile.network === network && <Check size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
          <span className="prototype-handle-prefix">@</span>
          <input
            value={profile.handle}
            onChange={(event) => onChange({ ...profile, handle: event.target.value })}
            placeholder="seuusuario"
            autoComplete="off"
            aria-invalid={Boolean(error)}
          />
        </div>
        {error && <small>{error}</small>}
      </label>
      <div className="prototype-social-form-actions">
        <button className="prototype-social-secondary" onClick={onSkip}>
          {skipLabel}
        </button>
        <button className="prototype-social-primary" onClick={onSave}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function PixelGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scrollTopRow, setScrollTopRow] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [, setRevealVersion] = useState(0);
  const [chunkStates, setChunkStates] = useState<Map<number, ChunkStatus>>(
    () => new Map(),
  );
  const loadingChunksRef = useRef(new Set<number>());
  const chunkStatesRef = useRef(new Map<number, ChunkStatus>());
  const scrollFrameRef = useRef<number | null>(null);
  const latestScrollTopRef = useRef(0);
  const cellSizeRef = useRef(0);
  const [socialProfile, setSocialProfile] = useState<SocialProfile>(() => {
    try {
      const saved = window.localStorage.getItem(SOCIAL_PROFILE_STORAGE_KEY);
      return saved ? normalizeSocialProfile(JSON.parse(saved)) : EMPTY_SOCIAL_PROFILE;
    } catch {
      return EMPTY_SOCIAL_PROFILE;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(SOCIAL_PROFILE_STORAGE_KEY, JSON.stringify(socialProfile));
  }, [socialProfile]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { columns, cellSize, totalRows, totalHeight } = useMemo(() => {
    const width = containerSize.width || 1;
    const columns = Math.max(1, Math.floor(width / MIN_CELL_PX));
    const cellSize = width / columns;
    const totalRows = Math.ceil(TOTAL_PIXELS / columns);
    return { columns, cellSize, totalRows, totalHeight: totalRows * cellSize };
  }, [containerSize.width]);

  cellSizeRef.current = cellSize;

  const {
    viewportStartRow,
    viewportEndRow,
    viewportRows,
    startRow,
    endRow,
  } = useMemo(() => {
    if (!cellSize) {
      return {
        viewportStartRow: 0,
        viewportEndRow: 0,
        viewportRows: 0,
        startRow: 0,
        endRow: 0,
      };
    }

    const viewportRows = Math.max(
      1,
      Math.ceil(containerSize.height / cellSize),
    );
    const viewportStartRow = Math.max(
      0,
      scrollTopRow,
    );
    const viewportEndRow = Math.min(
      totalRows,
      viewportStartRow + viewportRows + 1,
    );

    // Keep one complete viewport of loaded space on each side.
    // The bounds naturally clamp at the beginning and end of the grid.
    const startRow = Math.max(0, viewportStartRow - viewportRows);
    const endRow = Math.min(totalRows, viewportEndRow + viewportRows);

    return {
      viewportStartRow,
      viewportEndRow,
      viewportRows,
      startRow,
      endRow,
    };
  }, [cellSize, containerSize.height, scrollTopRow, totalRows]);

  const visiblePixels = useMemo(() => {
    const pixels: Array<{ id: number; row: number; col: number }> = [];
    const firstVisibleId = startRow * columns;
    const lastVisibleId = Math.min(TOTAL_PIXELS, endRow * columns);

    // Cell identity comes from the logical, linear id space. The visual grid
    // may reflow to a different number of columns, but it must only change
    // where an existing id is painted, never which id the cell represents.
    for (let id = firstVisibleId; id < lastVisibleId; id += 1) {
      const logicalRow = Math.floor(id / LOGICAL_COLUMNS);
      const logicalCol = id % LOGICAL_COLUMNS;
      const stableId = logicalRow * LOGICAL_COLUMNS + logicalCol;
      const visualRow = Math.floor(id / columns);
      const visualCol = id % columns;
      pixels.push({ id: stableId, row: visualRow, col: visualCol });
    }
    return pixels;
  }, [columns, endRow, startRow]);

  const selected = selectedId === null ? null : getPixel(selectedId);

  const getChunkIdsForRows = useCallback(
    (firstRow: number, lastRow: number) => {
      if (!cellSize || firstRow >= lastRow) return [];

      const firstId = firstRow * columns;
      const lastId = Math.min(TOTAL_PIXELS - 1, lastRow * columns - 1);
      const firstChunk = Math.floor(firstId / CHUNK_SIZE);
      const lastChunk = Math.floor(lastId / CHUNK_SIZE);

      return Array.from(
        { length: lastChunk - firstChunk + 1 },
        (_, index) => firstChunk + index,
      );
    },
    [cellSize, columns],
  );

  const viewportChunkIds = useMemo(
    () => getChunkIdsForRows(viewportStartRow, viewportEndRow),
    [getChunkIdsForRows, viewportEndRow, viewportStartRow],
  );

  const prefetchChunkIds = useMemo(() => {
    const prefetchStartRow = Math.max(0, viewportStartRow - viewportRows);
    const prefetchEndRow = Math.min(totalRows, viewportEndRow + viewportRows);
    return getChunkIdsForRows(prefetchStartRow, prefetchEndRow);
  }, [
    getChunkIdsForRows,
    totalRows,
    viewportEndRow,
    viewportRows,
    viewportStartRow,
  ]);

  const updateChunkState = useCallback(
    (chunkId: number, status: ChunkStatus) => {
      chunkStatesRef.current.set(chunkId, status);
      setChunkStates((states) => {
        const next = new Map(states);
        next.set(chunkId, status);
        return next;
      });
    },
    [],
  );

  const requestChunk = useCallback(
    (chunkId: number) => {
      if (loadingChunksRef.current.has(chunkId)) return;
      if (chunkStatesRef.current.get(chunkId) === "loaded") return;

      loadingChunksRef.current.add(chunkId);
      updateChunkState(chunkId, "loading");

      const from = chunkId * CHUNK_SIZE;
      const to = Math.min(TOTAL_PIXELS - 1, from + CHUNK_SIZE - 1);

      void fetchJson<
        Array<{
          id: number;
          status: "available" | "reserved" | "paid";
          emoji: string;
          backgroundColor: string;
        }>
      >(`/api/cells?from=${from}&to=${to}`)
        .then((cells) => {
          cells.forEach((cell) =>
            applyCellStatus(cell.id, cell.status, {
              backgroundColor: cell.backgroundColor,
              emoji: cell.emoji,
            }),
          );
          updateChunkState(chunkId, "loaded");
          setRevealVersion((version) => version + 1);
        })
        .catch(() => {
          updateChunkState(chunkId, "error");
        })
        .finally(() => {
          loadingChunksRef.current.delete(chunkId);
        });
    },
    [updateChunkState],
  );

  useEffect(() => {
    if (!containerSize.width || !cellSize || startRow >= endRow) return;
    // Prefetching is intentionally decoupled from the visible loading state.
    // A slow background request must never turn the whole viewport into a
    // skeleton or block scrolling.
    prefetchChunkIds.forEach((chunkId) => requestChunk(chunkId));
  }, [
    cellSize,
    containerSize.width,
    endRow,
    prefetchChunkIds,
    requestChunk,
    startRow,
  ]);

  const loadingVisibleChunks = viewportChunkIds.filter(
    (chunkId) => chunkStates.get(chunkId) !== "loaded",
  );
  const failedVisibleChunks = viewportChunkIds.filter(
    (chunkId) => chunkStates.get(chunkId) === "error",
  );
  const isInitialLoading =
    loadingVisibleChunks.length > 0 &&
    chunkStates.size === 0 &&
    failedVisibleChunks.length === 0;

  const retryVisibleChunks = useCallback(() => {
    failedVisibleChunks.forEach((chunkId) => requestChunk(chunkId));
  }, [failedVisibleChunks, requestChunk]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    latestScrollTopRef.current = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const row = Math.floor(
        latestScrollTopRef.current / Math.max(1, cellSizeRef.current),
      );
      setScrollTopRow((current) => (current === row ? current : row));
    });
  }, []);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedId === null) return;
    void fetchJson<{
      id: number;
      status: "available" | "reserved" | "paid";
      emoji: string;
      backgroundColor: string;
      revealedBy?: string | null;
      revealedAt?: string | null;
      prizeValueCents?: number;
      prizeLabel?: string | null;
      signature?: { platform: SignatureNetwork; handle: string } | null;
    }>(`/api/cells/${selectedId}`)
      .then((detail) => {
        const pixel = getPixel(selectedId);
        applyCellStatus(selectedId, detail.status, {
          backgroundColor: detail.backgroundColor,
          emoji: detail.emoji,
        });
        if (detail.status === "paid") {
          pixel.revealedBy = detail.revealedBy ?? null;
          pixel.prizeValueCents = Number(detail.prizeValueCents ?? 0);
          pixel.prizeLabel = detail.prizeLabel ?? null;
          pixel.revealedAt = detail.revealedAt
            ? new Date(detail.revealedAt)
            : null;
          pixel.socialProfile = detail.signature
            ? { network: detail.signature.platform, handle: detail.signature.handle }
            : EMPTY_SOCIAL_PROFILE;
        }
        setRevealVersion((version) => version + 1);
      })
      .catch(() => undefined);
  }, [selectedId]);

  const handleReserve = useCallback(async (id: number) => {
    const result = await fetchJson<{ cellId: number; token: string }>(
      "/api/cells/reserve",
      {
        method: "POST",
        body: JSON.stringify({ id, deviceId: getDeviceId() }),
      },
    );
    applyCellStatus(id, "reserved");
    setRevealVersion((version) => version + 1);
    return result.token;
  }, []);

  const handleReveal = useCallback(async (receipt: ReceiptPayload) => {
      revealPixelInCache(
        receipt.pixelId,
        receipt.emoji,
        receipt.backgroundColor,
        receipt.revealedBy,
        receipt.socialProfile,
        receipt.prizeValueCents,
        receipt.prizeLabel,
        receipt.revealedAt ? new Date(receipt.revealedAt) : null,
      );
      setRevealVersion((version) => version + 1);
    }, []);

  const handleSaveSocialProfile = useCallback(
    async (profile: SocialProfile, cellId: number, token: string) => {
      await fetchJson<{ ok: true; status: "pending" }>("/api/cells/sign", {
        method: "POST",
        body: JSON.stringify({
          cellId,
          token,
          platform: profile.network,
          handle: profile.handle,
        }),
      });
      setRevealVersion((version) => version + 1);
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="prototype-scroll-area"
      onScroll={handleScroll}
      aria-busy={isInitialLoading}
    >
      {isInitialLoading && (
        <div className="prototype-load-status" role="status" aria-live="polite">
          <Loader2 size={14} className="prototype-spinner" />
          Sincronizando dados…
        </div>
      )}

      {failedVisibleChunks.length > 0 && (
        <div className="prototype-load-error" role="alert">
          <span>Não foi possível carregar esta área.</span>
          <button type="button" onClick={retryVisibleChunks}>
            Tentar novamente
          </button>
        </div>
      )}

      <div
        className="prototype-grid-canvas"
        style={{ height: totalHeight }}
      >
        {visiblePixels.map(({ id, row, col }) => {
          const pixel = getPixel(id);
          const chunkStatus = chunkStates.get(Math.floor(id / CHUNK_SIZE));
          const isChunkFailed = chunkStatus === "error";
          const selected = id === selectedId;
          const iconSize = Math.min(cellSize * 0.42, 16);
          const emojiSize = Math.min(cellSize * 0.55, 20);

          return (
            <button
              key={id}
              className={[
                "prototype-cell",
                selected ? "is-selected" : "",
                isChunkFailed ? "is-error" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                top: row * cellSize,
                left: col * cellSize,
                width: cellSize,
                height: cellSize,
                background: pixel.revealed
                  ? pixel.backgroundColor ?? undefined
                  : pixel.backgroundColor
                    ? `repeating-linear-gradient(45deg, ${pixel.backgroundColor}, ${pixel.backgroundColor} 4px, rgba(0,0,0,.35) 4px, rgba(0,0,0,.35) 8px)`
                    : undefined,
              }}
              onClick={() => {
                setSelectedId(id);
              }}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() =>
                setHoveredId((current) => (current === id ? null : current))
              }
              disabled={false}
              aria-label={
                pixel.revealed
                  ? `Pixel ${id}, revelado, ${pixel.emoji}`
                  : `Pixel ${id}, não revelado`
              }
            >
              {pixel.revealed || pixel.emoji === "💰" ? (
                <span style={{ fontSize: emojiSize }}>{pixel.emoji}</span>
              ) : (
                <Lock size={iconSize} color="rgba(255,255,255,.75)" />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <PixelSheet
          pixel={selected}
          onClose={() => setSelectedId(null)}
          onReveal={handleReveal}
           onReserve={handleReserve}
          socialProfile={socialProfile}
          onSaveSocialProfile={handleSaveSocialProfile}
        />
      )}

      {hoveredId !== null && (
        <div className="prototype-hover-badge">
          #{hoveredId.toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}

function Home() {
  return (
    <main className="prototype-page">
      <header className="prototype-header">
        <div>
          <h1 className="prototype-title">
            PIXEL<span>PIX</span>
          </h1>
          <p className="prototype-subtitle">
            1 milhão de pixels disponíveis pra revelar
          </p>
        </div>
      </header>
      <PixelGrid />
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}