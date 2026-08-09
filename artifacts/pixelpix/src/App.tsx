import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, Copy, Loader2, Lock, X } from "lucide-react";
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

function revealPixelInCache(id: number, socialProfile: SocialProfile) {
  const pixel = getPixel(id);
  pixel.revealed = true;
  pixel.emoji = pickEmoji(id);
  pixel.revealedBy = CURRENT_USER_NICKNAME;
  pixel.revealedAt = new Date();
  pixel.socialProfile = socialProfile;
  return pixel;
}

function updateCurrentUserSocialProfile(socialProfile: SocialProfile) {
  chunkCache.forEach((chunk) => {
    chunk.forEach((pixel) => {
      if (pixel.revealedBy === CURRENT_USER_NICKNAME) {
        pixel.socialProfile = socialProfile;
      }
    });
  });
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
  onReveal: (id: number, socialProfile: SocialProfile) => void;
  socialProfile: SocialProfile;
  onSaveSocialProfile: (profile: SocialProfile) => void;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [socialPromptOpen, setSocialPromptOpen] = useState(false);
  const [editingSocials, setEditingSocials] = useState(false);
  const [socialForm, setSocialForm] = useState<SocialProfile>(EMPTY_SOCIAL_PROFILE);
  const [socialError, setSocialError] = useState("");
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
    setSocialPromptOpen(false);
    setEditingSocials(false);
    setCopied(false);
  }, [pixel.id]);

  useEffect(() => {
    if (pixel.revealed) {
      setSocialForm(pixel.revealedBy === CURRENT_USER_NICKNAME ? socialProfile : pixel.socialProfile);
    }
  }, [pixel.revealed, pixel.revealedBy, pixel.socialProfile, socialProfile]);

  const saveSocials = () => {
    const normalized = {
      network: socialForm.network,
      handle: normalizeHandle(socialForm.handle),
    };
    const error = validateSocialProfile(normalized);
    setSocialError(error);
    if (error) return;
    onSaveSocialProfile(normalized);
    setSocialForm(normalized);
    setSocialPromptOpen(false);
    setEditingSocials(false);
  };

  const displayedSignature =
    pixel.revealedBy === CURRENT_USER_NICKNAME ? socialProfile : pixel.socialProfile;
  const hasSignature = Boolean(displayedSignature.handle);

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
                  onClick={() => {
                    onReveal(pixel.id, EMPTY_SOCIAL_PROFILE);
                    setCheckoutOpen(false);
                    setSocialPromptOpen(true);
                  }}
                >
                  (demo) simular pagamento confirmado
                </button>
              </div>
            </div>
          </>
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
                    onClick={() => setCheckoutOpen(true)}
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
                        {hasSignature ? "Editar assinatura" : "Assinar pixel"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {socialPromptOpen && (
          <div className="prototype-social-prompt" role="dialog" aria-label="Assine sua marca">
            <div className="prototype-social-prompt-header">
              <div>
                <div className="prototype-eyebrow">ASSINATURA OPCIONAL</div>
                <h2>Quer assinar sua marca?</h2>
              </div>
              <button
                className="prototype-icon-close"
                onClick={() => setSocialPromptOpen(false)}
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>
            <p>
              Escolha uma rede e adicione seu @ para deixar uma assinatura pública neste pixel.
            </p>
            <SocialProfileForm
              profile={socialForm}
              error={socialError}
              onChange={setSocialForm}
              onSave={saveSocials}
              onSkip={() => setSocialPromptOpen(false)}
              saveLabel="Assinar pixel"
            />
          </div>
        )}

        {editingSocials && (
          <div className="prototype-social-prompt" role="dialog" aria-label="Editar assinatura">
            <div className="prototype-social-prompt-header">
              <div>
                <div className="prototype-eyebrow">SUA ASSINATURA</div>
                <h2>Editar sua assinatura</h2>
              </div>
              <button
                className="prototype-icon-close"
                onClick={() => setEditingSocials(false)}
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>
            <p>Você pode atualizar ou remover sua assinatura quando quiser.</p>
            <SocialProfileForm
              profile={socialForm}
              error={socialError}
              onChange={setSocialForm}
              onSave={saveSocials}
              onSkip={() => {
                onSaveSocialProfile(EMPTY_SOCIAL_PROFILE);
                setSocialForm(EMPTY_SOCIAL_PROFILE);
                setEditingSocials(false);
              }}
              saveLabel="Salvar alterações"
              skipLabel="Remover assinatura"
            />
          </div>
        )}
      </div>
    </div>
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
  return (
    <div className="prototype-social-form">
      <div className="prototype-network-picker" role="group" aria-label="Escolha a rede da assinatura">
        <button
          type="button"
          className={`prototype-network-option${profile.network === "instagram" ? " is-selected" : ""}`}
          onClick={() => onChange({ ...profile, network: "instagram" })}
          aria-pressed={profile.network === "instagram"}
        >
          <FiInstagram size={16} aria-hidden="true" />
          Instagram
        </button>
        <button
          type="button"
          className={`prototype-network-option${profile.network === "x" ? " is-selected" : ""}`}
          onClick={() => onChange({ ...profile, network: "x" })}
          aria-pressed={profile.network === "x"}
        >
          <RiTwitterXFill size={16} aria-hidden="true" />
          X
        </button>
      </div>
      <label>
        <span>Seu @usuário</span>
        <div className="prototype-handle-input">
          <span>@</span>
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [, setRevealVersion] = useState(0);
  const [socialProfile, setSocialProfile] = useState<SocialProfile>(() => {
    try {
      const saved = window.localStorage.getItem("pixelpix-social-profile");
      return saved ? normalizeSocialProfile(JSON.parse(saved)) : EMPTY_SOCIAL_PROFILE;
    } catch {
      return EMPTY_SOCIAL_PROFILE;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("pixelpix-social-profile", JSON.stringify(socialProfile));
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

  const handleReveal = useCallback((id: number, profile: SocialProfile) => {
    revealPixelInCache(id, profile);
    setRevealVersion((version) => version + 1);
  }, []);

  const handleSaveSocialProfile = useCallback((profile: SocialProfile) => {
    setSocialProfile(profile);
    updateCurrentUserSocialProfile(profile);
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

      {profileOpen && (
        <ProfileSheet
          profile={socialProfile}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => {
            handleSaveSocialProfile(profile);
            setProfileOpen(false);
          }}
        />
      )}

      <button
        className="prototype-profile-trigger"
        onClick={() => setProfileOpen(true)}
        aria-label="Editar sua assinatura"
      >
        Sua assinatura
      </button>

      {hoveredId !== null && (
        <div className="prototype-hover-badge">
          #{hoveredId.toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}

function ProfileSheet({
  profile,
  onClose,
  onSave,
}: {
  profile: SocialProfile;
  onClose: () => void;
  onSave: (profile: SocialProfile) => void;
}) {
  const [form, setForm] = useState(profile);
  const [error, setError] = useState("");

  const save = () => {
    const normalized = {
      network: form.network,
      handle: normalizeHandle(form.handle),
    };
    const nextError = validateSocialProfile(normalized);
    setError(nextError);
    if (nextError) return;
    onSave(normalized);
  };

  return (
    <div className="prototype-overlay" onClick={onClose}>
      <div
        className="prototype-sheet prototype-profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Sua assinatura"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prototype-drag-handle" />
        <div className="prototype-sheet-header">
          <div>
                <div className="prototype-eyebrow">SUA ASSINATURA</div>
            <div className="prototype-id">Sua assinatura</div>
          </div>
          <button className="prototype-icon-close" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        <p className="prototype-profile-description">
          Essa assinatura aparece nos pixels que você revelar. Ela é opcional e pode ser
          alterada a qualquer momento.
        </p>
        <SocialProfileForm
          profile={form}
          error={error}
          onChange={setForm}
          onSave={save}
          onSkip={() => onSave(EMPTY_SOCIAL_PROFILE)}
          saveLabel="Assinar pixel"
          skipLabel="Remover assinatura"
        />
      </div>
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