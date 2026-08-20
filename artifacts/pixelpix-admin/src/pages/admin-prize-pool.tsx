import { ArrowLeft, ArrowRight, BadgeCheck, Database, Fingerprint, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useGetAdminPrizePool, useListAdminPrizePositions, getGetAdminPrizePoolQueryKey, getListAdminPrizePositionsQueryKey } from '@workspace/api-client-react';
import { AdminShell, PageHeader } from '@/components/admin-shell';
import { AccessKeyPrompt, EmptyState, ErrorState, LoadingPanel, SectionHeading, formatBRL, formatDate, isAccessError, useAdminAccess, withAdminAuthRevision } from '@/components/admin-ui';

const positionStatusLabels = {
  available: 'Disponível',
  found: 'Encontrado',
} as const;

const cellStatusLabels: Record<string, string> = {
  available: 'Disponível',
  reserved: 'Reservada',
  paid_pending_prize: 'Pagamento confirmado',
  paid: 'Paga',
  expired: 'Expirada',
};

function PrizePoolContent() {
  const { accessKey, authRevision, saveAccessKey } = useAdminAccess();
  const [showKey, setShowKey] = useState(false);
  const [positionStatus, setPositionStatus] = useState<'all' | 'available' | 'found'>('all');
  const [positionTierId, setPositionTierId] = useState('all');
  const [positionSearch, setPositionSearch] = useState('');
  const [positionPage, setPositionPage] = useState(0);
  const positionLimit = 50;
  const pool = useGetAdminPrizePool({ request: { headers: { 'x-admin-access-key': accessKey } }, query: { enabled: Boolean(accessKey), queryKey: withAdminAuthRevision(getGetAdminPrizePoolQueryKey(), authRevision), staleTime: 30_000 } });
  const positionParams = useMemo(() => ({
    status: positionStatus,
    ...(positionTierId !== 'all' ? { tierId: Number(positionTierId) } : {}),
    ...(positionSearch.trim() ? { search: positionSearch.trim() } : {}),
    limit: positionLimit,
    offset: positionPage * positionLimit,
  }), [positionPage, positionSearch, positionStatus, positionTierId]);
  const positions = useListAdminPrizePositions(positionParams, {
    request: { headers: { 'x-admin-access-key': accessKey } },
    query: {
      enabled: Boolean(accessKey),
      queryKey: withAdminAuthRevision(getListAdminPrizePositionsQueryKey(positionParams), authRevision),
      staleTime: 10_000,
    },
  });
  if (!accessKey) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." /><AccessKeyPrompt onSaved={(key) => { saveAccessKey(key); setShowKey(false); }} /></>;
  if (pool.isLoading) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." /><LoadingPanel rows={6} /></>;
  if (pool.isError && isAccessError(pool.error)) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." />{showKey ? <AccessKeyPrompt onSaved={(key) => { saveAccessKey(key); setShowKey(false); }} /> : <ErrorState accessRequired onRetry={() => setShowKey(true)} />}</>;
  if (pool.isError || !pool.data) return <><PageHeader eyebrow="Operações / integridade" title="Prize pool" /><ErrorState onRetry={() => pool.refetch()} /></>;
  const data = pool.data;
  const totalPositions = data.tiers.reduce((sum, tier) => sum + tier.totalPositions, 0);
  const foundPositions = data.tiers.reduce((sum, tier) => sum + tier.foundPositions, 0);
  const remainingPositions = data.tiers.reduce((sum, tier) => sum + tier.remainingPositions, 0);
  const totalValue = data.tiers.reduce((sum, tier) => sum + tier.totalValueCents, 0);
  const foundValue = data.tiers.reduce((sum, tier) => sum + tier.foundValueCents, 0);
  const remainingValue = data.tiers.reduce((sum, tier) => sum + tier.remainingValueCents, 0);
  const redeemedPositions = data.tiers.reduce((sum, tier) => sum + tier.redeemedPositions, 0);
  const redeemedValue = data.tiers.reduce((sum, tier) => sum + tier.redeemedValueCents, 0);
  const pendingRedemptionPositions = data.tiers.reduce((sum, tier) => sum + tier.pendingRedemptionPositions, 0);
  const pendingRedemptionValue = data.tiers.reduce((sum, tier) => sum + tier.pendingRedemptionValueCents, 0);
  const rejectedPositions = data.tiers.reduce((sum, tier) => sum + tier.rejectedPositions, 0);
  const rejectedValue = data.tiers.reduce((sum, tier) => sum + tier.rejectedValueCents, 0);
  const allocation = totalPositions ? ((totalPositions - remainingPositions) / totalPositions) * 100 : 0;
  const positionTotal = positions.data?.total ?? 0;
  const positionPageCount = Math.max(1, Math.ceil(positionTotal / positionLimit));

  return <div className="space-y-8">
    <PageHeader eyebrow="Operações / integridade" title="Prize pool" description="Distribuição, posições e provas de integridade do lote." action={<button className="button button-secondary" onClick={() => pool.refetch()} data-testid="button-refresh-prize-pool"><RefreshCw size={15} /> Atualizar</button>} />
    <div className="pool-banner"><div className="pool-banner-mark"><ShieldCheck size={21} /></div><div className="min-w-0 flex-1"><div className="section-kicker text-[#d9f77a]">Integridade do lote</div><h2>{data.batchRevealedAt ? 'Commit revelado e conferido' : 'Lote aguardando reveal'}</h2><p>{data.batchRevealedAt ? `Revelado em ${formatDate(data.batchRevealedAt, true)}. A distribuição está disponível para operação.` : 'A prova criptográfica ainda não foi revelada para este lote.'}</p></div><div className="pool-banner-stat"><span>{Math.round(allocation)}%</span><small>alocado</small></div></div>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
      <section className="panel overflow-hidden" data-testid="panel-prize-tiers">
        <SectionHeading kicker="A — distribuição" title="Faixas de prêmio" detail={`${remainingPositions.toLocaleString('pt-BR')} disponíveis · ${foundPositions.toLocaleString('pt-BR')} encontrados · ${redeemedPositions.toLocaleString('pt-BR')} resgatados`} />
        {data.tiers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Faixa</th><th>Valor unitário</th><th>Planejado</th><th>Encontrados</th><th>Disponíveis</th><th>Resgates</th><th>Progresso</th></tr></thead><tbody>{data.tiers.map((tier) => { const percent = tier.totalPositions ? (tier.foundPositions / tier.totalPositions) * 100 : 0; return <tr key={tier.tierId} data-testid={`row-prize-tier-${tier.tierId}`}><td><div className="flex items-center gap-3"><span className="tier-index">{String(tier.tierId).padStart(2, '0')}</span><div><div className="font-semibold">{tier.label}</div><div className="mt-0.5 text-xs text-muted-foreground">tier {tier.tierId}</div></div></div></td><td className="font-mono-ui text-sm font-bold">{formatBRL(tier.nominalValueCents)}</td><td><div className="font-mono-ui text-sm">{tier.totalPositions.toLocaleString('pt-BR')}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatBRL(tier.totalValueCents)}</div></td><td><div className="font-mono-ui text-sm font-bold">{tier.foundPositions.toLocaleString('pt-BR')}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatBRL(tier.foundValueCents)} liberados</div></td><td><div className="font-mono-ui text-sm font-bold">{tier.remainingPositions.toLocaleString('pt-BR')}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatBRL(tier.remainingValueCents)} em reserva</div></td><td><div className="font-mono-ui text-sm font-bold">{tier.redeemedPositions.toLocaleString('pt-BR')} pagos</div><div className="mt-1 text-[10px] text-muted-foreground">{tier.pendingRedemptionPositions} pendentes · {tier.rejectedPositions} rejeitados</div></td><td className="min-w-[150px]"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{Math.round(percent)}% encontrados</span><span>{tier.foundPositions}/{tier.totalPositions}</span></div><div className="progress-track"><div className="progress-fill bg-[#789a31]" style={{ width: `${Math.min(100, percent)}%` }} /></div><div className="mt-2 text-[10px] text-muted-foreground">{formatBRL(tier.redeemedValueCents)} pagos</div></td></tr> })}</tbody></table></div> : <EmptyState title="Pool sem faixas" detail="Não há tiers registrados neste lote." />}
        <div className="grid grid-cols-2 gap-px border-t border-border/70 bg-border/70 xl:grid-cols-4"><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Distribuição total</div><div className="mt-1 font-mono-ui text-lg font-bold">{formatBRL(totalValue)}</div><div className="mt-1 text-[10px] text-muted-foreground">{totalPositions.toLocaleString('pt-BR')} posições</div></div><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Encontrado</div><div className="mt-1 font-mono-ui text-lg font-bold">{formatBRL(foundValue)}</div><div className="mt-1 text-[10px] text-muted-foreground">{foundPositions.toLocaleString('pt-BR')} posições</div></div><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Resgatado</div><div className="mt-1 font-mono-ui text-lg font-bold">{formatBRL(redeemedValue)}</div><div className="mt-1 text-[10px] text-muted-foreground">{redeemedPositions.toLocaleString('pt-BR')} pagamentos</div></div><div className="bg-card px-5 py-4"><div className="text-xs text-muted-foreground">Aguardando / rejeitado</div><div className="mt-1 font-mono-ui text-lg font-bold">{formatBRL(pendingRedemptionValue + rejectedValue)}</div><div className="mt-1 text-[10px] text-muted-foreground">{pendingRedemptionPositions} pendentes · {rejectedPositions} rejeitados</div></div></div>
      </section>
      <section className="panel" data-testid="panel-pool-safety">
        <SectionHeading kicker="B — proteção" title="Margem de segurança" detail="Reserva operacional sobre o pool comprometido." />
        <div className="px-5 pb-5"><div className="safety-gauge"><div className="safety-gauge-inner"><span>{data.safetyMarginBps !== null ? (data.safetyMarginBps / 100).toFixed(2).replace('.', ',') : '—'}%</span><small>margem</small></div></div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Valor comprometido</span><strong className="font-mono-ui">{formatBRL(totalValue)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Reserva restante</span><strong className="font-mono-ui text-[#557a1d]">{formatBRL(remainingValue)}</strong></div><div className="flex justify-between border-t border-border/70 pt-3"><span className="font-semibold">Status</span><span className="flex items-center gap-1.5 font-semibold text-[#557a1d]"><span className="size-1.5 rounded-full bg-[#789a31]" />Dentro da margem</span></div></div></div>
      </section>
    </div>
      <section className="panel overflow-hidden" data-testid="panel-prize-positions">
        <SectionHeading
          kicker="D — posições premiadas"
          title="Mapa de prêmios"
          detail={`${positionTotal.toLocaleString('pt-BR')} posições premiadas registradas`}
        />
        <div className="border-y border-border/70 bg-muted/25 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px]">
            <label className="search-field">
              <Search size={16} />
              <input
                type="search"
                value={positionSearch}
                maxLength={20}
                onChange={(event) => {
                  setPositionSearch(event.target.value);
                  setPositionPage(0);
                }}
                placeholder="Buscar pelo número da célula"
                data-testid="input-search-prize-positions"
              />
            </label>
            <select
              className="field"
              value={positionStatus}
              onChange={(event) => {
                setPositionStatus(event.target.value as 'all' | 'available' | 'found');
                setPositionPage(0);
              }}
              aria-label="Filtrar situação do prêmio"
              data-testid="select-prize-position-status"
            >
              <option value="all">Todas as situações</option>
              <option value="available">Ainda não encontrados</option>
              <option value="found">Já encontrados</option>
            </select>
            <select
              className="field"
              value={positionTierId}
              onChange={(event) => {
                setPositionTierId(event.target.value);
                setPositionPage(0);
              }}
              aria-label="Filtrar faixa do prêmio"
              data-testid="select-prize-position-tier"
            >
              <option value="all">Todas as faixas</option>
              {data.tiers.map((tier) => <option value={tier.tierId} key={tier.tierId}>{tier.label}</option>)}
            </select>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Planejado é o valor nominal da faixa. Distribuído é o valor liberado no momento em que a posição foi encontrada, considerando a reserva de segurança e o caixa disponível.
          </p>
        </div>
        {positions.isLoading ? (
          <div className="p-5"><LoadingPanel rows={5} /></div>
        ) : positions.isError ? (
          <div className="p-5"><ErrorState onRetry={() => positions.refetch()} /></div>
        ) : positions.data?.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Faixa</th>
                    <th>Valor planejado</th>
                    <th>Distribuído real</th>
                    <th>Situação</th>
                    <th>Status da célula</th>
                    <th>Encontrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.data.items.map((position) => (
                    <tr key={position.cellId} data-testid={`row-prize-position-${position.cellId}`}>
                      <td className="font-mono-ui text-sm font-bold">#{position.cellId.toLocaleString('pt-BR')}</td>
                      <td>
                        <div className="font-semibold">{position.tierLabel}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">tier {position.tierId}</div>
                      </td>
                      <td className="font-mono-ui text-sm font-bold">{formatBRL(position.plannedPrizeValueCents)}</td>
                      <td className="font-mono-ui text-sm font-bold">{position.distributedPrizeValueCents === null ? '—' : formatBRL(position.distributedPrizeValueCents)}</td>
                      <td><span className={`status-badge ${position.positionStatus === 'found' ? 'status-paid' : 'status-pending'}`}><span className="status-dot" />{positionStatusLabels[position.positionStatus]}</span></td>
                      <td className="text-xs text-muted-foreground">{position.cellStatus ? cellStatusLabels[position.cellStatus] ?? position.cellStatus : '—'}</td>
                      <td className="text-xs text-muted-foreground">{position.claimedAt ? formatDate(position.claimedAt, true) : 'Ainda não encontrado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Mostrando {positionPage * positionLimit + 1}–{Math.min((positionPage + 1) * positionLimit, positionTotal)} de {positionTotal.toLocaleString('pt-BR')}</span>
              <div className="flex items-center gap-2">
                <button className="button button-ghost" disabled={positionPage === 0} onClick={() => setPositionPage((page) => Math.max(0, page - 1))} data-testid="button-prize-positions-previous"><ArrowLeft size={14} /> Anterior</button>
                <span className="px-2 font-mono-ui text-[11px]">Página {positionPage + 1} / {positionPageCount}</span>
                <button className="button button-ghost" disabled={positionPage >= positionPageCount - 1} onClick={() => setPositionPage((page) => Math.min(positionPageCount - 1, page + 1))} data-testid="button-prize-positions-next">Próxima <ArrowRight size={14} /></button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Nenhuma posição encontrada" detail="Ajuste os filtros ou confirme se o lote já possui posições premiadas." />
        )}
      </section>
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