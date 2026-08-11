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

const TOTAL_PIXELS = 1_000_000;
const MIN_CELL_PX = 34;
const BUFFER_ROWS = 4;
const CHUNK_SIZE = 2_500;
const PIXEL_PRICE = 0.5;
const RECEIPT_EMAIL_STORAGE_KEY = "pixelpix-receipt-email";
const SOCIAL_PROFILE_STORAGE_KEY = "pixelpix-social-profile";

type Pixel = {
  id: number;
  color: string;
  revealed: boolean;
  emoji: string | null;
  revealedBy: string | null;
  revealedAt: Date | null;
  socialProfile: SocialProfile;
};

type SignatureNetwork = "instagram" | "x";

type SocialProfile = {
  network: SignatureNetwork;
  handle: string;
};

const EMPTY_SOCIAL_PROFILE: SocialProfile = { network: "instagram", handle: "" };

const chunkCache = new Map<number, Map<number, Pixel>>();

const EMOJI_SET = [
  "🌟", "🔥", "🌊", "🍀", "⚡", "🎯", "🪐", "🌙", "🦋", "🍁",
  "🌵", "🐚", "🍄", "🎈", "🧿", "🪁", "🌈", "🍉", "🦖", "🎲",
];

const NICKNAME_SET = [
  "ana.pixel", "joao_dev", "marcelasoares", "rafa_builder", "biancart",
  "lucas.codes", "camila_", "pedrohenrique", "julia.designs", "thiago_ok",
];

const CURRENT_USER_NICKNAME = "você";

function seedFor(id: number) {
  return (id * 2_654_435_761) >>> 0;
}

function fakeRevealedAt(id: number) {
  const daysAgo = 1 + (seedFor(id) % 400);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function fakeRevealedBy(id: number) {
  return NICKNAME_SET[seedFor(id) % NICKNAME_SET.length];
}

function fakeSocialProfile(id: number): SocialProfile {
  if (id % 13 === 0) {
    return { network: "instagram", handle: "pixel.studio" };
  }
  if (id % 11 === 0) {
    return { network: "x", handle: "criadorespixel" };
  }
  if (id % 7 === 0) {
    return { network: "instagram", handle: "ana.pixel" };
  }
  return EMPTY_SOCIAL_PROFILE;
}

function hashColor(id: number) {
  const seed = seedFor(id);
  const lightness = 14 + ((seed % 1_000) / 1_000) * 10;
  const hueShift = id % 7 === 0 ? 210 : 220;
  const saturation = id % 13 === 0 ? 55 : 8;
  return `hsl(${hueShift}, ${saturation}%, ${lightness}%)`;
}

function pickEmoji(id: number) {
  return EMOJI_SET[seedFor(id) % EMOJI_SET.length];
}

function getChunk(chunkId: number) {
  const cached = chunkCache.get(chunkId);
  if (cached) return cached;

  const start = chunkId * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, TOTAL_PIXELS);
  const chunk = new Map<number, Pixel>();

  for (let id = start; id < end; id += 1) {
    const revealed = id % 5 !== 0;
    chunk.set(id, {
      id,
      color: hashColor(id),
      revealed,
      emoji: revealed ? pickEmoji(id) : null,
      revealedBy: revealed ? fakeRevealedBy(id) : null,
      revealedAt: revealed ? fakeRevealedAt(id) : null,
      socialProfile: revealed ? fakeSocialProfile(id) : EMPTY_SOCIAL_PROFILE,
    });
  }

  chunkCache.set(chunkId, chunk);
  return chunk;
}

function getPixel(id: number) {
  return getChunk(Math.floor(id / CHUNK_SIZE)).get(id)!;
}

function revealPixelInCache(id: number, socialProfile: SocialProfile, revealedAt = new Date()) {
  const pixel = getPixel(id);
  pixel.revealed = true;
  pixel.emoji = pickEmoji(id);
  pixel.revealedBy = CURRENT_USER_NICKNAME;
  pixel.revealedAt = revealedAt;
  pixel.socialProfile = socialProfile;
  return pixel;
}

