import { Activity, ArrowUpRight, Boxes, CircleDollarSign, LayoutDashboard, LogOut, Menu, ShieldCheck, Sparkles, TicketCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';

const navigation = [
  { href: '/admin/', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/redemptions', label: 'Redemptions', icon: TicketCheck },
  { href: '/admin/prize-pool', label: 'Prize pool', icon: Boxes },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebar = (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-[76px] items-center border-b border-sidebar-border px-6">
        <Link href="/admin/" className="flex items-center gap-3" data-testid="link-admin-home">
          <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles size={17} strokeWidth={2.5} />
          </span>
          <span className="font-mono-ui text-[15px] font-bold tracking-[-0.04em]">PIXELPIX</span>
        </Link>
        <button className="ml-auto rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-menu">
          <X size={18} />
        </button>
      </div>
      <div className="px-4 pt-7">
        <div className="mb-3 px-2 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Operations</div>
        <nav className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin/' ? location === href || location === '/admin' : location.startsWith(href);
            return (
              <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>
                <Icon size={17} />
                <span>{label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground" />}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-sidebar-foreground/65"><span className="pulse-dot size-2 rounded-full bg-sidebar-primary" />Live control room</div>
          <div className="font-mono-ui text-xs text-sidebar-foreground/90">batch / 07A</div>
          <div className="mt-1 text-[11px] text-sidebar-foreground/45">Prize grid integrity nominal</div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border pt-4">
          <div className="grid size-8 place-items-center rounded-full bg-[#ff8e70] text-xs font-bold text-[#202a2f]">OP</div>
          <div className="min-w-0"><div className="truncate text-xs font-semibold">Ops desk</div><div className="text-[11px] text-sidebar-foreground/45">Authorized operator</div></div>
          <LogOut size={15} className="ml-auto text-sidebar-foreground/35" />
        </div>
      </div>
    </aside>
  );
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</div>
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-border bg-card p-2 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={18} /></button>
            <div><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Internal console</div><div className="mt-0.5 text-sm font-semibold">Prize operations</div></div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><ShieldCheck size={16} className="text-emerald-600" /><span className="hidden sm:inline">Protected workspace</span><span className="size-1.5 rounded-full bg-emerald-500" /></div>
        </header>
        <main className="control-grid min-h-[calc(100dvh-76px)] px-5 py-7 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"><Activity size={13} className="text-[#789a31]" />{eyebrow}</div><h1 className="text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-[38px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, note, tone = 'ink', icon: Icon }: { label: string; value: string; note: string; tone?: 'ink' | 'lime' | 'coral' | 'blue'; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }) {
  const backgrounds = { ink: 'bg-[#202a2f] text-[#f4f2e9]', lime: 'bg-[#d9f77a] text-[#202a2f]', coral: 'bg-[#ffad94] text-[#202a2f]', blue: 'bg-[#c7e8ea] text-[#202a2f]' };
  return <div className={`fade-up rounded-2xl p-5 ${backgrounds[tone]}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><span className="text-xs font-semibold opacity-70">{label}</span><Icon size={18} strokeWidth={1.8} className="opacity-65" /></div><div className="mt-7 font-mono-ui text-[26px] font-bold tracking-[-0.06em]">{value}</div><div className="mt-1 text-[11px] opacity-65">{note}</div></div>;
}