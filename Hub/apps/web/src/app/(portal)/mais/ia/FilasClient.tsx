'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { decidir } from './actions';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Bot } from 'lucide-react';

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
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">No que se baseou</p>
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
  const [nota, setNota] = useState('');
  const [categoria, setCategoria] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Classificação já aplicada que "estava errada" precisa dizer qual é a
   * certa. Antes, rejeitar só anotava: o item sumia daqui e o lançamento
   * continuava na conta errada, com a tela dizendo que estava resolvido.
   */
  const pedeCategoria = modo === 'revisao' && acao.kind === 'CLASSIFICAR_LANCAMENTO';

  function agir(decisao: 'aprovar' | 'rejeitar') {
    setErro(null);
    startTransition(async () => {
      const r = await decidir(
        acao.id,
        decisao,
        nota || undefined,
        decisao === 'rejeitar' && pedeCategoria ? categoria : undefined,
      );
      // Só sai da fila o que o servidor aceitou — sumir com um item recusado
      // é mostrar como resolvido o que não foi.
      if (r.ok) onDecidido(acao.id);
      else setErro(r.message);
    });
  }

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
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft" htmlFor={`cat-${acao.id}`}>
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
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft" htmlFor={`nota-${acao.id}`}>
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
              disabled={pendente || nota.trim().length < 5 || (pedeCategoria && !categoria)}
              title={nota.trim().length < 5 ? 'Escreva o motivo para treinar o agente' : undefined}
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

export function FilasClient({
  inicial,
}: {
  inicial: { aprovacao: Acao[]; revisao: Acao[]; categorias: { id: string; nome: string }[] };
}) {
  const [aprovacao, setAprovacao] = useState(inicial.aprovacao);
  const [revisao, setRevisao] = useState(inicial.revisao);

  const remover = (lista: 'a' | 'r') => (id: string) => {
    if (lista === 'a') setAprovacao((x) => x.filter((i) => i.id !== id));
    else setRevisao((x) => x.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="font-serif font-bold text-lg text-ink">Esperando você decidir</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Ações sensíveis com movimentação de valores ou comunicação externa aguardando sua validação.
          </p>
        </div>

        {aprovacao.length === 0 ? (
          <Card level={1} className="p-6 text-center text-xs text-ink-soft">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
            Nenhuma ação pendente de aprovação no momento.
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
        <div>
          <h2 className="font-serif font-bold text-lg text-ink">Executado com autonomia (auditoria)</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Ações com alta confiança executadas de forma autônoma. Confirmar ou corrigir aqui refina as regras do modelo.
          </p>
        </div>

        {revisao.length === 0 ? (
          <Card level={1} className="p-6 text-center text-xs text-ink-soft">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
            Todas as rotinas autônomas já foram auditadas.
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