function updatePixelSocialProfile(pixelId: number, socialProfile: SocialProfile) {
  const pixel = getPixel(pixelId);
  if (pixel.revealedBy === CURRENT_USER_NICKNAME) {
    pixel.socialProfile = socialProfile;
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
  revealedAt: string;
  value: number;
  emoji: string;
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

function fakePixPayload(id: number) {
  return `00020126580014BR.GOV.BCB.PIX0136pixel-${id}-a1b2c3d4-e5f6-52040000530398654${PIXEL_PRICE.toFixed(2)}5802BR5913Pixel Studio6009SAO PAULO62070503***6304ABCD`;
}

function PixelSheet({
  pixel,
  onClose,
  onReveal,
  socialProfile,
  onSaveSocialProfile,
}: {
  pixel: Pixel;
  onClose: () => void;
  onReveal: (
    receipt: ReceiptPayload,
  ) => Promise<void>;
  socialProfile: SocialProfile;
  onSaveSocialProfile: (profile: SocialProfile) => void;
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
  const pixPayload = fakePixPayload(pixel.id);

  const copyPix = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(pixPayload);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    }
  }, [pixPayload]);

  useEffect(() => {
    setCheckoutOpen(false);
    setEmailPromptOpen(false);
    setSocialPromptOpen(false);
    setEditingSocials(false);
    setCopied(false);
    setReceiptEmail(getStoredReceiptEmail());
    setReceiptEmailError("");
    setIsSubmittingReveal(false);
  }, [pixel.id]);

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
    onSaveSocialProfile(normalized);
    if (pixel.revealedBy === CURRENT_USER_NICKNAME) {
      updatePixelSocialProfile(pixel.id, normalized);
    }
    setSocialForm(normalized);
    setSocialPromptOpen(false);
    setEditingSocials(false);
  };

  const displayedSignature = pixel.socialProfile;
  const hasSignature = Boolean(displayedSignature.handle);

  const confirmDemoPayment = async () => {
    const normalizedEmail = normalizeEmail(receiptEmail);
    const error = validateEmail(normalizedEmail);
    setReceiptEmailError(error);
    if (error) return;

    const receipt: ReceiptPayload = {
      pixelId: pixel.id,
      email: normalizedEmail,
      paymentId: `demo-payment-${pixel.id}-${Date.now()}`,
      revealedAt: new Date().toISOString(),
      value: PIXEL_PRICE,
      emoji: pickEmoji(pixel.id),
      socialProfile: EMPTY_SOCIAL_PROFILE,
    };
    storeReceiptEmail(normalizedEmail);
    setIsSubmittingReveal(true);
    try {
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

    storeReceiptEmail(normalizedEmail);
    setReceiptEmail(normalizedEmail);
    setEmailPromptOpen(false);
    setCheckoutOpen(true);
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
              <div className="prototype-price">{formatBRL(PIXEL_PRICE)}</div>
              <div className="prototype-subtle">
                Pixel #{pixel.id.toLocaleString("pt-BR")}
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
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(pixPayload)}`}
                  alt="QR Code Pix"
                  width="180"
                  height="180"
                  className="prototype-qr"
                />
              </div>

              <div className="prototype-checkout-info">
                <div className="prototype-pix-label">Pix copia e cola</div>
                <div className="prototype-pix-row">
                  <span className="prototype-pix-key">{pixPayload}</span>
                  <button className="prototype-copy-button" onClick={copyPix}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="prototype-waiting">
                  <Loader2 size={14} className="prototype-spinner" />
                  Aguardando pagamento…
                </div>

                <button
                  className="prototype-demo-button"
                  onClick={confirmDemoPayment}
                  disabled={isSubmittingReveal}
                >
                  {isSubmittingReveal
          ? "Preparando seu certificado…"
                    : "(demo) simular pagamento confirmado"}
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
            onRemove={
              editingSocials
                ? () => {
                    onSaveSocialProfile(EMPTY_SOCIAL_PROFILE);
                    setSocialForm(EMPTY_SOCIAL_PROFILE);
                    setEditingSocials(false);
                  }
                : undefined
            }
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
                style={{ background: pixel.color }}
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
                    onClick={() => {
                      setReceiptEmail(getStoredReceiptEmail());
                      setReceiptEmailError("");
                      setEmailPromptOpen(true);
                    }}
                  >
                    Revelar pixel
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

                    {pixel.revealedBy === CURRENT_USER_NICKNAME && (
                      <button
                        className="prototype-edit-social-button"
                        onClick={() => {
                          setSocialForm(displayedSignature);
                          setSocialError("");
                          setEditingSocials(true);
                        }}
                      >
                        {hasSignature
                          ? "Editar assinatura"
                          : "Assinar esse pixel publicamente"}
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
          {isEditing
            ? "Atualize a rede ou o @ que aparece nos pixels assinados por você."
            : "Escolha uma rede e adicione seu @ para deixar sua assinatura pública neste pixel. Você pode confirmar, alterar ou pular."}
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
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [, setRevealVersion] = useState(0);
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

  const { startRow, endRow } = useMemo(() => {
    if (!cellSize) return { startRow: 0, endRow: 0 };
    const visibleRows = Math.ceil(containerSize.height / cellSize) + 1;
    const startRow = Math.max(
      0,
      Math.floor(scrollTop / cellSize) - BUFFER_ROWS,
    );
    const endRow = Math.min(
      totalRows,
      startRow + visibleRows + BUFFER_ROWS * 2,
    );
    return { startRow, endRow };
  }, [cellSize, containerSize.height, scrollTop, totalRows]);

  const visiblePixels = useMemo(() => {
    const pixels: Array<{ id: number; row: number; col: number }> = [];
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const id = row * columns + col;
        if (id >= TOTAL_PIXELS) break;
        pixels.push({ id, row, col });
      }
    }
    return pixels;
  }, [columns, endRow, startRow]);

  const selected = selectedId === null ? null : getPixel(selectedId);

  const handleReveal = useCallback(async (receipt: ReceiptPayload) => {
      revealPixelInCache(
        receipt.pixelId,
        receipt.socialProfile,
        new Date(receipt.revealedAt),
      );
      setRevealVersion((version) => version + 1);
    }, []);

  const handleSaveSocialProfile = useCallback((profile: SocialProfile) => {
    setSocialProfile(profile);
    setRevealVersion((version) => version + 1);
  }, []);

  return (
    <div
      ref={containerRef}
      className="prototype-scroll-area"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        className="prototype-grid-canvas"
        style={{ height: totalHeight }}
      >
        {visiblePixels.map(({ id, row, col }) => {
          const pixel = getPixel(id);
          const selected = id === selectedId;
          const iconSize = Math.min(cellSize * 0.42, 16);
          const emojiSize = Math.min(cellSize * 0.55, 20);

          return (
            <button
              key={id}
              className={`prototype-cell${selected ? " is-selected" : ""}`}
              style={{
                top: row * cellSize,
                left: col * cellSize,
                width: cellSize,
                height: cellSize,
                background: pixel.revealed
                  ? pixel.color
                  : `repeating-linear-gradient(45deg, ${pixel.color}, ${pixel.color} 4px, rgba(0,0,0,.35) 4px, rgba(0,0,0,.35) 8px)`,
              }}
              onClick={() => setSelectedId(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() =>
                setHoveredId((current) => (current === id ? null : current))
              }
              aria-label={
                pixel.revealed
                  ? `Pixel ${id}, revelado, ${pixel.emoji}`
                  : `Pixel ${id}, não revelado`
              }
            >
              {pixel.revealed ? (
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