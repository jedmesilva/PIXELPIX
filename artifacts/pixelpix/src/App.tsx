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

type SocialProfile = {
  instagram: string;
  x: string;
};

const EMPTY_SOCIAL_PROFILE: SocialProfile = { instagram: "", x: "" };

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
    return { instagram: "pixel.studio", x: "pixelstudio" };
  }
  if (id % 11 === 0) {
    return { ...EMPTY_SOCIAL_PROFILE, x: "criadorespixel" };
  }
  if (id % 7 === 0) {
    return { ...EMPTY_SOCIAL_PROFILE, instagram: "ana.pixel" };
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

function validateSocialProfile(profile: SocialProfile) {
  const errors: SocialProfile = { ...EMPTY_SOCIAL_PROFILE };
  const instagram = normalizeHandle(profile.instagram);
  const x = normalizeHandle(profile.x);

  if (instagram && !/^[a-zA-Z0-9._]{1,30}$/.test(instagram)) {
    errors.instagram = "Use apenas letras, números, pontos e sublinhados.";
  }
  if (x && !/^[a-zA-Z0-9_]{1,15}$/.test(x)) {
    errors.x = "Use até 15 caracteres: letras, números e sublinhados.";
  }
  return errors;
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
  const [socialErrors, setSocialErrors] = useState<SocialProfile>(EMPTY_SOCIAL_PROFILE);
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
      instagram: normalizeHandle(socialForm.instagram),
      x: normalizeHandle(socialForm.x),
    };
    const errors = validateSocialProfile(normalized);
    setSocialErrors(errors);
    if (errors.instagram || errors.x) return;
    onSaveSocialProfile(normalized);
    setSocialForm(normalized);
    setSocialPromptOpen(false);
    setEditingSocials(false);
  };

  const displayedSocials =
    pixel.revealedBy === CURRENT_USER_NICKNAME ? socialProfile : pixel.socialProfile;
  const hasSocials = Boolean(displayedSocials.instagram || displayedSocials.x);

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
                      <span>
                        {pixel.revealedBy === CURRENT_USER_NICKNAME
                          ? "Revelado por você"
                          : `Revelado por ${pixel.revealedBy}`}
                      </span>
                      <span className="prototype-divider">·</span>
                      <span>{formatRevealedDate(pixel.revealedAt)}</span>
                    </div>

                    {hasSocials && (
                      <div className="prototype-social-section">
                        <div className="prototype-social-title">
                          Encontre quem deixou esta marca
                        </div>
                        <div className="prototype-social-links">
                          {displayedSocials.instagram && (
                            <a
                              href={`https://instagram.com/${displayedSocials.instagram}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Instagram: @{displayedSocials.instagram}
                            </a>
                          )}
                          {displayedSocials.x && (
                            <a
                              href={`https://x.com/${displayedSocials.x}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              X: @{displayedSocials.x}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {pixel.revealedBy === CURRENT_USER_NICKNAME && (
                      <button
                        className="prototype-edit-social-button"
                        onClick={() => {
                          setSocialForm(displayedSocials);
                          setSocialErrors(EMPTY_SOCIAL_PROFILE);
                          setEditingSocials(true);
                        }}
                      >
                        {hasSocials ? "Editar perfis" : "Adicionar perfis"}
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
              Adicione seus perfis para que outras pessoas encontrem quem deixou este pixel.
            </p>
            <SocialProfileForm
              profile={socialForm}
              errors={socialErrors}
              onChange={setSocialForm}
              onSave={saveSocials}
              onSkip={() => setSocialPromptOpen(false)}
              saveLabel="Salvar e ver meu pixel"
            />
          </div>
        )}

        {editingSocials && (
          <div className="prototype-social-prompt" role="dialog" aria-label="Editar perfis">
            <div className="prototype-social-prompt-header">
              <div>
                <div className="prototype-eyebrow">SEU PERFIL</div>
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
            <p>Você pode atualizar ou remover seus perfis quando quiser.</p>
            <SocialProfileForm
              profile={socialForm}
              errors={socialErrors}
              onChange={setSocialForm}
              onSave={saveSocials}
              onSkip={() => {
                onSaveSocialProfile(EMPTY_SOCIAL_PROFILE);
                setSocialForm(EMPTY_SOCIAL_PROFILE);
                setEditingSocials(false);
              }}
              saveLabel="Salvar alterações"
              skipLabel="Remover perfis"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SocialProfileForm({
  profile,
  errors,
  onChange,
  onSave,
  onSkip,
  saveLabel,
  skipLabel = "Agora não",
}: {
  profile: SocialProfile;
  errors: SocialProfile;
  onChange: (profile: SocialProfile) => void;
  onSave: () => void;
  onSkip: () => void;
  saveLabel: string;
  skipLabel?: string;
}) {
  return (
    <div className="prototype-social-form">
      <label>
        <span>Instagram</span>
        <div className="prototype-handle-input">
          <span>@</span>
          <input
            value={profile.instagram}
            onChange={(event) => onChange({ ...profile, instagram: event.target.value })}
            placeholder="seuusuario"
            autoComplete="off"
            aria-invalid={Boolean(errors.instagram)}
          />
        </div>
        {errors.instagram && <small>{errors.instagram}</small>}
      </label>
      <label>
        <span>X</span>
        <div className="prototype-handle-input">
          <span>@</span>
          <input
            value={profile.x}
            onChange={(event) => onChange({ ...profile, x: event.target.value })}
            placeholder="seuusuario"
            autoComplete="off"
            aria-invalid={Boolean(errors.x)}
          />
        </div>
        {errors.x && <small>{errors.x}</small>}
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
      return saved ? { ...EMPTY_SOCIAL_PROFILE, ...JSON.parse(saved) } : EMPTY_SOCIAL_PROFILE;
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
  const [errors, setErrors] = useState(EMPTY_SOCIAL_PROFILE);

  const save = () => {
    const normalized = {
      instagram: normalizeHandle(form.instagram),
      x: normalizeHandle(form.x),
    };
    const nextErrors = validateSocialProfile(normalized);
    setErrors(nextErrors);
    if (nextErrors.instagram || nextErrors.x) return;
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
            <div className="prototype-eyebrow">SEU PERFIL</div>
            <div className="prototype-id">Sua assinatura</div>
          </div>
          <button className="prototype-icon-close" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        <p className="prototype-profile-description">
          Esses perfis aparecem nos pixels que você revelar. Eles são opcionais e podem ser
          alterados a qualquer momento.
        </p>
        <SocialProfileForm
          profile={form}
          errors={errors}
          onChange={setForm}
          onSave={save}
          onSkip={() => onSave(EMPTY_SOCIAL_PROFILE)}
          saveLabel="Salvar assinatura"
          skipLabel="Remover perfis"
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