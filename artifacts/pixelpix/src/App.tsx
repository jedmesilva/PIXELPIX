import { type CSSProperties, type ReactNode, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowLeft, Check, Copy, X } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const TOTAL_PIXELS = 1_000_000;
const MIN_CELL = 16;
const ROW_BUFFER = 7;
const CHUNK_ROWS = 9;
const PALETTE = ['#f2b857', '#e36c8b', '#82d69b', '#80b7e8', '#b697df', '#e8e0ad'];

type Pixel = { id: number; row: number; col: number; opened: boolean; color: string; mark: number };
type Viewport = { width: number; height: number; scrollTop: number };

function hashPixel(id: number) {
  let x = (id + 1) * 2654435761;
  x = (x ^ (x >>> 16)) * 2246822519;
  x = (x ^ (x >>> 13)) * 3266489917;
  return Math.abs(x ^ (x >>> 16));
}

function pixelFor(id: number, cols: number, opened: Set<number>): Pixel {
  const hash = hashPixel(id);
  return {
    id,
    row: Math.floor(id / cols),
    col: id % cols,
    opened: opened.has(id) || hash % 23 === 0,
    color: PALETTE[hash % PALETTE.length],
    mark: hash % 3,
  };
}

function PixelGlyph({ mark, opened }: { mark: number; opened: boolean }) {
  if (!opened) return <span className="pixel-lock-mark" aria-hidden="true" />;
  return <span className={`pixel-mark mark-${mark}`} aria-hidden="true" />;
}

function Brand() {
  return (
    <a className="brand-lockup" href="/" data-testid="link-brand" aria-label="Pixelpix início">
      <span className="brand-mark" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </span>
      <span className="brand-word">PIXELPIX</span>
    </a>
  );
}

