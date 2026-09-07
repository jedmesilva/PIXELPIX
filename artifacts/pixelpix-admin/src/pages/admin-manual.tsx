import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  TicketCheck,
} from 'lucide-react';
import { AdminShell, PageHeader } from '@/components/admin-shell';

type StepProps = {
  number: string;
  title: string;
  children: React.ReactNode;
};

function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#d9f77a] font-mono-ui text-xs font-bold text-[#202a2f]">
        {number}
      </div>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-sm font-bold">{title}</h3>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function ManualSection({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = 'default',
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: 'default' | 'warning' | 'success';
  children: React.ReactNode;
}) {
  const toneClasses = {
    default: 'border-border/70',
    warning: 'border-[#e7d49b] bg-[#fffaf0]',
    success: 'border-[#c7dfa5] bg-[#f4faea]',
  };

  return (
    <section id={id} className={`panel scroll-mt-28 overflow-hidden border ${toneClasses[tone]}`}>
      <div className="flex items-start gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d9f77a] text-[#202a2f]">
          <Icon size={19} strokeWidth={2} />
        </div>
        <div>
          <div className="section-kicker">{eyebrow}</div>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-6 px-5 py-6 sm:px-6">{children}</div>
    </section>
  );
}

function Callout({
  icon: Icon,
  title,
  children,
  tone = 'info',
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  children: React.ReactNode;
  tone?: 'info' | 'warning' | 'success';
}) {
  const classes = {
    info: 'border-[#c7e8ea] bg-[#f0fbfc] text-[#245c63]',
    warning: 'border-[#e7d49b] bg-[#fff8e5] text-[#70500a]',
    success: 'border-[#c7dfa5] bg-[#f4faea] text-[#557a1d]',
  };

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${classes[tone]}`}>
      <Icon className="mt-0.5 shrink-0" size={17} />
      <div className="text-sm leading-6">
        <strong className="font-bold">{title}</strong>
        <div className="mt-1 opacity-85">{children}</div>
      </div>
    </div>
  );
}

function StatusTable() {
  const statuses = [
    ['Pendente', 'A solicitação aguarda conferência do operador.', 'Abra os detalhes e aprove ou recuse.'],
    ['Aprovado', 'A análise foi concluída e o prêmio pode ser enviado.', 'Confira o token e envie o Pix pela Efí.'],
    ['Pagamento pendente', 'O envio foi solicitado ao provedor.', 'Aguarde a confirmação e registre o pagamento concluído.'],
    ['Pago', 'O pagamento foi confirmado e lançado no ledger.', 'Nenhuma ação adicional é necessária.'],
    ['Rejeitado', 'A solicitação foi recusada com justificativa.', 'Não pode ser processada novamente.'],
    ['Falho', 'Uma tentativa anterior não foi concluída.', 'Revise os dados e reapro­ve ou tente o pagamento novamente.'],
  ];

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>O que significa</th>
            <th>Próxima ação</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map(([status, meaning, action]) => (
            <tr key={status}>
              <td className="whitespace-nowrap font-semibold">{status}</td>
              <td className="text-muted-foreground">{meaning}</td>
              <td className="text-muted-foreground">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminManualContent() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Central de operações"
        title="Manual do administrador"
        description="Um guia prático para consultar o sistema, gerar o lote premiado, analisar resgates e concluir pagamentos com segurança."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <ManualSection
            id="comece-aqui"
            eyebrow="01 / acesso"
            title="Comece por aqui"
            description="O painel separa consulta, decisão e pagamento. Siga sempre essa ordem e nunca pule a conferência."
            icon={KeyRound}
            tone="success"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['1', 'Acesse', 'Abra o administrativo em /admin/ e informe a chave operacional.'],
                ['2', 'Confira', 'Leia os números e o histórico antes de alterar qualquer status.'],
                ['3', 'Registre', 'Toda decisão importante precisa terminar em um status visível.'],
              ].map(([number, title, text]) => (
                <div className="rounded-xl border border-border/70 bg-card p-4" key={number}>
                  <div className="font-mono-ui text-xs font-bold text-[#557a1d]">{number} — {title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
            <Callout icon={LockKeyhole} title="A chave nunca deve ser colocada na URL." tone="info">
              Ela é enviada somente no header seguro da sessão e permanece apenas neste navegador. Se o painel mostrar “Acesso protegido”, confirme a chave e a configuração de acesso da API.
            </Callout>
          </ManualSection>

          <ManualSection
            id="visao-geral"
            eyebrow="02 / monitoramento"
            title="Visão geral"
            description="Use esta tela para entender rapidamente o dinheiro, o estado da grade e a fila de resgates."
            icon={ClipboardCheck}
          >
            <div className="space-y-4">
              <Step number="1" title="Leia os quatro indicadores do topo">
                Saldo disponível é a reserva de prêmios; caixa disponível é a diferença entre entradas e saídas; pendente de resgate é o que exige análise; vencedores mostra quantas posições premiadas já foram encontradas.
              </Step>
              <Step number="2" title="Compare dinheiro e grade">
                Em “Visão financeira”, observe distribuído, resgatado, total a distribuir, receita e estornos. Em “Estado das células”, confira disponíveis, reservadas e pagas.
              </Step>
              <Step number="3" title="Abra a fila recente">
                Use “Ver fila completa” para ir direto aos resgates. Atualize a tela quando houver uma nova operação ou retorno do provedor.
              </Step>
            </div>
            <Callout icon={CircleHelp} title="A visão geral é leitura operacional, não substitui a análise do resgate." tone="info">
              Para aprovar, recusar ou pagar, abra a tela “Resgates” e entre nos detalhes da solicitação.
            </Callout>
          </ManualSection>

          <ManualSection
            id="lote-premiado"
            eyebrow="03 / integridade"
            title="Gerar o lote premiado"
            description="Esta é a operação mais sensível do painel. Ela cria a distribuição criptográfica que será usada pelo produto."
            icon={Sparkles}
            tone="warning"
          >
            <Callout icon={AlertTriangle} title="A geração é irreversível e só pode acontecer uma vez." tone="warning">
              Não clique para testar, não gere um novo lote para substituir o anterior e não execute a operação enquanto a configuração comercial ainda estiver em revisão.
            </Callout>
            <div className="space-y-4">
              <Step number="1" title="Abra “Prize pool” no menu lateral">
                A página mostra as faixas planejadas, posições, reserva e metadados de integridade.
              </Step>
              <Step number="2" title="Confirme que o estado ainda é “não gerado”">
                O bloco amarelo “Gerar lote premiado” só deve aparecer antes da primeira geração. Se o lote já estiver selado, não existe ação de substituição.
              </Step>
              <Step number="3" title="Revise o resumo antes de prosseguir">
                Confira a quantidade total de posições e o valor nominal total. Verifique se os números correspondem ao planejamento aprovado.
              </Step>
              <Step number="4" title="Clique em “Preparar geração” e confirme">
                A confirmação final cria as posições, mistura os tiers e grava o commit hash. Aguarde a conclusão sem recarregar ou abrir outra operação em paralelo.
              </Step>
              <Step number="5" title="Registre o commit hash">
                Depois da geração, copie o hash exibido e guarde-o no registro operacional da campanha. Ele serve para provar qual distribuição foi selada.
              </Step>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card p-4"><div className="font-semibold">Planejado</div><p className="mt-1 text-sm leading-6 text-muted-foreground">Valor nominal da faixa definida no lote.</p></div>
              <div className="rounded-xl border border-border/70 bg-card p-4"><div className="font-semibold">Distribuído</div><p className="mt-1 text-sm leading-6 text-muted-foreground">Valor liberado dinamicamente quando a posição é encontrada.</p></div>
            </div>
          </ManualSection>

          <ManualSection
            id="posicoes"
            eyebrow="04 / auditoria"
            title="Consultar posições premiadas"
            description="Use o mapa de prêmios para localizar uma célula, conferir a faixa e acompanhar o que já foi encontrado."
            icon={Search}
          >
            <div className="space-y-4">
              <Step number="1" title="Filtre pelo número da célula">
                Digite o ID da posição no campo de busca. Os IDs são estáveis e vão de 0 a 999.999.
              </Step>
              <Step number="2" title="Refine por situação ou faixa">
                “Ainda não encontrados” mostra posições disponíveis; “Já encontrados” mostra posições reclamadas. Também é possível filtrar por tier.
              </Step>
              <Step number="3" title="Compare os quatro valores">
                Veja valor planejado, distribuído real, situação do prêmio e status da célula. O distribuído real pode ser diferente do nominal.
              </Step>
            </div>
            <Callout icon={ShieldCheck} title="Não altere manualmente uma posição premiada." tone="success">
              A descoberta, o valor liberado e os registros de ledger são transacionais e devem ser produzidos pelo fluxo do produto.
            </Callout>
          </ManualSection>

          <ManualSection
            id="resgates"
            eyebrow="05 / fila financeira"
            title="Processar um resgate"
            description="A tela de resgates concentra a análise do certificado e o pagamento. Cada etapa depende da anterior."
            icon={TicketCheck}
          >
            <div className="space-y-4">
              <Step number="1" title="Encontre a solicitação">
                Use busca por e-mail, chave Pix, certificado ou ID da célula. Filtre pelo status para separar pendentes, falhos, aprovados ou pagamentos aguardando confirmação.
              </Step>
              <Step number="2" title="Abra os detalhes">
                Confira solicitante, chave Pix, certificado, célula, valor do prêmio e data da vitória. Copie a chave Pix somente para conferência operacional.
              </Step>
              <Step number="3" title="Valide o token do certificado">
                Cole o token presente no certificado ou leia o QR Code. O token precisa corresponder ao certificado, à célula e ao valor do prêmio.
              </Step>
              <Step number="4" title="Aprove ou recuse">
                Para aprovar, informe o token e clique em “Aprovar resgate”. Para recusar, informe obrigatoriamente um motivo objetivo e clique em “Recusar resgate”.
              </Step>
              <Step number="5" title="Envie o Pix pela Efí">
                Em um resgate aprovado, confirme a chave Pix e use “Enviar Pix pela Efí”. O status passa para “Pagamento pendente” enquanto o provedor processa a transferência.
              </Step>
              <Step number="6" title="Confirme a conclusão">
                Depois de verificar a conclusão no provedor, informe novamente o token e clique em “Confirmar pagamento concluído”. Essa ação registra o pagamento e libera o compromisso no ledger.
              </Step>
            </div>
            <StatusTable />
          </ManualSection>

          <ManualSection
            id="falhas-e-seguranca"
            eyebrow="06 / exceções"
            title="Falhas e boas práticas"
            description="Quando algo parecer errado, pare a operação e preserve o contexto antes de tentar novamente."
            icon={ShieldCheck}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['Token inválido', 'Não aprove nem pague. Solicite o certificado correto e confira célula, valor e código.'],
                ['Chave Pix divergente', 'Não envie o pagamento. Registre a inconsistência e recuse apenas com justificativa.'],
                ['Efí não confirmou', 'Não marque como pago. Aguarde, atualize a fila e use o status do provedor como fonte de verdade.'],
                ['Lote já gerado', 'Não tente substituir. Copie o commit hash existente e siga com a operação normal.'],
                ['Erro 503 de acesso', 'A API não está aceitando a chave administrativa. Verifique a configuração do ambiente, não tente contornar pela URL.'],
                ['Erro inesperado', 'Salve o ID da operação, horário e status atual. Não repita ações financeiras sem conferir se a primeira tentativa foi registrada.'],
              ].map(([title, detail]) => (
                <div className="rounded-xl border border-border/70 bg-card p-4" key={title}>
                  <div className="flex items-center gap-2 text-sm font-bold"><AlertTriangle size={15} className="text-[#a83d2f]" />{title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
            <Callout icon={LockKeyhole} title="Regra de ouro: nunca use uma operação financeira para “testar” o sistema." tone="warning">
              O ambiente de produção deve ser conferido por leitura, logs e procedimentos controlados. Aprovação, envio e confirmação de Pix deixam registros permanentes.
            </Callout>
          </ManualSection>

          <ManualSection
            id="checklist"
            eyebrow="07 / rotina"
            title="Checklist rápido do operador"
            description="Use esta sequência no início e no fim de cada turno."
            icon={CheckCircle2}
            tone="success"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Entrar com a chave administrativa sem colocá-la na URL.',
                'Ler a Visão geral e verificar pendências financeiras.',
                'Conferir o estado do Prize pool e o commit hash.',
                'Revisar resgates pendentes e falhos.',
                'Validar certificado, célula, valor e chave Pix antes de aprovar.',
                'Confirmar o retorno do provedor antes de marcar como pago.',
                'Registrar inconsistências e não repetir operações sem conferir o status.',
                'Sair do navegador compartilhado ao terminar o turno.',
              ].map((item) => (
                <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-card p-3 text-sm leading-6" key={item}>
                  <CheckCircle2 className="mt-1 shrink-0 text-[#789a31]" size={15} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </ManualSection>
        </div>

        <aside className="h-fit xl:sticky xl:top-28">
          <div className="panel overflow-hidden">
            <div className="border-b border-border/70 bg-[#202a2f] px-5 py-5 text-[#f4f2e9]">
              <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#d9f77a]"><BookOpen size={14} /> Índice do manual</div>
              <h2 className="mt-2 text-lg font-bold">Encontre uma operação</h2>
              <p className="mt-1 text-xs leading-5 text-[#f4f2e9]/65">Clique para ir direto à instrução.</p>
            </div>
            <nav className="space-y-1 p-3">
              {[
                ['comece-aqui', 'Comece por aqui'],
                ['visao-geral', 'Visão geral'],
                ['lote-premiado', 'Gerar lote premiado'],
                ['posicoes', 'Consultar posições'],
                ['resgates', 'Processar resgate'],
                ['falhas-e-seguranca', 'Falhas e segurança'],
                ['checklist', 'Checklist rápido'],
              ].map(([href, label]) => (
                <a className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" href={`#${href}`} key={href}>
                  <span>{label}</span>
                  <ChevronRight className="opacity-0 transition-opacity group-hover:opacity-100" size={15} />
                </a>
              ))}
            </nav>
            <div className="border-t border-border/70 px-5 py-4">
              <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ArrowRight className="mt-0.5 shrink-0 text-[#789a31]" size={14} /><span>Em caso de dúvida, preserve o status atual e consulte o histórico antes de agir.</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function AdminManual() {
  return (
    <AdminShell>
      <AdminManualContent />
    </AdminShell>
  );
}