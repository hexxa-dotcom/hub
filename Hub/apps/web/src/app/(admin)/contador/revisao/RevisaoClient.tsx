'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, X, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { decidirNaFila, confirmarGrupo, type CategoriaDaEmpresa } from './actions';
import type { ItemDaFilaDoEscritorio } from '@hexxa/db';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const NOME_ACAO: Record<string, string> = {
  CLASSIFICAR_LANCAMENTO: 'Classificação',
  FECHAR_MES: 'Fechamento',
  CONCILIAR: 'Conciliação',
};

/**
 * A fila agrupada pelo que a IA decidiu.
 *
 * ── Por que agrupar ─────────────────────────────────────────────────────
 *
 * Uma fila de cem cartões iguais treina o contador a clicar "está certo" sem
 * ler — e aí a revisão existe só no nome. Agrupada por empresa e categoria,
 * a pergunta vira outra: "estes doze lançamentos foram para Softwares e
 * Assinaturas — algum destoa?". Essa pergunta se responde de verdade, e
 * rápido, porque o que destoa salta aos olhos no meio dos parecidos.
 */
export function RevisaoClient({
  itens,
  categorias,
}: {
  itens: ItemDaFilaDoEscritorio[];
  categorias: CategoriaDaEmpresa[];
}) {
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  const vivos = itens.filter((i) => !resolvidos.has(i.id));
  const aprovacao = vivos.filter((i) => i.fila === 'APROVACAO');

  const grupos = useMemo(() => {
    const m = new Map<string, { empresa: string; companyId: string; categoria: string; itens: ItemDaFilaDoEscritorio[] }>();
    for (const i of vivos.filter((x) => x.fila === 'REVISAO')) {
      const cat = i.categoriaEscolhida ?? NOME_ACAO[i.kind] ?? i.kind;
      const chave = `${i.companyId}:${cat}`;
      const g = m.get(chave) ?? { empresa: i.empresa, companyId: i.companyId, categoria: cat, itens: [] };
      g.itens.push(i);
      m.set(chave, g);
    }
    return [...m.values()].sort(
      (a, b) => a.empresa.localeCompare(b.empresa) || b.itens.length - a.itens.length,
    );
  }, [vivos]);

  const sair = (ids: string[]) => setResolvidos((s) => new Set([...s, ...ids]));

  if (!vivos.length) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-8 text-center dark:border-white/10 dark:bg-[#1A1A18]">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Nada esperando você</p>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Quando a IA classificar algo que merece um segundo olhar, aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        <strong className="text-[#231F20] dark:text-[#F5F6F4]">{vivos.length}</strong> item(ns) ·{' '}
        {aprovacao.length} esperando aprovação · {vivos.length - aprovacao.length} para revisar, em{' '}
        {grupos.length} grupo(s)
      </p>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {erro}
        </p>
      )}

      {aprovacao.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-white dark:bg-[#1A1A18]">
          <div className="border-b border-black/5 px-5 py-3.5 dark:border-white/10">
            <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Parado, esperando você</h2>
            <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              A IA quis fazer e não pôde sozinha. Nada acontece sem sua decisão.
            </p>
          </div>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {aprovacao.map((i) => (
              <LinhaAprovacao key={i.id} item={i} onSaiu={() => sair([i.id])} onErro={setErro} />
            ))}
          </ul>
        </section>
      )}

      {grupos.map((g) => (
        <Grupo
          key={`${g.companyId}:${g.categoria}`}
          grupo={g}
          categorias={categorias.filter((c) => c.companyId === g.companyId)}
          onSaiu={sair}
          onErro={setErro}
        />
      ))}
    </div>
  );
}

