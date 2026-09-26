'use client';

import { useAviso } from '@/components/ui/useAviso';
import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { decidir, decidirTodas } from '@/lib/server/fila-agente';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Bot, Sparkles, Tag, Loader2 } from 'lucide-react';

interface Acao {
  id: string;
  kind: string;
  rationale: string;
  confidence: number;
  amount: number | null;
  autonomy: string;
  targetTable: string;
  targetId: string | null;
  proposal: unknown;
  evidence: unknown;
  agent: string;
  createdAt: Date | string;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const NOME_ACAO: Record<string, string> = {
  CLASSIFICAR_LANCAMENTO: 'Classificar lançamento',
  CONCILIAR_TRANSACAO: 'Conciliar transação',
  CRIAR_LANCAMENTO: 'Criar lançamento',
  MARCAR_PAGO: 'Marcar como pago',
  EMITIR_NFSE: 'Emitir nota fiscal',
  CANCELAR_NFSE: 'Cancelar nota fiscal',
  PAGAR_GUIA: 'Pagar guia',
  DISTRIBUIR_LUCRO: 'Distribuir lucro',
  FECHAR_MES: 'Fechar o mês',
  ESCRITURAR: 'Escriturar no razão',
  ENVIAR_COBRANCA: 'Enviar cobrança',
};

function Confianca({ valor }: { valor: number }) {
  const pct = Math.round(valor * 100);
  const faixa = valor >= 0.85 ? 'alta' : valor >= 0.6 ? 'média' : 'baixa';
  const cls =
    faixa === 'alta'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
      : faixa === 'média'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20';

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      Confiança {faixa} · {pct}%
    </span>
  );
}

