import { AlertTriangle, Check, ChevronRight, KeyRound, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

export const getAdminAccessKey = () => {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem('pixelpix-admin-access-key') ?? '';
};

export const saveAdminAccessKey = (key: string) => {
  if (typeof window !== 'undefined') window.sessionStorage.setItem('pixelpix-admin-access-key', key);
};

export const isAccessError = (error: unknown) => {
  const status = (error as { status?: number; response?: { status?: number } })?.status ?? (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 503;
};

export const formatBRL = (cents: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format((cents ?? 0) / 100);

export const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date).replace('.', '');
};

export const formatCompact = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const tone = status === 'paid' ? 'status-paid' : status === 'approved' ? 'status-approved' : status === 'rejected' ? 'status-rejected' : 'status-pending';
  return <span className={`status-badge ${tone}`} data-testid={`status-${status ?? 'unknown'}`}><span className="status-dot" />{statusLabels[status ?? ''] ?? status ?? 'Sem status'}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingPanel({ rows = 4 }: { rows?: number }) {
  return <div className="panel space-y-4 p-5" data-testid="state-loading">
    <div className="flex items-center justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
    {Array.from({ length: rows }).map((_, index) => <div className="flex items-center gap-4" key={index}><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /></div>)}
  </div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="state-empty"><div className="empty-mark"><Check size={18} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

export function ErrorState({ onRetry, accessRequired = false }: { onRetry: () => void; accessRequired?: boolean }) {
  return <div className="empty-state error-state" data-testid="state-error"><div className="empty-mark"><AlertTriangle size={18} /></div><h3>{accessRequired ? 'Acesso protegido' : 'Não foi possível carregar'}</h3><p>{accessRequired ? 'Informe a chave de acesso operacional para continuar.' : 'O serviço não respondeu. Tente novamente em instantes.'}</p><button className="button button-secondary" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} /> Tentar novamente</button></div>;
}

export function AccessKeyPrompt({ onSaved, onCancel }: { onSaved: (key: string) => void; onCancel?: () => void }) {
  const [key, setKey] = useState('');
  return <div className="key-prompt" data-testid="access-key-prompt">
    <div className="key-prompt-icon"><KeyRound size={19} /></div>
    <div className="min-w-0 flex-1"><div className="text-sm font-bold">Chave de acesso operacional</div><p className="mt-1 text-xs text-muted-foreground">A sessão é protegida e a chave fica apenas neste navegador.</p></div>
    <div className="flex w-full gap-2 sm:w-auto"><input autoFocus type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Chave de acesso" className="field min-w-0 flex-1 sm:w-48" data-testid="input-access-key" /><button className="button button-primary" disabled={!key.trim()} onClick={() => { saveAdminAccessKey(key.trim()); onSaved(key.trim()); }} data-testid="button-save-access-key">Entrar</button>{onCancel && <button className="button button-ghost" onClick={onCancel} aria-label="Fechar" data-testid="button-close-access-key"><X size={16} /></button>}</div>
  </div>;
}

export function SearchField({ value, onChange, placeholder = 'Buscar por email, Pix ou certificado' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-field"><Search size={16} /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} data-testid="input-search-redemptions" />{value && <button type="button" onClick={() => onChange('')} aria-label="Limpar busca" data-testid="button-clear-search"><X size={14} /></button>}</label>;
}

export function SectionHeading({ kicker, title, detail, action }: { kicker?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><div className="section-kicker">{kicker}</div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

export function DrillLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="drill-link" onClick={onClick} data-testid="button-open-detail">{children}<ChevronRight size={15} /></button>;
}

export function SavingIndicator({ pending }: { pending: boolean }) {
  return pending ? <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="animate-spin" size={14} /> Atualizando</span> : null;
}