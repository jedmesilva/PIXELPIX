import { Check, CheckCircle2, Clock3, Copy, ExternalLink, Filter, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminRedemptionQueryKey,
  getListAdminRedemptionsQueryKey,
  useGetAdminRedemption,
  useListAdminRedemptions,
  useUpdateAdminRedemption,
} from '@workspace/api-client-react';
import type { AdminRedemptionUpdateStatus } from '@workspace/api-client-react';
import { AdminShell, PageHeader } from '@/components/admin-shell';
import {
  AccessKeyPrompt,
  DrillLink,
  EmptyState,
  ErrorState,
  LoadingPanel,
  SearchField,
  StatusBadge,
  formatBRL,
  formatDate,
  isAccessError,
  SavingIndicator,
  useAdminAccess,
  withAdminAuthRevision,
} from '@/components/admin-ui';

const statusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'paid', label: 'Pagos' },
  { value: 'rejected', label: 'Rejeitados' },
];

function RedemptionDetail({
  id,
  accessKey,
  authRevision,
  onClose,
  onUpdated,
}: {
  id: number;
  accessKey: string;
  authRevision: number;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useGetAdminRedemption(id, {
    request: { headers: { 'x-admin-access-key': accessKey } },
    query: { enabled: Boolean(id && accessKey), queryKey: withAdminAuthRevision(getGetAdminRedemptionQueryKey(id), authRevision) },
  });
  const update = useUpdateAdminRedemption({
    request: { headers: { 'x-admin-access-key': accessKey } },
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListAdminRedemptionsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetAdminRedemptionQueryKey(id) });
        onUpdated();
      },
    },
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const item = detail.data;

  const updateStatus = (status: AdminRedemptionUpdateStatus) => {
    if (status === 'rejected' && !rejectionReason.trim()) return;
    update.mutate({
      id,
      data: {
        status,
        ...(status === 'rejected' ? { rejectionReason: rejectionReason.trim() } : {}),
      },
    });
  };

  return (
    <div
      className="detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do resgate"
        data-testid="redemption-detail"
      >
        <div className="detail-header">
          <div>
            <div className="section-kicker">Resgate #{id}</div>
            <h2>Contexto do pagamento</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            data-testid="button-close-detail"
          >
            <XCircle size={19} />
          </button>
        </div>
        {detail.isLoading && <LoadingPanel rows={6} />}
        {detail.isError && (
          <ErrorState accessRequired={isAccessError(detail.error)} onRetry={() => detail.refetch()} />
        )}
        {item && (
          <div className="detail-body">
            <div className="detail-amount">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
                  Solicitação
                </span>
                <div className="mt-1 font-mono-ui text-3xl font-bold">
                  {formatBRL(item.requestedAmountCents)}
                </div>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <div className="detail-block">
              <div className="detail-label">Identidade da vitória</div>
              <dl className="detail-list">
                <div>
                  <dt>Solicitante</dt>
                  <dd data-testid="text-detail-email">{item.email}</dd>
                </div>
                <div>
                  <dt>Chave Pix</dt>
                  <dd className="break-all font-mono-ui text-xs">
                    {item.pixKey}{' '}
                    <button
                      className="copy-button"
                      onClick={() => navigator.clipboard?.writeText(item.pixKey)}
                      aria-label="Copiar chave Pix"
                      data-testid="button-copy-pix-key"
                    >
                      <Copy size={13} />
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Certificado</dt>
                  <dd className="font-mono-ui text-xs">{item.certificateCode}</dd>
                </div>
                <div>
                  <dt>Célula</dt>
                  <dd className="font-mono-ui">
                    #{item.cellId}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {item.cellStatus ?? 'sem status'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Valor do prêmio</dt>
                  <dd className="font-mono-ui">{formatBRL(item.prizeValueCents)}</dd>
                </div>
                <div>
                  <dt>Data da vitória</dt>
                  <dd>{formatDate(item.wonAt, true)}</dd>
                </div>
              </dl>
            </div>

            <div className="detail-block">
              <div className="detail-label">Linha do tempo</div>
              <div className="timeline">
                <div>
                  <span className="timeline-dot bg-[#789a31]" />
                  <div>
                    <strong>Solicitado</strong>
                    <small>{formatDate(item.requestedAt, true)}</small>
                  </div>
                </div>
                <div>
                  <span className={`timeline-dot ${item.processedAt ? 'bg-[#ff8e70]' : 'bg-border'}`} />
                  <div>
                    <strong>{item.processedAt ? 'Processado' : 'Aguardando análise'}</strong>
                    <small>
                      {item.processedAt
                        ? `${formatDate(item.processedAt, true)} · ${item.processedBy ?? 'operador'}`
                        : 'Sem processamento ainda'}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {(item.paymentStatus || item.rejectionReason) && (
              <div className="context-note">
                <div className="detail-label">Contexto do provedor</div>
                {item.paymentStatus && (
                  <div className="flex justify-between text-sm">
                    <span>Status do pagamento</span>
                    <strong>{item.paymentStatus}</strong>
                  </div>
                )}
                {item.rejectionReason && (
                  <div className="mt-2 border-t border-border/60 pt-2 text-sm">
                    <span className="text-muted-foreground">Motivo da recusa</span>
                    <p className="mt-1">{item.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}

            {item.status !== 'paid' && item.status !== 'rejected' && (
              <div className="detail-actions">
                <div className="detail-label">Próxima ação</div>
                {item.status === 'pending' ? (
                  <>
                    <div className="action-callout">
                      <div className="action-callout-icon">!</div>
                      <div>
                        <strong>Esta solicitação aguarda análise</strong>
                        <p>Confira a chave Pix e o certificado antes de liberar o pagamento.</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="button button-primary flex-1 justify-center"
                        disabled={update.isPending}
                        onClick={() => updateStatus('approved')}
                        data-testid="button-approve-redemption"
                      >
                        <CheckCircle2 size={15} /> Aprovar resgate
                      </button>
                      <button
                        className="button button-danger flex-1 justify-center"
                        disabled={update.isPending || !rejectionReason.trim()}
                        onClick={() => updateStatus('rejected')}
                        data-testid="button-reject-redemption"
                      >
                        <XCircle size={15} /> Recusar resgate
                      </button>
                    </div>
                    <div className="mt-4">
                      <label className="field-label" htmlFor="rejection-reason">
                        Motivo da recusa <span>(obrigatório para recusar)</span>
                      </label>
                      <textarea
                        id="rejection-reason"
                        className="field min-h-20 resize-y"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Ex.: chave Pix inválida ou certificado inconsistente"
                        maxLength={500}
                        data-testid="textarea-rejection-reason"
                      />
                    </div>
                  </>
                ) : (
                  <button
                    className="button button-coral"
                    disabled={update.isPending}
                    onClick={() => updateStatus('paid')}
                    data-testid="button-pay-redemption"
                  >
                    <ExternalLink size={15} /> Marcar pagamento como concluído
                  </button>
                )}
              </div>
            )}
            <SavingIndicator pending={update.isPending} />
          </div>
        )}
      </aside>
    </div>
  );
}

function QuickStatusAction({
  item,
  accessKey,
  onUpdated,
}: {
  item: { id: number; status: string };
  accessKey: string;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateAdminRedemption({
    request: { headers: { 'x-admin-access-key': accessKey } },
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListAdminRedemptionsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetAdminRedemptionQueryKey(item.id) });
        onUpdated();
      },
    },
  });

  if (item.status !== 'pending' && item.status !== 'approved') return null;
  const nextStatus = item.status === 'pending' ? 'approved' : 'paid';
  const label = nextStatus === 'approved' ? 'Aprovar' : 'Marcar pago';
  const Icon = nextStatus === 'approved' ? Check : CheckCircle2;

  return (
    <button
      className={`button button-compact ${nextStatus === 'approved' ? 'button-primary' : 'button-coral'}`}
      disabled={update.isPending}
      onClick={(event) => {
        event.stopPropagation();
        if (nextStatus === 'approved' && !window.confirm('Aprovar este resgate para pagamento?')) return;
        update.mutate({ id: item.id, data: { status: nextStatus } });
      }}
      data-testid={`button-quick-${nextStatus}-${item.id}`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function RedemptionCard({
  item,
  accessKey,
  onOpen,
  onUpdated,
}: {
  item: any;
  accessKey: string;
  onOpen: () => void;
  onUpdated: () => void;
}) {
  return (
    <article className="redemption-card" data-testid={`card-redemption-${item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{item.email}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Solicitação #{item.id} · célula <span className="font-mono-ui">#{item.cellId}</span>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="redemption-card-grid">
        <div>
          <span>Valor solicitado</span>
          <strong className="font-mono-ui">{formatBRL(item.requestedAmountCents)}</strong>
        </div>
        <div>
          <span>Chave Pix</span>
          <strong className="truncate font-mono-ui text-xs">{item.pixKey}</strong>
        </div>
        <div>
          <span>Certificado</span>
          <strong className="font-mono-ui text-xs">{item.certificateCode}</strong>
        </div>
        <div>
          <span>Solicitado em</span>
          <strong>{formatDate(item.requestedAt, true)}</strong>
        </div>
      </div>
      <div className="redemption-card-actions">
        <QuickStatusAction item={item} accessKey={accessKey} onUpdated={onUpdated} />
        <button className="button button-secondary flex-1 justify-center" onClick={onOpen}>
          <ExternalLink size={14} /> Abrir detalhes
        </button>
      </div>
    </article>
  );
}

function RedemptionsContent() {
  const { accessKey, authRevision, saveAccessKey } = useAdminAccess();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(false);
  const params = useMemo(
    () => ({
      ...(status !== 'all'
        ? { status: status as 'pending' | 'approved' | 'paid' | 'rejected' }
        : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      limit: 50,
      offset: 0,
    }),
    [search, status],
  );
  const list = useListAdminRedemptions(params, {
    request: { headers: { 'x-admin-access-key': accessKey } },
    query: { enabled: Boolean(accessKey), queryKey: withAdminAuthRevision(getListAdminRedemptionsQueryKey(params), authRevision), staleTime: 10_000 },
  });

  useEffect(() => {
    if (!accessKey) return;
    const timer = window.setTimeout(() => list.refetch(), 250);
    return () => window.clearTimeout(timer);
  }, [accessKey, authRevision, search, status]);

  if (!accessKey) {
    return (
      <>
        <PageHeader
          eyebrow="Operações / fila financeira"
          title="Resgates"
          description="Analise e processe solicitações de pagamento Pix."
        />
        <AccessKeyPrompt
          onSaved={(key) => {
            saveAccessKey(key);
            setShowKey(false);
          }}
        />
      </>
    );
  }
  if (list.isLoading) {
    return (
      <>
        <PageHeader
          eyebrow="Operações / fila financeira"
          title="Resgates"
          description="Analise e processe solicitações de pagamento Pix."
        />
        <LoadingPanel rows={7} />
      </>
    );
  }
  if (list.isError && isAccessError(list.error)) {
    return (
      <>
        <PageHeader
          eyebrow="Operações / fila financeira"
          title="Resgates"
          description="Analise e processe solicitações de pagamento Pix."
        />
        {showKey || !accessKey ? (
          <AccessKeyPrompt
            onSaved={(key) => {
              saveAccessKey(key);
              setShowKey(false);
            }}
          />
        ) : (
          <ErrorState accessRequired onRetry={() => setShowKey(true)} />
        )}
      </>
    );
  }
  if (list.isError) {
    return (
      <>
        <PageHeader eyebrow="Operações / fila financeira" title="Resgates" />
        <ErrorState onRetry={() => list.refetch()} />
      </>
    );
  }

  const items = list.data?.items ?? [];
  const pendingItems = items.filter((item) => item.status === 'pending').length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Operações / fila financeira"
        title="Resgates"
        description="Analise cada solicitação, aprove pagamentos válidos e registre o motivo de recusas."
        action={
          <button
            className="button button-secondary"
            onClick={() => list.refetch()}
            data-testid="button-refresh-redemptions"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        }
      />
      <div className="queue-summary">
        <div className="queue-summary-mark">
          <Clock3 size={18} />
        </div>
        <div className="min-w-0">
          <strong>Fila de aprovação manual</strong>
          <p>Solicitações pendentes precisam ser conferidas antes de liberar o pagamento.</p>
        </div>
        <div className="queue-summary-count">
          <span>{pendingItems}</span>
          <small>nesta página</small>
        </div>
      </div>
      <section className="panel overflow-hidden" data-testid="panel-redemption-queue">
        <div className="queue-toolbar">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SearchField value={search} onChange={setSearch} />
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
              {list.data?.total ?? 0} registros
            </span>
          </div>
          <div className="filter-wrap">
            <Filter size={14} className="text-muted-foreground" />
            <select
              className="select-field"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrar por status"
              data-testid="select-redemption-status"
            >
              {statusOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {items.length ? (
          <>
            <div className="table-wrap redemption-desktop">
              <table className="data-table redemption-table">
                <thead>
                  <tr>
                    <th>Solicitante</th>
                    <th>Pix / certificado</th>
                    <th>Valores</th>
                    <th>Vitória</th>
                    <th>Processamento</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} data-testid={`row-redemption-${item.id}`}>
                      <td>
                        <div className="font-semibold">{item.email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          célula <span className="font-mono-ui">#{item.cellId}</span>
                        </div>
                      </td>
                      <td>
                        <div className="max-w-[170px] truncate font-mono-ui text-xs">{item.pixKey}</div>
                        <div className="mt-1 font-mono-ui text-[10px] text-muted-foreground">
                          {item.certificateCode}
                        </div>
                      </td>
                      <td>
                        <div className="font-mono-ui text-sm font-bold">
                          {formatBRL(item.requestedAmountCents)}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          prêmio {formatBRL(item.prizeValueCents)}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">{formatDate(item.wonAt)}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          pedido {formatDate(item.requestedAt)}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock3 size={13} className="text-muted-foreground" />
                          {item.paymentStatus ?? 'Não iniciado'}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {item.processedBy ?? 'aguarda operador'}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <QuickStatusAction
                            item={item}
                            accessKey={accessKey}
                            onUpdated={() => list.refetch()}
                          />
                          <DrillLink onClick={() => setSelectedId(item.id)}>Detalhes</DrillLink>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="redemption-mobile">
              {items.map((item) => (
                <RedemptionCard
                  key={item.id}
                  item={item}
                  accessKey={accessKey}
                  onOpen={() => setSelectedId(item.id)}
                  onUpdated={() => list.refetch()}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Nenhuma solicitação encontrada"
            detail={
              search
                ? 'Tente buscar por outro email, Pix ou certificado.'
                : 'A fila de resgates está vazia para este filtro.'
            }
            action={
              search ? (
                <button
                  className="button button-secondary"
                  onClick={() => setSearch('')}
                  data-testid="button-clear-empty-search"
                >
                  Limpar busca
                </button>
              ) : undefined
            }
          />
        )}
      </section>
      {selectedId !== null && (
        <RedemptionDetail
          id={selectedId}
          accessKey={accessKey}
          authRevision={authRevision}
          onClose={() => setSelectedId(null)}
          onUpdated={() => list.refetch()}
        />
      )}
    </div>
  );
}

export default function AdminRedemptions() {
  return (
    <AdminShell>
      <RedemptionsContent />
    </AdminShell>
  );
}