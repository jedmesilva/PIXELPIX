import { BadgeCheck, Database, Fingerprint, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useGetAdminPrizePool, getGetAdminPrizePoolQueryKey } from '@workspace/api-client-react';
import { AdminShell, PageHeader } from '@/components/admin-shell';
import { AccessKeyPrompt, EmptyState, ErrorState, LoadingPanel, SectionHeading, formatBRL, formatDate, getAdminAccessKey, isAccessError } from '@/components/admin-ui';

function PrizePoolContent() {
  const [accessKey, setAccessKey] = useState(getAdminAccessKey);
  const [showKey, setShowKey] = useState(false);
  const pool = useGetAdminPrizePool({ request: { headers: { 'x-admin-access-key': accessKey } }, query: { queryKey: getGetAdminPrizePoolQueryKey(), staleTime: 30_000 } });
  if (pool.isLoading) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." /><LoadingPanel rows={6} /></>;
  if (pool.isError && (isAccessError(pool.error) || !accessKey)) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." />{showKey || !accessKey ? <AccessKeyPrompt onSaved={(key) => { setAccessKey(key); setShowKey(false); }} /> : <ErrorState accessRequired onRetry={() => setShowKey(true)} />}</>;
  if (pool.isError || !pool.data) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" /><ErrorState onRetry={() => pool.refetch()} /></>;
  const data = pool.data;
  const totalPositions = data.tiers.reduce((sum, tier) => sum + tier.totalPositions, 0);
  const remainingPositions = data.tiers.reduce((sum, tier) => sum + tier.remainingPositions, 0);
  const totalValue = data.tiers.reduce((sum, tier) => sum + tier.totalValueCents, 0);
  const remainingValue = data.tiers.reduce((sum, tier) => sum + tier.remainingValueCents, 0);
  const allocation = totalPositions ? ((totalPositions - remainingPositions) / totalPositions) * 100 : 0;

  return <div className="space-y-8">
    <PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." action={<button className="button button-secondary" onClick={() => pool.refetch()} data-testid="button-refresh-prize-pool"><RefreshCw size={15} /> Atualizar</button>} />
    <div className="pool-banner"><div className="pool-banner-mark"><ShieldCheck size={21} /></div><div className="min-w-0 flex-1"><div className="section-kicker text-[#d9f77a]">Integridade do lote</div><h2>{data.batchRevealedAt ? 'Commit revelado e conferido' : 'Lote aguardando reveal'}</h2><p>{data.batchRevealedAt ? `Revelado em ${formatDate(data.batchRevealedAt, true)}. A distribuição está disponível para operação.` : 'A prova criptográfica ainda não foi revelada para este lote.'}</p></div><div className="pool-banner-stat"><span>{Math.round(allocation)}%</span><small>alocado</small></div></div>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
      <section className="panel overflow-hidden" data-testid="panel-prize-tiers">
        <SectionHeading kicker="A — distribuição" title="Faixas de prêmio" detail={`${remainingPositions.toLocaleString('pt-BR')} posições restantes · ${formatBRL(remainingValue)} em reserva`} />
        {data.tiers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Faixa</th><th>Valor unitário</th><th>Posições</th><th>Distribuição</th><th>Saldo</th></tr></thead><tbody>{data.tiers.map((tier) => { const used = tier.totalPositions - tier.remainingPositions; const percent = tier.totalPositions ? (used / tier.totalPositions) * 100 : 0; return <tr key={tier.tierId} data-testid={`row-prize-tier-${tier.tierId}`}><td><div className="flex items-center gap-3"><span className="tier-index">{String(tier.tierId).padStart(2, '0')}</span><div><div className="font-semibold">{tier.label}</div><div className="mt-0.5 text-xs text-muted-foreground">tier {tier.tierId}</div></div></div></td><td className="font-mono-ui text-sm font-bold">{formatBRL(tier.nominalValueCents)}</td><td><div className="font-mono-ui text-sm">{tier.remainingPositions.toLocaleString('pt-BR')} <span className="text-xs font-normal text-muted-foreground">/ {tier.totalPositions.toLocaleString('pt-BR')}</span></div></td><td className="min-w-[150px]"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{Math.round(percent)}% usado</span><span>{used} posições</span></div><div className="progress-track"><div className="progress-fill bg-[#789a31]" style={{ width: `${percent}%` }} /></div></td><td className="font-mono-ui text-sm font-bold">{formatBRL(tier.remainingValueCents)}</td></tr> })}</tbody></table></div> : <EmptyState title="Pool sem faixas" detail="Não há tiers registrados neste lote." />}
        <div className="grid grid-cols-2 gap-px border-t border-border/70 bg-border/70"><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Distribuição total</div><div className="mt-1 font-mono-ui text-lg font-bold">{formatBRL(totalValue)}</div></div><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Posições totais</div><div className="mt-1 font-mono-ui text-lg font-bold">{totalPositions.toLocaleString('pt-BR')}</div></div></div>
      </section>
      <section className="panel" data-testid="panel-pool-safety">
        <SectionHeading kicker="B — proteção" title="Margem de segurança" detail="Reserva operacional sobre o pool comprometido." />
        <div className="px-5 pb-5"><div className="safety-gauge"><div className="safety-gauge-inner"><span>{data.safetyMarginBps !== null ? (data.safetyMarginBps / 100).toFixed(2).replace('.', ',') : '—'}%</span><small>margem</small></div></div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Valor comprometido</span><strong className="font-mono-ui">{formatBRL(totalValue)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Reserva restante</span><strong className="font-mono-ui text-[#557a1d]">{formatBRL(remainingValue)}</strong></div><div className="flex justify-between border-t border-border/70 pt-3"><span className="font-semibold">Status</span><span className="flex items-center gap-1.5 font-semibold text-[#557a1d]"><span className="size-1.5 rounded-full bg-[#789a31]" />Dentro da margem</span></div></div></div>
      </section>
    </div>
    <section className="panel" data-testid="panel-commit-metadata">
      <SectionHeading kicker="C — verificabilidade" title="Metadados commit / reveal" detail="Registro imutável utilizado para conferir a ordem do sorteio." />
      <div className="grid gap-px bg-border/70 sm:grid-cols-3"><div className="metadata-cell"><div className="metadata-icon"><Fingerprint size={17} /></div><div><div className="metadata-label">Commit hash</div><div className="metadata-value break-all">{data.commitHash ?? 'Não disponível'}</div></div></div><div className="metadata-cell"><div className="metadata-icon"><Database size={17} /></div><div><div className="metadata-label">Lote criado</div><div className="metadata-value">{formatDate(data.batchCreatedAt, true)}</div></div></div><div className="metadata-cell"><div className="metadata-icon"><LockKeyhole size={17} /></div><div><div className="metadata-label">Reveal registrado</div><div className="metadata-value">{formatDate(data.batchRevealedAt, true)}</div></div></div></div>
    </section>
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><BadgeCheck size={14} className="text-[#789a31]" /> Metadados exibidos diretamente do serviço de operações.</div>
  </div>;
}

export default function AdminPrizePool() {
  return <AdminShell><PrizePoolContent /></AdminShell>;
}