function PixelDetail({
  pixel,
  onClose,
  onReveal,
  onConfirm,
}: {
  pixel: Pixel;
  onClose: () => void;
  onReveal: () => void;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState<'detail' | 'checkout' | 'confirmed'>('detail');
  const [copied, setCopied] = useState(false);
  const pixKey = 'pixelpix.demo@pix';

  useEffect(() => {
    setStep(pixel.opened ? 'confirmed' : 'detail');
    setCopied(false);
  }, [pixel.id, pixel.opened]);

  const copyPix = async () => {
    try {
      await navigator.clipboard?.writeText(pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
    }
  };

  return (
    <aside className="detail-panel" role="dialog" aria-label={`Detalhes do pixel ${pixel.id}`}>
      <button className="detail-close" onClick={onClose} data-testid="button-close-detail" aria-label="Fechar detalhes">
        <X size={16} />
      </button>
      {step === 'detail' && (
        <>
          <p className="detail-kicker">Uma janela ainda fechada</p>
          <h2 className="detail-title">Você encontrou um pixel.</h2>
          <p className="detail-copy">Abra este pequeno espaço na obra coletiva e deixe uma marca que passa a existir para todo mundo.</p>
          <span className="detail-id">pixel / {pixel.id.toLocaleString('pt-BR')}</span>
          <button className="primary-action" onClick={() => { onReveal(); setStep('checkout'); }} data-testid="button-reveal-pixel">
            Revelar por R$ 1,00
            <ArrowLeft size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </>
      )}
      {step === 'checkout' && (
        <>
          <button className="detail-back" onClick={() => setStep('detail')} data-testid="button-back-detail">
            <ArrowLeft size={14} /> Voltar
          </button>
          <p className="detail-kicker">Demonstração de pagamento</p>
          <h2 className="detail-title">Abra a janela.</h2>
          <p className="detail-copy">Copie a chave abaixo para imaginar o gesto. Nada é cobrado nesta experiência.</p>
          <div className="checkout-box">
            <span className="checkout-label">Chave Pix de demonstração</span>
            <div className="copy-row">
              <span className="pix-key">{pixKey}</span>
              <button className="copy-button" onClick={copyPix} data-testid="button-copy-pix" aria-label="Copiar chave Pix">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiada' : 'Copiar'}
              </button>
            </div>
            <p className="pay-note">Depois, confirme abaixo para ver o pixel nascer no mapa.</p>
          </div>
          <button className="primary-action" onClick={() => { onConfirm(); setStep('confirmed'); }} data-testid="button-confirm-payment">
            Simular pagamento confirmado
            <Check size={15} />
          </button>
        </>
      )}
      {step === 'confirmed' && (
        <>
          <p className="detail-kicker">Agora ele é parte da obra</p>
          <h2 className="detail-title">Pixel revelado.</h2>
          <p className="detail-copy">Você abriu a janela {pixel.id.toLocaleString('pt-BR')}. Volte ao mapa e encontre sua marca quando quiser.</p>
          <span className="detail-id" style={{ color: pixel.color }}>● &nbsp; pixel / {pixel.id.toLocaleString('pt-BR')}</span>
          <button className="secondary-action" onClick={onClose} data-testid="button-return-map">Continuar explorando</button>
        </>
      )}
    </aside>
  );
}

function PixelBoard({ onRevealCount }: { onRevealCount: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 800, height: 500, scrollTop: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [loadedChunks, setLoadedChunks] = useState<Set<number>>(() => new Set([0, 1, 2]));
  const [loadingChunks, setLoadingChunks] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const resize = () => setViewport((previous) => ({ ...previous, width: element.clientWidth, height: element.clientHeight }));
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);

  const cols = Math.max(8, Math.floor(viewport.width / MIN_CELL));
  const cellSize = viewport.width / cols;
  const totalRows = Math.ceil(TOTAL_PIXELS / cols);
  const visibleRows = Math.ceil(viewport.height / cellSize);
  const firstRow = Math.max(0, Math.floor(viewport.scrollTop / cellSize) - ROW_BUFFER);
  const lastRow = Math.min(totalRows, firstRow + visibleRows + ROW_BUFFER * 2);
  const selected = selectedId === null ? null : pixelFor(selectedId, cols, revealed);

  const visiblePixels = useMemo(() => {
    const pixels: Pixel[] = [];
    for (let row = firstRow; row < lastRow; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const id = row * cols + col;
        if (id < TOTAL_PIXELS) pixels.push(pixelFor(id, cols, revealed));
      }
    }
    return pixels;
  }, [cols, firstRow, lastRow, revealed]);

  useEffect(() => {
    const needed = new Set<number>();
    for (let row = firstRow; row < lastRow; row += CHUNK_ROWS) needed.add(Math.floor(row / CHUNK_ROWS));
    const missing = [...needed].filter((chunk) => !loadedChunks.has(chunk) && !loadingChunks.has(chunk));
    if (!missing.length) return;
    setLoadingChunks((current) => new Set([...current, ...missing]));
    const timeout = window.setTimeout(() => {
      setLoadedChunks((current) => new Set([...current, ...missing]));
      setLoadingChunks((current) => {
        const next = new Set(current);
        missing.forEach((chunk) => next.delete(chunk));
        return next;
      });
    }, 340);
    return () => window.clearTimeout(timeout);
  }, [firstRow, lastRow, loadedChunks]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setViewport((previous) => ({ ...previous, scrollTop: event.currentTarget.scrollTop }));
  }, []);

  const commitReveal = () => {
    if (selectedId === null) return;
    setRevealed((current) => new Set([...current, selectedId]));
  };

  return (
    <section className="board-frame" aria-label="Mapa de um milhão de pixels">
      <div className="grid-scroller" ref={frameRef} onScroll={onScroll} data-testid="pixel-grid-scroller">
        <div className="grid-inner" style={{ height: totalRows * cellSize }}>
          {visiblePixels.map((pixel) => {
            const loaded = loadedChunks.has(Math.floor(pixel.row / CHUNK_ROWS));
            return (
              <button
                key={pixel.id}
                className={`pixel-cell${pixel.opened ? ' is-opened' : ''}${selectedId === pixel.id ? ' is-selected' : ''}${!loaded ? ' is-loading' : ''}`}
                style={{ width: cellSize, height: cellSize, left: pixel.col * cellSize, top: pixel.row * cellSize, ...(pixel.opened ? { '--pixel-color': pixel.color } : {}) } as CSSProperties}
                onClick={() => loaded && setSelectedId(pixel.id)}
                disabled={!loaded}
                data-testid={`button-pixel-${pixel.id}`}
                aria-label={`Pixel ${pixel.id}${pixel.opened ? ', revelado' : ', bloqueado'}`}
              >
                <span className="pixel-glyph"><PixelGlyph mark={pixel.mark} opened={pixel.opened} /></span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid-caption">
        <span>Arraste para atravessar a obra</span>
        <span>{cols.toLocaleString('pt-BR')} colunas · mapa infinito à vista</span>
      </div>
      {selected && (
        <PixelDetail
          pixel={selected}
          onClose={() => setSelectedId(null)}
          onReveal={() => undefined}
          onConfirm={() => { commitReveal(); onRevealCount(); }}
        />
      )}
    </section>
  );
}

function Home() {
  const [openedCount, setOpenedCount] = useState(43_478);
  const progress = (openedCount / TOTAL_PIXELS) * 100;
  return (
    <main className="pixelpix-app">
      <div className="pixelpix-shell">
        <header className="pixelpix-header">
          <Brand />
          <div className="header-note"><span className="live-dot" aria-hidden="true" /> obra coletiva, ao vivo</div>
        </header>
        <section className="intro">
          <div>
            <p className="eyebrow">um milhão de pequenas janelas</p>
            <h1>Abra um espaço.<br /><em>Deixe uma marca.</em></h1>
          </div>
          <div className="intro-side">
            <p className="intro-copy">Pixelpix é um arquivo vivo feito de encontros. Explore o mapa, escolha uma coordenada e abra uma janela na obra coletiva.</p>
            <span className="intro-signal">clique em um ponto para começar</span>
          </div>
        </section>
        <div className="board-meta">
          <div className="board-meta-left">
            <div className="stats"><span className="stat-number" data-testid="text-opened-count">{openedCount.toLocaleString('pt-BR')}</span><span className="stat-label">de 1.000.000 abertas</span></div>
            <span className="progress-percent">{progress.toFixed(1).replace('.', ',')}%</span>
          </div>
          <div className="legend" aria-label="Legenda"><span className="legend-item"><i className="legend-swatch opened" /> revelado</span><span className="legend-item"><i className="legend-swatch waiting" /> esperando</span></div>
        </div>
        <PixelBoard onRevealCount={() => setOpenedCount((count) => count + 1)} />
        <div className="discovery-strip">
          <div className="discovery-card accent-card"><strong>Cada pixel é único.</strong><p>Uma pequena coordenada, uma nova possibilidade de descoberta.</p></div>
          <div className="discovery-card"><strong>{(1_000_000 - openedCount).toLocaleString('pt-BR')}</strong><p>janelas ainda esperando para serem encontradas.</p></div>
          <div className="discovery-card"><strong>R$ 1,00</strong><p>para abrir um espaço e entrar para a obra.</p></div>
        </div>
      </div>
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;