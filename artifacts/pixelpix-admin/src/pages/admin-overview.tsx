import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, Grid3X3, RefreshCw, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { useGetAdminOverview, useListAdminRedemptions, getGetAdminOverviewQueryKey, getListAdminRedemptionsQueryKey } from '@workspace/api-client-react';
import { AdminShell, MetricCard, PageHeader } from '@/components/admin-shell';
import { AccessKeyPrompt, ErrorState, EmptyState, LoadingPanel, StatusBadge, formatBRL, formatCompact, formatDate, getAdminAccessKey, isAccessError, SectionHeading } from '@/components/admin-ui';

function OverviewContent() {
  const [accessKey, setAccessKey] = useState(getAdminAccessKey);
  const overview = useGetAdminOverview({ request: { headers: { 'x-admin-access-key': accessKey } }, query: { queryKey: getGetAdminOverviewQueryKey(), staleTime: 30_000 } });
  const recent = useListAdminRedemptions({ limit: 5, offset: 0 }, { request: { headers: { 'x-admin-access-key': accessKey } }, query: { queryKey: getListAdminRedemptionsQueryKey({ limit: 5, offset: 0 }), staleTime: 30_000 } });
  const [showKey, setShowKey] = useState(false);
  const data = overview.data;

  if (overview.isLoading || recent.isLoading) return <><PageHeader eyebrow="Operações / visão geral" title="Bom dia, equipe." description="Acompanhe dinheiro, integridade do pool e resgates em uma única bancada." /><LoadingPanel rows={5} /></>;
  if ((overview.isError || recent.isError) && (isAccessError(overview.error) || isAccessError(recent.error) || !accessKey)) {
    return <><PageHeader eyebrow="Operações / visão geral" title="Bom dia, equipe." description="Acompanhe dinheiro, integridade do pool e resgates em uma única bancada." />{showKey || !accessKey ? <AccessKeyPrompt onSaved={(key) => { setAccessKey(key); setShowKey(false); }} /> : <ErrorState accessRequired onRetry={() => setShowKey(true)} />}</>;
  }
  if (overview.isError || !data) return <><PageHeader eyebrow="Operações / visão geral" title="Bom dia, equipe." /><ErrorState onRetry={() => overview.refetch()} /></>;

  const counts = data.redemptionCounts ?? {};
  const cellTotal = data.availableCells + data.reservedCells + data.paidCells;
  const paidRatio = data.totalPrizeToDistributeCents ? Math.round((data.redeemedPrizeCents / data.totalPrizeToDistributeCents) * 100) : 0;

  return <div className="space-y-8">
    <PageHeader eyebrow="Operações / visão geral" title="Bom dia, equipe." description="Acompanhe dinheiro, integridade do pool e resgates em uma única bancada." action={<button className="button button-secondary" onClick={() => { overview.refetch(); recent.refetch(); }} data-testid="button-refresh-overview"><RefreshCw size={15} /> Atualizar</button>} />
    <div className="metrics-grid">
      <MetricCard label="Saldo disponível" value={formatBRL(data.availablePrizeBalanceCents)} note="pool pronto para distribuição" tone="lime" icon={CircleDollarSign} />
      <MetricCard label="Caixa disponível" value={formatBRL(data.cashAvailableCents)} note={`receita líquida ${formatBRL(data.grossRevenueCents - data.refundsCents)}`} tone="ink" icon={ArrowDownToLine} />
      <MetricCard label="Pendente de resgate" value={formatBRL(data.pendingRedemptionCents)} note={`${counts.pending ?? 0} solicitações na fila`} tone="coral" icon={ArrowUpFromLine} />
      <MetricCard label="Vencedores" value={formatCompact(data.winnersCount)} note={`${paidRatio}% do pool já resgatado`} tone="blue" icon={Trophy} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <section className="panel overflow-hidden" data-testid="panel-financials">
        <SectionHeading kicker="A — dinheiro em movimento" title="Visão financeira" detail="Valores em centavos convertidos para BRL." />
        <div className="divide-y divide-border/70">
          {[
            ['Distribuído', data.distributedPrizeCents, 'prêmios alocados'],
            ['Resgatado', data.redeemedPrizeCents, 'pagamentos confirmados'],
            ['Total a distribuir', data.totalPrizeToDistributeCents, 'compromisso do pool'],
            ['Receita bruta', data.grossRevenueCents, 'entradas registradas'],
            ['Estornos', data.refundsCents, 'saídas de checkout'],
          ].map(([label, value, note]) => <div className="flex items-center justify-between px-5 py-4" key={String(label)}><div><div className="text-sm font-semibold">{label}</div><div className="mt-0.5 text-xs text-muted-foreground">{note}</div></div><span className="font-mono-ui text-sm font-bold">{formatBRL(Number(value))}</span></div>)}
        </div>
        <div className="border-t border-border/70 bg-muted/40 px-5 py-4"><div className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground"><span>Resgate do pool</span><span>{paidRatio}%</span></div><div className="progress-track"><div className="progress-fill bg-[#789a31]" style={{ width: `${Math.min(100, paidRatio)}%` }} /></div></div>
      </section>
      <section className="panel" data-testid="panel-cells">
        <SectionHeading kicker="B — grade" title="Estado das células" detail={`${cellTotal.toLocaleString('pt-BR')} posições no lote atual`} />
        <div className="px-5 pb-5">
          {[['Disponíveis', data.availableCells, 'bg-[#789a31]'], ['Reservadas', data.reservedCells, 'bg-[#f1b54a]'], ['Pagas', data.paidCells, 'bg-[#ff8e70]']].map(([label, value, color]) => <div className="mb-5 last:mb-0" key={String(label)}><div className="mb-2 flex justify-between text-sm"><span className="flex items-center gap-2 font-semibold"><span className={`size-2 rounded-full ${color}`} />{label}</span><span className="font-mono-ui text-xs">{Number(value).toLocaleString('pt-BR')}</span></div><div className="progress-track"><div className={`progress-fill ${color}`} style={{ width: `${cellTotal ? (Number(value) / cellTotal) * 100 : 0}%` }} /></div></div>)}
          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-border/70 pt-5"><div className="stat-inset"><Users size={15} /><span>{data.winnersCount.toLocaleString('pt-BR')}</span><small>vencedores</small></div><div className="stat-inset"><Grid3X3 size={15} /><span>{formatCompact(cellTotal)}</span><small>posições</small></div></div>
        </div>
      </section>
    </div>
    <section className="panel overflow-hidden" data-testid="panel-recent-redemptions">
      <SectionHeading kicker="C — fila recente" title="Última atividade de resgates" detail="As solicitações mais novas que pedem atenção." action={<a href="/admin/redemptions" className="drill-link" data-testid="link-all-redemptions">Ver fila completa <span>→</span></a>} />
      {recent.data?.items?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Solicitante</th><th>Certificado</th><th>Valor</th><th>Solicitado em</th><th>Status</th></tr></thead><tbody>{recent.data.items.map((item) => <tr key={item.id} data-testid={`row-recent-redemption-${item.id}`}><td><div className="font-semibold">{item.email}</div><div className="mt-0.5 text-xs text-muted-foreground">célula #{item.cellId}</div></td><td className="font-mono-ui text-xs">{item.certificateCode}</td><td className="font-mono-ui text-sm font-bold">{formatBRL(item.requestedAmountCents)}</td><td className="text-xs text-muted-foreground">{formatDate(item.requestedAt, true)}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum resgate recente" detail="A fila está limpa por enquanto." />}
    </section>
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground"><span className="pulse-dot size-1.5 rounded-full bg-[#789a31]" /> Dados gerados em {formatDate(data.generatedAt, true)}</div>
  </div>;
}

export default function AdminOverview() {
  return <AdminShell><OverviewContent /></AdminShell>;
}