function Evidencia({ evidence }: { evidence: unknown }) {
  const e = evidence as { sinais?: { nome: string; peso: number; forca: number; observado: string }[] } | null;
  if (!e?.sinais?.length) return null;

  return (
    <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-3">
      <p className="rotulo text-ink-soft">No que se baseou</p>
      <ul className="mt-2 space-y-1.5">
        {e.sinais.map((s) => (
          <li key={s.nome} className="flex items-start gap-2 text-xs text-ink-soft">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hexxa-forest dark:bg-hexxa-lime" />
            <span>
              {s.observado}
              <span className="ml-1.5 opacity-60">(peso {s.peso})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemAcao({
  acao,
  modo,
  categorias,
  onDecidido,
}: {
  acao: Acao;
  modo: 'aprovacao' | 'revisao';
  categorias: { id: string; nome: string }[];
  onDecidido: (id: string) => void;
}) {
  const [pendente, startTransition] = useTransition();
  const [rejeitando, setRejeitando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState('');
  const [categoria, setCategoria] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const ehClassificacao = acao.kind === 'CLASSIFICAR_LANCAMENTO';
  const proposta = (acao.proposal ?? {}) as {
    categoriaId?: string;
    categoriaNome?: string;
    contaContabil?: string;
    categoriaAnterior?: string;
  };

  const [categoriaEditada, setCategoriaEditada] = useState(proposta.categoriaId || '');
  const nomeCategoriaProposta =
    proposta.categoriaNome ||
    categorias.find((c) => c.id === proposta.categoriaId)?.nome ||
    'Categoria sugerida';
  const categoriaExibida =
    categorias.find((c) => c.id === categoriaEditada)?.nome || nomeCategoriaProposta;
  const isDespesa = (acao.amount ?? 0) <= 0;

  /**
   * Classificação já aplicada que "estava errada" precisa dizer qual é a
   * certa. Antes, rejeitar só anotava: o item sumia daqui e o lançamento
   * continuava na conta errada, com a tela dizendo que estava resolvido.
   */
  const pedeCategoria = modo === 'revisao' && ehClassificacao;

  function agir(decisao: 'aprovar' | 'rejeitar', categoriaCustomId?: string) {
    setErro(null);
    startTransition(async () => {
      const catParaEnviar =
        categoriaCustomId ||
        (decisao === 'rejeitar' && pedeCategoria ? categoria : undefined);

      const r = await decidir(
        acao.id,
        decisao,
        nota || undefined,
        catParaEnviar,
      );
      // Só sai da fila o que o servidor aceitou — sumir com um item recusado
      // é mostrar como resolvido o que não foi.
      if (r.ok) onDecidido(acao.id);
      else setErro(r.message);
    });
  }

  // ── Layout especial e humanizado para Classificação de Lançamento ──
  if (ehClassificacao) {
    return (
      <Card level={1} className="flex flex-col gap-3.5 p-5 sm:p-6 border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime text-xs shadow-(--elev-inset)">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="rotulo text-hexxa-forest dark:text-hexxa-lime">
                Sugestão Automática de Categoria
              </p>
              <p className="text-xs text-ink-soft">
                agente {acao.agent}
                {acao.amount !== null && (
                  <span className="font-serif font-bold tabular text-ink ml-1.5">
                    · {BRL.format(acao.amount)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Confianca valor={acao.confidence} />
        </div>

        {/* Mensagem clara para o usuário leigo */}
        <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] p-4 border border-black/5 dark:border-white/5 space-y-2.5">
          <p className="text-sm text-ink leading-relaxed">
            {isDespesa ? 'Esta despesa foi categorizada como ' : 'Esta receita foi categorizada como '}
            <strong className="inline-flex items-center gap-1.5 rounded-lg bg-hexxa-forest text-hexxa-lime dark:bg-hexxa-lime/20 dark:text-hexxa-lime px-2.5 py-1 text-xs font-bold shadow-xs">
              <Tag className="h-3 w-3" />
              {categoriaExibida}
            </strong>
          </p>

          {acao.rationale && (
            <p className="text-xs text-ink-soft leading-normal">
              <strong className="font-semibold text-ink">Motivo:</strong> {acao.rationale}
            </p>
          )}
        </div>

        {/* Campo inline de edição de categoria */}
        {editando && (
          <div className="rounded-2xl bg-surface-card p-3.5 border border-hexxa-green/40 dark:border-hexxa-lime/40 shadow-(--elev-inset) space-y-2 animate-in fade-in">
            <label className="rotulo text-ink-soft block" htmlFor={`cat-edit-${acao.id}`}>
              Para qual categoria deve ir este lançamento?
            </label>
            <select
              id={`cat-edit-${acao.id}`}
              value={categoriaEditada}
              onChange={(e) => setCategoriaEditada(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-surface-card px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime shadow-(--elev-inset)"
            >
              <option value="">— Escolher outra categoria —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}

        <Evidencia evidence={acao.evidence} />

        {erro && (
          <p className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">{erro}</p>
        )}

        {/* Modo de Rejeição com Feedback */}
        {rejeitando && (
          <div className="border-t border-black/5 dark:border-white/10 pt-3 space-y-3">
            {pedeCategoria && (
              <div>
                <label className="rotulo text-ink-soft" htmlFor={`cat-${acao.id}`}>
                  Qual é a categoria certa?
                </label>
                <select
                  id={`cat-${acao.id}`}
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-black/10 dark:border-white/10 bg-surface-card shadow-(--elev-inset) px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="">— escolher categoria correta —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="rotulo text-ink-soft" htmlFor={`nota-${acao.id}`}>
                Por que não? — este feedback ensina o agente
              </label>
              <textarea
                id={`nota-${acao.id}`}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Ex.: esse fornecedor é de manutenção, não de licenças de software."
                className="mt-1.5 w-full rounded-xl border border-black/10 dark:border-white/10 bg-surface-card shadow-(--elev-inset) p-3 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
              />
            </div>
          </div>
        )}

        {/* Pergunta e botões de ação humanizados: É isso mesmo? Sim / Não / Editar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 dark:border-white/10 pt-3">
          <p className="text-xs font-bold text-ink">É isso mesmo?</p>

          {!rejeitando ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditando(!editando)}
                disabled={pendente}
                className="rounded-full border border-black/10 dark:border-white/10 bg-surface-card px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
              >
                {editando ? 'Cancelar edição' : 'Editar categoria'}
              </button>

              <button
                type="button"
                onClick={() => setRejeitando(true)}
                disabled={pendente}
                className="rounded-full border border-black/10 dark:border-white/10 bg-surface-card px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
              >
                Não
              </button>

              <button
                type="button"
                onClick={() => {
                  if (editando && categoriaEditada && categoriaEditada !== proposta.categoriaId) {
                    agir('aprovar', categoriaEditada);
                  } else {
                    agir('aprovar');
                  }
                }}
                disabled={pendente || (editando && !categoriaEditada)}
                className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
              >
                {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Sim, confirmar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRejeitando(false)}
                disabled={pendente}
                className="rounded-full border border-black/10 dark:border-white/10 bg-surface-card px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => agir('rejeitar')}
                disabled={pendente || (pedeCategoria && !categoria)}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-xs font-bold text-white shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-40"
              >
                Confirmar rejeição
              </button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ── Layout padrão para outras ações (Fechamento, Guias, etc.) ──
  return (
    <Card level={1} className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif font-bold text-base text-ink">{NOME_ACAO[acao.kind] ?? acao.kind}</p>
          <p className="text-xs text-ink-soft mt-1">
            agente {acao.agent}
            {acao.amount !== null && (
              <span className="font-serif tabular font-bold text-ink ml-1">
                · {BRL.format(acao.amount)}
              </span>
            )}
          </p>
        </div>
        <Confianca valor={acao.confidence} />
      </div>

      <p className="text-xs text-ink leading-relaxed whitespace-pre-line bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-3 border border-black/5 dark:border-white/5">
        {acao.rationale}
      </p>

      <Evidencia evidence={acao.evidence} />

      {erro && (
        <p className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">{erro}</p>
      )}

      {rejeitando && pedeCategoria && (
        <div className="border-t border-black/5 dark:border-white/10 pt-3">
          <label className="rotulo text-ink-soft" htmlFor={`cat-${acao.id}`}>
            Qual é a categoria certa?
          </label>
          <select
            id={`cat-${acao.id}`}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3 py-2 text-xs text-ink outline-none"
          >
            <option value="">— escolher —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}

      {rejeitando && (
        <div className="border-t border-black/5 dark:border-white/10 pt-3">
          <label className="rotulo text-ink-soft" htmlFor={`nota-${acao.id}`}>
            Por que não? — é este feedback que ensina o agente
          </label>
          <textarea
            id={`nota-${acao.id}`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ex.: esse fornecedor é de manutenção de máquinas, não de licenças de software."
            className="mt-2 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-3 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/5 dark:border-white/10 pt-3">
        {!rejeitando ? (
          <>
            <button
              type="button"
              onClick={() => setRejeitando(true)}
              disabled={pendente}
              className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
            >
              {modo === 'aprovacao' ? 'Rejeitar' : 'Estava errado'}
            </button>
            <button
              type="button"
              onClick={() => agir('aprovar')}
              disabled={pendente}
              className="rounded-full bg-hexxa-forest hover:brightness-110 px-5 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
            >
              {modo === 'aprovacao' ? 'Aprovar' : 'Está certo'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRejeitando(false)}
              disabled={pendente}
              className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => agir('rejeitar')}
              disabled={pendente || (pedeCategoria && !categoria)}
              className="rounded-full bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-40"
            >
              Confirmar rejeição
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * A fila de decisões do agente, onde o trabalho já mora.
 *
 * Isto era uma tela própria chamada "O que a IA fez", sob Contabilidade. Dois
 * problemas: 98% da fila era classificação de lançamento — assunto da
 * Conciliação, que vive em outra seção do menu —, e o nome falava do
 * mecanismo em vez do trabalho. O cliente não quer saber o que a IA fez; quer
 * saber o que falta ele conferir.
 *
 * Agora o componente é montado onde o assunto está: as classificações dentro
 * da Conciliação, o fechamento dentro do Fechamento. Os textos vêm de fora
 * porque cada lugar fala de uma coisa.
 */
export function FilaDeAcoes({
  inicial,
  titulos,
}: {
  inicial: { aprovacao: Acao[]; revisao: Acao[]; categorias: { id: string; nome: string }[] };
  titulos: {
    aprovacao: { titulo: string; descricao: string; vazio: string };
    revisao: { titulo: string; descricao: string; vazio: string };
  };
}) {
  const { avisar, elemento: avisoEl } = useAviso();
  const [aprovacao, setAprovacao] = useState(inicial.aprovacao);
  const [revisao, setRevisao] = useState(inicial.revisao);
  const [pendenteAprovacao, startAprovacao] = useTransition();
  const [pendenteRevisao, startRevisao] = useTransition();

  const remover = (lista: 'a' | 'r') => (id: string) => {
    if (lista === 'a') setAprovacao((x) => x.filter((i) => i.id !== id));
    else setRevisao((x) => x.filter((i) => i.id !== id));
  };

  function handleAceitarTodasAprovacao() {
    startAprovacao(async () => {
      const itens = aprovacao.map((a) => ({
        acaoId: a.id,
        decisao: 'aprovar' as const,
      }));
      const r = await decidirTodas(itens);
      if (r.ok) {
        setAprovacao([]);
      } else {
        avisar(r.message || 'Não foi possível processar as ações.', false);
      }
    });
  }

  function handleAceitarTodasRevisao() {
    startRevisao(async () => {
      const itens = revisao.map((a) => ({
        acaoId: a.id,
        decisao: 'aprovar' as const,
      }));
      const r = await decidirTodas(itens);
      if (r.ok) {
        setRevisao([]);
      } else {
        avisar(r.message || 'Não foi possível processar as revisões.', false);
      }
    });
  }

  return (
    <div className="space-y-8">
      {avisoEl}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="rotulo text-ink-soft">{titulos.aprovacao.titulo}</h2>
            <p className="text-xs text-ink-soft mt-0.5">{titulos.aprovacao.descricao}</p>
          </div>
          {aprovacao.length > 1 && (
            <button
              type="button"
              onClick={handleAceitarTodasAprovacao}
              disabled={pendenteAprovacao}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-50"
            >
              {pendenteAprovacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Aceitar todas ({aprovacao.length})
            </button>
          )}
        </div>

        {aprovacao.length === 0 ? (
          <Card level={1} className="p-6 text-center text-xs text-ink-soft">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
            {titulos.aprovacao.vazio}
          </Card>
        ) : (
          <div className="space-y-4">
            {aprovacao.map((a) => (
              <ItemAcao key={a.id} acao={a} modo="aprovacao" categorias={inicial.categorias} onDecidido={remover('a')} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="rotulo text-ink-soft">{titulos.revisao.titulo}</h2>
            <p className="text-xs text-ink-soft mt-0.5">{titulos.revisao.descricao}</p>
          </div>
          {revisao.length > 1 && (
            <button
              type="button"
              onClick={handleAceitarTodasRevisao}
              disabled={pendenteRevisao}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-50"
            >
              {pendenteRevisao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirmar todas ({revisao.length})
            </button>
          )}
        </div>

        {revisao.length === 0 ? (
          <Card level={1} className="p-6 text-center text-xs text-ink-soft">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
            {titulos.revisao.vazio}
          </Card>
        ) : (
          <div className="space-y-4">
            {revisao.map((a) => (
              <ItemAcao key={a.id} acao={a} modo="revisao" categorias={inicial.categorias} onDecidido={remover('r')} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
