'use client';

import { useActionState, useState } from 'react';
import { Upload, FileCheck2, AlertCircle, Loader2 } from 'lucide-react';
import { subirExtratoAction, type EstadoUpload } from './extrato-actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Upload do extrato bancário.
 *
 * ── A decisão de interface que importa aqui ─────────────────────────────
 *
 * O resultado é mostrado SEPARADO por como cada movimento foi resolvido:
 * o que casou com uma conta já lançada, o que o histórico reconheceu, o que
 * a IA identificou, e o que ninguém soube dizer.
 *
 * Um número só ("47 movimentos processados") esconderia justamente o que
 * decide se o mês fecha. E ver que a maior parte veio do histórico, não da
 * IA, é o que mostra ao contador que o sistema está aprendendo com ele.
 */
export function SubirExtrato({ contas, meses }: { contas: { id: string; nome: string }[]; meses: number }) {
  const [estado, acao, pendente] = useActionState<EstadoUpload, FormData>(
    subirExtratoAction,
    { ok: false, mensagem: '' },
  );
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  if (contas.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-300">
        Cadastre uma conta bancária antes de importar o extrato — é nela que os
        movimentos vão ser registrados.
      </div>
    );
  }

  const d = estado.detalhe;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
      <h3 className="text-sm font-bold text-ink">Importar extrato</h3>
      <p className="mt-1 text-xs text-ink-soft">
        Baixe o extrato do seu banco em <strong>OFX</strong> e solte aqui. CSV também
        funciona. Subir o mesmo arquivo duas vezes não duplica nada.
      </p>

      <form action={acao} className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            name="bankAccountId"
            required
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-ink"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2 text-sm text-ink-soft hover:border-black/30 dark:border-white/15 dark:hover:border-white/30">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{nomeArquivo ?? 'Escolher arquivo (.ofx, .csv)'}</span>
            <input
              type="file"
              name="arquivo"
              accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
              required
              className="hidden"
              onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          <button
            type="submit"
            disabled={pendente}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime disabled:opacity-50"
          >
            {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
            {pendente ? 'Lendo…' : 'Importar'}
          </button>
        </div>
      </form>

      {estado.mensagem && !estado.ok && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {estado.mensagem}
        </p>
      )}

      {estado.ok && d && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-bold text-ink">
            {estado.mensagem}
            {d.periodo && <span className="ml-1 font-normal text-ink-soft">· {d.periodo}</span>}
          </p>

          <ul className="space-y-1.5 text-xs">
            <Linha n={d.casadas} rotulo="já estavam lançadas no Hub — foram baixadas" />
            <Linha n={d.identificadasPorHistorico} rotulo="reconhecidas pelo histórico da empresa" />
            <Linha n={d.identificadasPorIA} rotulo="identificadas pela IA" />
            <Linha n={d.paraRevisao} rotulo="esperando sua conferência" tom="atencao" />
            <Linha n={d.repetidas} rotulo="já tinham sido importadas antes" />
            <Linha n={d.foraDaJanela} rotulo={`anteriores aos últimos ${meses} meses — não importadas`} />
          </ul>

          {d.semIdentificacao > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <strong>{d.semIdentificacao} movimento(s)</strong> ainda sem identificação,
              somando {BRL.format(Math.abs(d.transitoria))}. O mês não fecha enquanto
              eles não forem resolvidos — o dinheiro passou pela conta e o balanço
              precisa dizer do que se trata.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ n, rotulo, tom }: { n: number; rotulo: string; tom?: 'atencao' }) {
  if (!n) return null;
  return (
    <li className="flex items-baseline gap-2">
      <span
        className={`min-w-[2.5rem] text-right font-bold tabular ${
          tom === 'atencao' ? 'text-amber-700 dark:text-amber-400' : 'text-ink'
        }`}
      >
        {n}
      </span>
      <span className="text-ink-soft">{rotulo}</span>
    </li>
  );
}