function Grupo({
  grupo,
  categorias,
  onSaiu,
  onErro,
}: {
  grupo: { empresa: string; companyId: string; categoria: string; itens: ItemDaFilaDoEscritorio[] };
  categorias: CategoriaDaEmpresa[];
  onSaiu: (ids: string[]) => void;
  onErro: (m: string | null) => void;
}) {
  const [confirmando, iniciar] = useTransition();
  const total = grupo.itens.reduce((t, i) => t + (i.amount ?? 0), 0);

  function tudoCerto() {
    onErro(null);
    iniciar(async () => {
      const r = await confirmarGrupo(grupo.itens.map((i) => ({ companyId: i.companyId, acaoId: i.id })));
      if (r.falhas) onErro(`${r.falhas} item(ns) do grupo não puderam ser confirmados.`);
      onSaiu(grupo.itens.map((i) => i.id));
    });
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/5 px-5 py-3.5 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
            <Building2 className="h-3 w-3" /> {grupo.empresa}
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            {grupo.itens.length} lançamento(s) em “{grupo.categoria}”
            <span className="ml-2 font-normal tabular text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(total)}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={tudoCerto}
          disabled={confirmando}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
        >
          {confirmando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Todos certos
        </button>
      </div>

      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {grupo.itens.map((i) => (
          <LinhaRevisao key={i.id} item={i} categorias={categorias} onSaiu={() => onSaiu([i.id])} onErro={onErro} />
        ))}
      </ul>
    </section>
  );
}

function LinhaRevisao({
  item,
  categorias,
  onSaiu,
  onErro,
}: {
  item: ItemDaFilaDoEscritorio;
  categorias: CategoriaDaEmpresa[];
  onSaiu: () => void;
  onErro: (m: string | null) => void;
}) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, iniciar] = useTransition();

  function corrigir() {
    onErro(null);
    iniciar(async () => {
      const r = await decidirNaFila(item.companyId, item.id, 'errado', nota || undefined, categoria);
      if (r.ok) onSaiu();
      else onErro(r.mensagem);
    });
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#231F20] dark:text-[#F5F6F4]">
            {item.lancamento?.descricao || item.rationale.slice(0, 80)}
          </p>
          <p className="text-xs tabular text-[#6E6A61] dark:text-[#A8A49C]">
            {item.lancamento?.data?.split('-').reverse().join('/')}
            {item.amount !== null && <span className="ml-2">{BRL.format(item.amount)}</span>}
            <span className="ml-2">confiança {Math.round(item.confidence * 100)}%</span>
          </p>
        </div>
        {!corrigindo && (
          <button
            type="button"
            onClick={() => setCorrigindo(true)}
            className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-xs font-bold text-[#6E6A61] hover:text-rose-700 dark:border-white/15 dark:text-[#A8A49C] dark:hover:text-rose-400"
          >
            <X className="h-3 w-3" /> Estava errado
          </button>
        )}
      </div>

      {corrigindo && (
        <div className="mt-2.5 flex flex-col gap-2 rounded-xl bg-black/[0.03] p-3 sm:flex-row sm:items-center dark:bg-white/[0.04]">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
          >
            <option value="">— qual é a categoria certa? —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="por quê (ensina o agente)"
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCorrigindo(false)}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={corrigir}
              disabled={!categoria || ocupado}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" />}
              Corrigir no razão
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function LinhaAprovacao({
  item,
  onSaiu,
  onErro,
}: {
  item: ItemDaFilaDoEscritorio;
  onSaiu: () => void;
  onErro: (m: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();

  function decidir(d: 'certo' | 'errado') {
    onErro(null);
    iniciar(async () => {
      const r = await decidirNaFila(item.companyId, item.id, d);
      if (r.ok) onSaiu();
      else onErro(r.mensagem);
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
          {item.empresa} · {NOME_ACAO[item.kind] ?? item.kind}
        </p>
        {item.categoriaEscolhida && (
          <p className="mt-1 text-xs text-[#231F20] dark:text-[#F5F6F4]">
            Categorizado como <strong className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">“{item.categoriaEscolhida}”</strong>
          </p>
        )}
        <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          <strong className="font-semibold text-[#231F20] dark:text-[#F5F6F4]">Motivo:</strong> {item.rationale}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => decidir('errado')}
          disabled={ocupado}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#6E6A61] disabled:opacity-40 dark:border-white/15 dark:text-[#A8A49C]"
        >
          Rejeitar
        </button>
        <button
          type="button"
          onClick={() => decidir('certo')}
          disabled={ocupado}
          className="rounded-full bg-[#2F4A3C] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
        >
          Aprovar
        </button>
      </div>
    </li>
  );
}
