'use client';

import { useActionState, useState } from 'react';
import { Upload, FileCheck2, AlertCircle, Loader2 } from 'lucide-react';
import { subirExtratoAction, criarContaAction, type EstadoUpload } from './extrato-actions';

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
export function SubirExtrato({ contas, desde }: { contas: { id: string; nome: string }[]; desde: string }) {
  const [estado, acao, pendente] = useActionState<EstadoUpload, FormData>(
    subirExtratoAction,
    { ok: false, mensagem: '' },
  );
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  // Sem conta cadastrada não é mais um beco sem saída: o OFX diz de que
  // conta é, e ela nasce na importação. Só o CSV precisa do cadastro manual.
  const [novaConta, setNovaConta] = useState(false);
  const [banco, setBanco] = useState('');
  const [numero, setNumero] = useState('');
  const [erroConta, setErroConta] = useState<string | null>(null);
  const [salvandoConta, setSalvandoConta] = useState(false);

  async function cadastrar() {
    setErroConta(null);
    setSalvandoConta(true);
    const r = await criarContaAction(banco, numero);
    setSalvandoConta(false);
    if (r.ok) { setNovaConta(false); setBanco(''); setNumero(''); }
    else setErroConta(r.erro ?? 'Não consegui cadastrar a conta.');
  }

  const d = estado.detalhe;

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card p-6 shadow-(--elev-1) card-finish flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime text-xs shadow-xs">
              <Upload className="h-4 w-4" />
            </span>
            <h3 className="font-serif font-bold text-base sm:text-lg text-ink">Importar Extrato</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-surface border border-black/5 dark:border-white/5 text-ink-soft shadow-(--elev-inset)">
            OFX · CSV
          </span>
        </div>

        <p className="text-xs text-ink-soft leading-relaxed">
          Baixe o extrato do seu banco em <strong>OFX</strong> e solte aqui — a conta bancária é reconhecida automaticamente pelo próprio arquivo. Arquivos CSV também funcionam.
        </p>

        <form action={acao} className="mt-4 space-y-2.5">
          <select
            name="bankAccountId"
            defaultValue=""
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface shadow-(--elev-inset) px-3.5 py-2 text-xs text-ink outline-none"
          >
            <option value="">Reconhecer conta pelo arquivo (OFX automático)</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="flex flex-1 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2 text-xs text-ink-soft hover:border-black/30 dark:border-white/15 dark:hover:border-white/30 truncate">
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
              className="inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
              {pendente ? 'Lendo…' : 'Importar'}
            </button>
          </div>
        </form>

      {!novaConta ? (
        <button
          type="button"
          onClick={() => setNovaConta(true)}
          className="mt-2 text-xs font-bold text-ink-soft underline-offset-2 hover:underline"
        >
          Extrato em CSV? Cadastre a conta primeiro
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-black/[0.03] p-3 sm:flex-row sm:items-end dark:bg-white/[0.04]">
          <label className="flex-1 text-xs">
            <span className="font-bold text-ink">Banco</span>
            <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Nubank"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-ink" />
          </label>
          <label className="flex-1 text-xs">
            <span className="font-bold text-ink">Conta</span>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="12345678-9"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-ink" />
          </label>
          <button type="button" onClick={cadastrar} disabled={salvandoConta}
            className="rounded-full bg-hexxa-forest px-4 py-2 text-xs font-bold text-hexxa-lime disabled:opacity-50">
            {salvandoConta ? 'Salvando…' : 'Cadastrar conta'}
          </button>
        </div>
      )}
      {erroConta && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{erroConta}</p>}

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
            <Linha n={d.foraDaJanela} rotulo={`anteriores a ${desde.split('-').reverse().join('/')} (fora do ano corrente) — não importadas`} />
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
