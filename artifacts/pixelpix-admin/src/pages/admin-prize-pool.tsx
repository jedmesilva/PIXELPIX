import { ArrowLeft, ArrowRight, BadgeCheck, Check, Copy, Database, Fingerprint, LockKeyhole, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddAdminPrizeTier, useDrawAdminPrizeTier, useGenerateAdminPrizeBatch, useGetAdminPrizeBatch, useGetAdminPrizePool, useListAdminPrizePositions, getGetAdminPrizeBatchQueryKey, getGetAdminPrizePoolQueryKey, getListAdminPrizePositionsQueryKey } from '@workspace/api-client-react';
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

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function PrizeBatchControl() {
  const { accessKey, authRevision } = useAdminAccess();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addTierOpen, setAddTierOpen] = useState(false);
  const [tierLabel, setTierLabel] = useState('');
  const [tierTotalValue, setTierTotalValue] = useState('');
  const [tierUnitValue, setTierUnitValue] = useState('');
  const [tierError, setTierError] = useState('');
  const [tierSuccess, setTierSuccess] = useState('');
  const [drawTierId, setDrawTierId] = useState<number | null>(null);
  const [drawError, setDrawError] = useState('');
  const batch = useGetAdminPrizeBatch({
    request: { headers: { 'x-admin-access-key': accessKey } },
    query: {
      enabled: Boolean(accessKey),
      queryKey: withAdminAuthRevision(getGetAdminPrizeBatchQueryKey(), authRevision),
      staleTime: 30_000,
    },
  });
  const generate = useGenerateAdminPrizeBatch({
    request: { headers: { 'x-admin-access-key': accessKey } },
    mutation: {
      onSuccess: async () => {
        setConfirmOpen(false);
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizeBatchQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizePoolQueryKey() });
      },
    },
  });
  const addTier = useAddAdminPrizeTier({
    request: { headers: { 'x-admin-access-key': accessKey } },
    mutation: {
      onSuccess: async (result) => {
        setAddTierOpen(false);
        setTierLabel('');
        setTierTotalValue('');
        setTierUnitValue('');
        setTierError('');
        setTierSuccess(
          `Tier ${result.label} criado como rascunho com ${result.quantity.toLocaleString('pt-BR')} células planejadas. O sorteio ainda não foi executado.`,
        );
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizeBatchQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizePoolQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getListAdminPrizePositionsQueryKey() });
      },
      onError: (error) => {
        setTierError(
          error instanceof Error
            ? error.message
            : 'Não foi possível adicionar o tier.',
        );
      },
    },
  });
  const drawTier = useDrawAdminPrizeTier({
    request: { headers: { 'x-admin-access-key': accessKey } },
    mutation: {
      onSuccess: async (result) => {
        setDrawTierId(null);
        setDrawError('');
        setTierSuccess(
          `Tier ${result.label} sorteado: ${result.quantity.toLocaleString('pt-BR')} células alocadas. Commit ${result.commitHash?.slice(0, 12)}…`,
        );
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizeBatchQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetAdminPrizePoolQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getListAdminPrizePositionsQueryKey() });
      },
      onError: (error) => {
        setDrawError(error instanceof Error ? error.message : 'Não foi possível sortear este tier.');
        setDrawTierId(null);
      },
    },
  });

  if (!accessKey || batch.isLoading) return null;
  if (batch.isError) {
    if (isAccessError(batch.error)) return null;
    return <section className="panel border-[#e7b5a8] bg-[#fff6f2] p-5" data-testid="panel-prize-batch-error"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-[#a83d2f]" size={18} /><div><h2 className="font-bold">Lote de prêmios indisponível</h2><p className="mt-1 text-sm text-muted-foreground">Não foi possível consultar o estado do lote. Tente atualizar antes de qualquer operação.</p><button className="button button-secondary mt-4" onClick={() => batch.refetch()}><RefreshCw size={15} /> Tentar novamente</button></div></div></section>;
  }
  const data = batch.data;
  if (!data) return null;

  if (data.status === 'generated') {
    const tierCount = data.tiers.length;
    const totalValueCents = parseMoneyInput(tierTotalValue);
    const nominalValueCents = parseMoneyInput(tierUnitValue);
    const quantity =
      totalValueCents > 0 &&
      nominalValueCents > 0 &&
      totalValueCents % nominalValueCents === 0
        ? totalValueCents / nominalValueCents
        : 0;

    const submitTier = () => {
      if (!tierLabel.trim()) {
        setTierError('Informe um nome para o tier.');
        return;
      }
      if (!totalValueCents || !nominalValueCents) {
        setTierError('Informe o valor total e o valor por célula.');
        return;
      }
      if (!quantity) {
        setTierError('O valor total precisa ser divisível pelo valor por célula.');
        return;
      }
      setTierError('');
      addTier.mutate({
        data: {
          label: tierLabel.trim(),
          totalValueCents,
          nominalValueCents,
          confirm: true,
        },
      });
    };

    return <section className="panel overflow-hidden" data-testid="panel-prize-batch-generated">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-[#eaf6d9] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#789a31] text-white"><Check size={19} /></div>
          <div>
             <div className="section-kicker text-[#557a1d]">Lote-base · imutável</div>
             <h2 className="mt-1 text-lg font-bold">Configuração inicial selada</h2>
             <p className="mt-1 max-w-2xl text-sm leading-5 text-[#557a1d]">O lote-base contém a primeira distribuição criptográfica. Novos tiers são configurados e sorteados separadamente, sem reabrir este lote.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[#557a1d]"><span className="size-1.5 rounded-full bg-[#789a31]" /> Ativo e imutável</div>
          </div>
        </div>
        <div className="text-left sm:text-right"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#557a1d]">Criado em</div><div className="mt-1 font-mono-ui text-xs">{formatDate(data.createdAt, true)}</div></div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-border/70 sm:grid-cols-4">
        <div className="bg-card px-5 py-4"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Tiers no lote</div><div className="mt-1 font-mono-ui text-xl font-bold">{tierCount}</div><div className="mt-1 text-[11px] text-muted-foreground">faixas configuradas</div></div>
        <div className="bg-card px-5 py-4"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Células</div><div className="mt-1 font-mono-ui text-xl font-bold">{data.totalPositions.toLocaleString('pt-BR')}</div><div className="mt-1 text-[11px] text-muted-foreground">posições premiadas</div></div>
        <div className="bg-card px-5 py-4"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Valor nominal</div><div className="mt-1 font-mono-ui text-xl font-bold">{formatBRL(data.totalValueCents)}</div><div className="mt-1 text-[11px] text-muted-foreground">distribuição planejada</div></div>
        <div className="bg-card px-5 py-4"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Expansão</div><div className="mt-1 text-base font-bold text-[#557a1d]">Liberada</div><div className="mt-1 text-[11px] text-muted-foreground">tiers incrementais</div></div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_.85fr]">
        <div>
           <div className="section-kicker">Commit do lote-base</div>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 break-all rounded-lg bg-muted px-3 py-2 font-mono-ui text-[11px] leading-5">{data.commitHash}</code>
            {data.commitHash && <button className="icon-button shrink-0" aria-label="Copiar commit hash" onClick={() => { void navigator.clipboard.writeText(data.commitHash!).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }); }}><Copy size={14} /></button>}
          </div>
          {copied && <div className="mt-2 text-xs font-semibold text-[#557a1d]">Commit copiado.</div>}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
           <div className="section-kicker">Como ler os estados</div>
           <p className="mt-2 text-sm leading-5 text-muted-foreground"><strong>Tier</strong> é a regra comercial. <strong>Sorteio</strong> é a alocação aleatória das células. <strong>Encontrado</strong> acontece quando o público descobre uma célula.</p>
        </div>
      </div>

      <div className="border-t border-border/70 bg-muted/15 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
           <div><div className="section-kicker">Configuração comercial</div><p className="mt-1 text-sm text-muted-foreground">Crie o tier primeiro. Depois revise os valores e use o botão do próprio tier para sortear as células disponíveis.</p></div>
           {!addTierOpen && <button className="button button-coral" onClick={() => { setAddTierOpen(true); setTierSuccess(''); setTierError(''); }}><Sparkles size={15} /> Criar novo tier</button>}
        </div>
        {tierSuccess && <div className="mt-3 rounded-lg border border-[#b9d993] bg-[#f1f9e8] px-3 py-2 text-xs font-semibold text-[#557a1d]"><div className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0" /><span>{tierSuccess}</span></div></div>}
        {addTierOpen && <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
           <div className="mb-4 rounded-lg bg-[#f4f8ea] px-3 py-2.5 text-xs leading-5 text-[#557a1d]">Esta etapa apenas configura o tier. A quantidade é calculada agora, mas nenhuma célula é sorteada até você confirmar a ação no tier criado.</div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field-label"><span>Nome do tier</span><input className="field" value={tierLabel} maxLength={80} onChange={(event) => setTierLabel(event.target.value)} placeholder="Ex.: R$25" /></label>
            <label className="field-label"><span>Orçamento total</span><input className="field" type="number" min="0.01" step="0.01" value={tierTotalValue} onChange={(event) => setTierTotalValue(event.target.value)} placeholder="1.000,00" /></label>
            <label className="field-label"><span>Prêmio por célula</span><input className="field" type="number" min="0.01" step="0.01" value={tierUnitValue} onChange={(event) => setTierUnitValue(event.target.value)} placeholder="25,00" /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Células a sortear</div><div className="mt-1 font-mono-ui text-lg font-bold">{quantity ? quantity.toLocaleString('pt-BR') : '—'}</div></div>
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Valor do tier</div><div className="mt-1 font-mono-ui text-lg font-bold">{totalValueCents ? formatBRL(totalValueCents) : '—'}</div></div>
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Regra</div><div className="mt-1 text-sm font-bold">{nominalValueCents ? `${formatBRL(nominalValueCents)} por célula` : 'Aguardando valores'}</div></div>
          </div>
          {totalValueCents > 0 && nominalValueCents > 0 && !quantity && <p className="mt-3 text-xs font-semibold text-[#a83d2f]">O orçamento total precisa ser divisível pelo prêmio por célula.</p>}
          {tierError && <div className="mt-3 rounded-lg border border-[#e7b5a8] bg-[#fff6f2] px-3 py-2 text-xs font-semibold text-[#a83d2f]">{tierError}</div>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
             <button className="button button-primary" disabled={addTier.isPending} onClick={submitTier}>{addTier.isPending ? 'Salvando tier…' : 'Salvar tier como rascunho'}</button>
            <button className="button button-ghost" disabled={addTier.isPending} onClick={() => { setAddTierOpen(false); setTierError(''); }}>Cancelar</button>
          </div>
         </div>}
         {drawError && <div className="mt-3 rounded-lg border border-[#e7b5a8] bg-[#fff6f2] px-3 py-2 text-xs font-semibold text-[#a83d2f]">{drawError}</div>}
         {data.draftTiers.length > 0 && <div className="mt-5 border-t border-border/70 pt-5">
           <div className="section-kicker">Tiers aguardando sorteio</div>
           <p className="mt-1 text-sm text-muted-foreground">Os tiers abaixo estão configurados, mas ainda não fazem parte do grid premiado.</p>
           <div className="mt-3 grid gap-3 lg:grid-cols-2">
             {data.draftTiers.map((draft) => (
               <div className="tier-draft-card" key={draft.tierId}>
                 <div className="min-w-0">
                   <div className="flex items-center gap-2"><span className="tier-index">{String(draft.tierId).padStart(2, '0')}</span><strong>{draft.label}</strong><span className="status-badge status-pending">Rascunho</span></div>
                   <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                     <div><span className="block text-muted-foreground">Por célula</span><strong className="font-mono-ui">{formatBRL(draft.nominalValueCents)}</strong></div>
                     <div><span className="block text-muted-foreground">Células</span><strong className="font-mono-ui">{draft.quantity.toLocaleString('pt-BR')}</strong></div>
                     <div><span className="block text-muted-foreground">Valor nominal</span><strong className="font-mono-ui">{formatBRL(draft.totalValueCents)}</strong></div>
                   </div>
                 </div>
                 <button className="button button-coral shrink-0" disabled={drawTier.isPending} onClick={() => { if (window.confirm(`Sortear ${draft.quantity.toLocaleString('pt-BR')} células para o tier ${draft.label}? Esta ação é irreversível.`)) { setDrawError(''); setDrawTierId(draft.tierId); drawTier.mutate({ tierId: draft.tierId, data: { confirm: true } }); } }}>{drawTierId === draft.tierId ? 'Sorteando…' : 'Sortear células'}</button>
               </div>
             ))}
           </div>
         </div>}
      </div>
    </section>;
  }

   return <section className="panel overflow-hidden" data-testid="panel-prize-batch-generation">
     <div className="flex items-start gap-3 border-b border-border/70 bg-[#fff8e5] px-5 py-5"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1d78c] text-[#70500a]"><Sparkles size={19} /></div><div><div className="section-kicker text-[#876d2e]">Primeira configuração · irreversível</div><h2 className="mt-1 text-lg font-bold">Gerar lote-base</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#876d2e]">Cria {data.totalPositions.toLocaleString('pt-BR')} posições da configuração inicial, totalizando {formatBRL(data.totalValueCents)} nominais. Esta etapa acontece uma única vez; tiers novos entram pelo fluxo de rascunho e sorteio.</p></div></div>
     <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs leading-5 text-muted-foreground">O commit hash será exibido depois e permite conferir a distribuição inicial.</div>{confirmOpen ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[#a83d2f]">Confirmar criação permanente?</span><button className="button button-danger" disabled={generate.isPending} onClick={() => generate.mutate({ data: { confirm: true } })}>{generate.isPending ? 'Gerando…' : 'Sim, gerar lote-base'}</button><button className="button button-ghost" disabled={generate.isPending} onClick={() => setConfirmOpen(false)}>Cancelar</button></div> : <button className="button button-coral" onClick={() => setConfirmOpen(true)} data-testid="button-open-generate-prize-batch"><Sparkles size={15} /> Preparar lote-base</button>}</div>
    {generate.isError && <div className="border-t border-[#e7b5a8] bg-[#fff6f2] px-5 py-3 text-xs font-semibold text-[#a83d2f]">Não foi possível gerar o lote. Ele pode já ter sido criado por outra operação; atualize para conferir.</div>}
  </section>;
}

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
  if (!accessKey) return <><PageHeader eyebrow="Prêmios / configuração e sorteios" title="Prêmios e sorteios" description="Configure tiers, sorteie células e acompanhe a distribuição sem misturar as etapas." /><AccessKeyPrompt onSaved={(key) => { saveAccessKey(key); setShowKey(false); }} /></>;
  if (pool.isLoading) return <><PageHeader eyebrow="Prêmios / configuração e sorteios" title="Prêmios e sorteios" description="Configure tiers, sorteie células e acompanhe a distribuição sem misturar as etapas." /><LoadingPanel rows={6} /></>;
  if (pool.isError && isAccessError(pool.error)) return <><PageHeader eyebrow="Prêmios / configuração e sorteios" title="Prêmios e sorteios" description="Configure tiers, sorteie células e acompanhe a distribuição sem misturar as etapas." />{showKey ? <AccessKeyPrompt onSaved={(key) => { saveAccessKey(key); setShowKey(false); }} /> : <ErrorState accessRequired onRetry={() => setShowKey(true)} />}</>;
  if (pool.isError || !pool.data) return <><PageHeader eyebrow="Prêmios / configuração e sorteios" title="Prêmios e sorteios" /><ErrorState onRetry={() => pool.refetch()} /></>;
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
    <PageHeader eyebrow="Prêmios / configuração e sorteios" title="Prêmios e sorteios" description="Configure tiers, sorteie células e acompanhe a distribuição sem misturar as etapas." action={<button className="button button-secondary" onClick={() => pool.refetch()} data-testid="button-refresh-prize-pool"><RefreshCw size={15} /> Atualizar</button>} />
    <div className="pool-banner"><div className="pool-banner-mark"><ShieldCheck size={21} /></div><div className="min-w-0 flex-1"><div className="section-kicker text-[#d9f77a]">Lote-base / auditoria</div><h2>{data.batchRevealedAt ? 'Distribuição inicial conferida' : 'Lote-base aguardando reveal'}</h2><p>{data.batchRevealedAt ? `Commit revelado em ${formatDate(data.batchRevealedAt, true)}. Tiers novos têm seu próprio sorteio e commit.` : 'A prova criptográfica ainda não foi revelada para a distribuição inicial.'}</p></div><div className="pool-banner-stat"><span>{Math.round(allocation)}%</span><small>encontrado</small></div></div>
     <PrizeBatchControl />
     <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
       <section className="panel overflow-hidden" data-testid="panel-prize-tiers">
         <SectionHeading kicker="A — distribuição ativa" title="Tiers já sorteados" detail={`${data.tiers.length} tiers · ${totalPositions.toLocaleString('pt-BR')} células · ${formatBRL(totalValue)} nominais`} />
         {data.tiers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Tier</th><th>Prêmio por célula</th><th>Células no tier</th><th>Valor nominal</th><th>Resgates</th><th>Progresso</th></tr></thead><tbody>{data.tiers.map((tier) => { const percent = tier.totalPositions ? (tier.foundPositions / tier.totalPositions) * 100 : 0; return <tr key={tier.tierId} data-testid={`row-prize-tier-${tier.tierId}`}><td><div className="flex items-center gap-3"><span className="tier-index">{String(tier.tierId).padStart(2, '0')}</span><div><div className="font-semibold">{tier.label}</div><div className="mt-0.5 text-xs text-muted-foreground">Tier {String(tier.tierId).padStart(2, '0')}</div></div></div></td><td><div className="font-mono-ui text-sm font-bold">{formatBRL(tier.nominalValueCents)}</div><div className="mt-1 text-[10px] text-muted-foreground">por célula</div></td><td><div className="font-mono-ui text-sm font-bold">{tier.totalPositions.toLocaleString('pt-BR')}</div><div className="mt-1 text-[10px] text-muted-foreground">{tier.remainingPositions.toLocaleString('pt-BR')} disponíveis</div></td><td><div className="font-mono-ui text-sm font-bold">{formatBRL(tier.totalValueCents)}</div><div className="mt-1 text-[10px] text-muted-foreground">{tier.foundPositions.toLocaleString('pt-BR')} encontrados</div></td><td><div className="font-mono-ui text-sm font-bold">{tier.redeemedPositions.toLocaleString('pt-BR')} pagos</div><div className="mt-1 text-[10px] text-muted-foreground">{tier.pendingRedemptionPositions} pendentes · {tier.rejectedPositions} rejeitados</div></td><td className="min-w-[150px]"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{Math.round(percent)}% encontrados</span><span>{tier.foundPositions}/{tier.totalPositions}</span></div><div className="progress-track"><div className="progress-fill bg-[#789a31]" style={{ width: `${Math.min(100, percent)}%` }} /></div><div className="mt-2 text-[10px] text-muted-foreground">{formatBRL(tier.redeemedValueCents)} pagos</div></td></tr> })}</tbody></table></div> : <EmptyState title="Pool sem tiers" detail="Não há tiers registrados nesta distribuição." />}
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
          title="Células sorteadas"
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
          <EmptyState title="Nenhuma posição encontrada" detail="Ajuste os filtros ou confirme se algum tier já foi sorteado." />
        )}
      </section>
    <section className="panel" data-testid="panel-commit-metadata">
      <SectionHeading kicker="D — verificabilidade" title="Metadados de auditoria" detail="Cada commit registra uma distribuição sorteada e não deve ser alterado." />
      <div className="grid gap-px bg-border/70 sm:grid-cols-3"><div className="metadata-cell"><div className="metadata-icon"><Fingerprint size={17} /></div><div><div className="metadata-label">Commit hash</div><div className="metadata-value break-all">{data.commitHash ?? 'Não disponível'}</div></div></div><div className="metadata-cell"><div className="metadata-icon"><Database size={17} /></div><div><div className="metadata-label">Lote criado</div><div className="metadata-value">{formatDate(data.batchCreatedAt, true)}</div></div></div><div className="metadata-cell"><div className="metadata-icon"><LockKeyhole size={17} /></div><div><div className="metadata-label">Reveal registrado</div><div className="metadata-value">{formatDate(data.batchRevealedAt, true)}</div></div></div></div>
    </section>
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><BadgeCheck size={14} className="text-[#789a31]" /> Metadados exibidos diretamente do serviço de operações.</div>
  </div>;
}

export default function AdminPrizePool() {
  return <AdminShell><PrizePoolContent /></AdminShell>;
}