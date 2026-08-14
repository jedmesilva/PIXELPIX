import type { AdminRedemptionStatus } from '@workspace/api-client-react';

export const money = (cents: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format((cents ?? 0) / 100);

export const integer = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US').format(value ?? 0);

export const dateTime = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';

export const pct = (part: number, whole: number) => whole ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

export const statusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);

export const statusTone = (status: string) => {
  const tones: Record<string, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    approved: 'border-sky-200 bg-sky-50 text-sky-800',
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rejected: 'border-rose-200 bg-rose-50 text-rose-800',
    available: 'border-slate-200 bg-slate-50 text-slate-700',
    reserved: 'border-violet-200 bg-violet-50 text-violet-800',
  };
  return tones[status] ?? 'border-slate-200 bg-slate-50 text-slate-700';
};

export const isRedemptionStatus = (value: string): value is AdminRedemptionStatus =>
  ['pending', 'approved', 'paid', 'rejected'].includes(value);