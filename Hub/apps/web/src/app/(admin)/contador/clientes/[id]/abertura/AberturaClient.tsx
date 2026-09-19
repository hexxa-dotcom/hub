'use client';

import { useActionState, useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  Upload, FileCheck2, AlertCircle, Loader2, Check, ArrowRight,
  Scale, CircleAlert, Wand2,
} from 'lucide-react';
import {
  lerBalanceteAction, conferirAction, abrirAction, type EstadoLeitura,
} from './actions';
import type { EnsaioAbertura, ContaDoPlano, ResultadoAbertura } from '@hexxa/db';
import type { LinhaDeBalancete } from '@hexxa/core';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Saldos de abertura, em três passos visíveis: ler, conferir, abrir.
 *
 * ── Por que a conferência ocupa a tela inteira ──────────────────────────
 *
 * Porque é onde está o erro que ninguém pega depois. Uma abertura com duas
 * contas trocadas FECHA — débito e crédito continuam iguais — e por isso
 * nenhuma validação automática a recusa. Só um par de olhos sobre a lista
 * resolve, e a lista precisa estar legível o bastante para isso valer.
 *
 * Daí a linha mostrar as duas pontas lado a lado: o que o balancete dizia e
 * em que conta do Hub aquilo vai cair. Conferir um de-para olhando só o
 * destino é conferir metade.
 */
export function AberturaClient({
  companyId,
  razaoSocial,
  contas,
  jaAberta,
}: {
  companyId: string;
  razaoSocial: string;
  contas: ContaDoPlano[];
  jaAberta: string | null;
}) {
  const [leitura, ler, lendo] = useActionState<EstadoLeitura, FormData>(
    lerBalanceteAction,
    { ok: false, mensagem: '' },
  );

  const [dePara, setDePara] = useState<Record<string, string>>({});
  const [ensaio, setEnsaio] = useState<EnsaioAbertura | null>(null);
  const [data, setData] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<ResultadoAbertura | null>(null);
  const [conferindo, conferir] = useTransition();
  const [gravando, gravar] = useTransition();
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  const linhas = leitura.linhas ?? [];
  const atual = ensaio ?? leitura.ensaio ?? null;

  // A data sugerida vem do cabeçalho do balancete, mas quem confirma é o
  // contador: abrir no período errado joga os saldos no lugar errado, e o
  // primeiro balanço sai torto sem que nada acuse.
  const dataEfetiva = data || leitura.dataFinal || '';

  function escolher(chave: string, codigo: string) {
    const novo = { ...dePara };
    if (codigo) novo[chave] = codigo;
    else delete novo[chave];
    setDePara(novo);

    conferir(async () => {
      const r = await conferirAction(companyId, linhas, novo);
      if (r.ok && r.ensaio) setEnsaio(r.ensaio);
      else setErro(r.erro ?? null);
    });
  }

  /**
   * Preenche todas as pendentes com a primeira sugestão.
   *
   * É um atalho de digitação, não uma decisão automática: as escolhas
   * aparecem na lista exatamente como se tivessem sido feitas a mão, e o
   * passo 3 continua exigindo o olho do contador. A diferença entre isto e
   * abrir sozinho é que aqui o erro fica visível antes de virar lançamento.
   */
  function aceitarSugestoes() {
    if (!atual) return;
    const novo = { ...dePara };
    for (const l of atual.linhas) {
      if (l.situacao !== 'SEM_CONTA' || !l.sugestoes.length) continue;
      novo[l.conta || `#${l.descricao}`] = l.sugestoes[0]!.code;
    }
    setDePara(novo);
    conferir(async () => {
      const r = await conferirAction(companyId, linhas, novo);
      if (r.ok && r.ensaio) setEnsaio(r.ensaio);
      else setErro(r.erro ?? null);
    });
  }

  function abrir() {
    setErro(null);
    gravar(async () => {
      const r = await abrirAction(companyId, dataEfetiva, linhas, dePara, leitura.origem ?? 'balancete');
      if (r.ok && r.resultado) setFeito(r.resultado);
      else setErro(r.erro ?? 'Não consegui abrir os saldos.');
    });
  }

  if (feito) return <Concluido companyId={companyId} r={feito} />;

  if (jaAberta) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-900 dark:text-amber-300">
        <p className="font-bold">Esta empresa já tem saldos de abertura, lançados em {jaAberta}.</p>
        <p className="mt-2 text-xs leading-relaxed">
          Uma empresa abre uma vez. Para corrigir a abertura existente, estorne-a no
          razão — abrir por cima somaria os saldos aos que já estão lá, e o balanço
          continuaria fechando, agora com o dobro de tudo.
        </p>
        <Link
          href={`/contador/clientes/${companyId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline"
        >
          Voltar para a ficha <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Ler ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <Passo n={1} titulo="O balancete do escritório anterior" feito={leitura.ok} />
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          Aceito PDF gerado pelo sistema contábil, CSV, ou as linhas coladas direto
          de uma planilha. O que preciso de cada linha é a conta, a descrição e o{' '}
          <strong>saldo final</strong> — não o saldo anterior nem o movimento do período.
        </p>

        <form action={ler} className="mt-4 space-y-3">
          <input type="hidden" name="companyId" value={companyId} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2 text-sm text-[#6E6A61] hover:border-black/30 dark:border-white/15 dark:text-[#A8A49C] dark:hover:border-white/30">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{nomeArquivo ?? 'Escolher arquivo (.pdf, .csv, .txt)'}</span>
              <input
                type="file"
                name="arquivo"
                accept=".pdf,.csv,.txt,.tsv,text/csv,application/pdf"
                className="hidden"
                onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
              />
            </label>

            <button
              type="submit"
              disabled={lendo}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] disabled:opacity-50 dark:bg-[#DFFFAE] dark:text-[#231F20]"
            >
              {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
              {lendo ? 'Lendo…' : 'Ler balancete'}
            </button>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-[#6E6A61] dark:text-[#A8A49C]">
              Ou colar as linhas da planilha
            </summary>
            <textarea
              name="colado"
              rows={6}
              placeholder={'1.1.01.001\tCaixa Geral\t2.000,00\tD\n2.1.01.001\tFornecedores\t4.200,00\tC'}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
            />
          </details>
        </form>

        {leitura.mensagem && !leitura.ok && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {leitura.mensagem}
          </p>
        )}

        {leitura.ok && (
          <div className="mt-3 space-y-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <p className="font-bold text-[#231F20] dark:text-[#F5F6F4]">{leitura.mensagem}</p>
            {leitura.descartadas ? (
              <p>{leitura.descartadas} linha(s) descartadas por serem cabeçalho ou total.</p>
            ) : null}
            {leitura.ladoExplicito === false && (
              <p className="text-amber-700 dark:text-amber-400">
                O balancete não marca débito/crédito por linha. Vou deduzir o lado pela
                natureza de cada conta — confira as invertidas com atenção extra.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Conferir ────────────────────────────────────────────────── */}
      {atual && linhas.length > 0 && (
        <section className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
          <div className="border-b border-black/5 px-5 py-4 dark:border-white/10">
            <Passo n={2} titulo="Conferir, conta por conta" feito={atual.pendentes === 0 && atual.fecha} />
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
              O plano do escritório anterior é outro plano — quase nenhuma conta bate por
              código. Para cada linha, escolha onde ela entra aqui. Uma abertura com contas
              trocadas fecha do mesmo jeito, então esta lista é a única chance de ver.
            </p>

            {atual.linhas.some((l) => l.situacao === 'SEM_CONTA' && l.sugestoes.length > 0) && (
              <button
                type="button"
                onClick={aceitarSugestoes}
                disabled={conferindo}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold text-[#231F20] hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-[#F5F6F4] dark:hover:bg-white/10"
              >
                {conferindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Preencher com as sugestões
              </button>
            )}
          </div>

          <Placar ensaio={atual} ocupado={conferindo} />

          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {atual.linhas
              .filter((l) => l.situacao !== 'ZERADA')
              .map((l) => (
                <LinhaDoBalancete
                  key={`${l.linha}-${l.conta}`}
                  l={l}
                  contas={contas}
                  valor={dePara[l.conta || `#${l.descricao}`] ?? (l.por === 'CODIGO' ? l.contaHub! : '')}
                  onEscolher={(codigo) => escolher(l.conta || `#${l.descricao}`, codigo)}
                />
              ))}
          </ul>

          {atual.linhas.some((l) => l.situacao === 'ZERADA') && (
            <p className="border-t border-black/5 px-5 py-3 text-xs text-[#6E6A61] dark:border-white/10 dark:text-[#A8A49C]">
              {atual.linhas.filter((l) => l.situacao === 'ZERADA').length} conta(s) com saldo
              zero não aparecem: não viram lançamento, e não são problema.
            </p>
          )}
        </section>
      )}

      {/* ── 3. Abrir ───────────────────────────────────────────────────── */}
      {atual && linhas.length > 0 && (
        <section className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
          <Passo n={3} titulo="Abrir os saldos" feito={false} />
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
            Isto grava uma partida datada no último dia do período que veio pronto. Daí em
            diante o Hub escritura normalmente, e o balanço de {razaoSocial} já nasce com o
            passado da empresa dentro dele.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="block font-bold text-[#231F20] dark:text-[#F5F6F4]">
                Encerramento do balancete
              </span>
              <input
                type="date"
                value={dataEfetiva}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
              />
            </label>

            <button
              type="button"
              onClick={abrir}
              disabled={gravando || conferindo || atual.pendentes > 0 || !atual.fecha || !dataEfetiva}
              className="inline-flex items-center gap-2 rounded-full bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
            >
              {gravando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
              {gravando ? 'Abrindo…' : 'Abrir saldos'}
            </button>
          </div>

          {leitura.dataFinal && !data && (
            <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Data sugerida pelo cabeçalho do arquivo — confirme antes de abrir.
            </p>
          )}

          {(atual.pendentes > 0 || !atual.fecha) && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              {atual.pendentes > 0
                ? `Faltam ${atual.pendentes} conta(s) sem destino escolhido.`
                : 'O balancete ainda não fecha — veja a diferença acima.'}
            </p>
          )}

          {erro && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {erro}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Peças ──────────────────────────────────────────────────────────────── */

function Passo({ n, titulo, feito }: { n: number; titulo: string; feito: boolean }) {
  return (
    <h2 className="flex items-center gap-2.5 text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
          feito
            ? 'bg-emerald-600 text-white'
            : 'bg-black/10 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
        }`}
      >
        {feito ? <Check className="h-3 w-3" /> : n}
      </span>
      {titulo}
    </h2>
  );
}

/**
 * O placar de débito contra crédito.
 *
 * Fica fixo no topo da lista porque é o número que muda a cada escolha, e
 * vê-lo caminhar para zero é o que diz ao contador que ele está acertando.
 */
function Placar({ ensaio, ocupado }: { ensaio: EnsaioAbertura; ocupado: boolean }) {
  return (
    <div className="sticky top-0 z-10 space-y-2 border-b border-black/5 bg-white/90 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-[#1A1A18]/90">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs">
        <span className="text-[#6E6A61] dark:text-[#A8A49C]">
          Débito <strong className="tabular text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(ensaio.totalDebito)}</strong>
        </span>
        <span className="text-[#6E6A61] dark:text-[#A8A49C]">
          Crédito <strong className="tabular text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(ensaio.totalCredito)}</strong>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-bold tabular ${
            ensaio.fecha ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ensaio.fecha ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
          {ensaio.fecha ? 'Fecha' : `Diferença ${BRL.format(Math.abs(ensaio.diferenca))}`}
        </span>
        {ensaio.pendentes > 0 && (
          <span className="text-amber-700 dark:text-amber-400">
            {ensaio.pendentes} sem destino
          </span>
        )}
      </div>

      {ensaio.avisos.map((a) => (
        <p key={a} className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">⚠ {a}</p>
      ))}
    </div>
  );
}

type Conferida = EnsaioAbertura['linhas'][number];

function LinhaDoBalancete({
  l, contas, valor, onEscolher,
}: {
  l: Conferida;
  contas: ContaDoPlano[];
  valor: string;
  onEscolher: (codigo: string) => void;
}) {
  /**
   * As sugestões vêm primeiro na lista, e o resto do plano depois.
   *
   * Um `<select>` com cem contas em ordem de código obriga a procurar; com as
   * três prováveis no topo, a maior parte das linhas se resolve sem rolar.
   */
  const opcoes = useMemo(() => {
    const sugeridas = l.sugestoes.map((s) => s.code);
    const resto = contas.filter((c) => !sugeridas.includes(c.code));
    return { sugeridas: l.sugestoes, resto };
  }, [l.sugestoes, contas]);

  const pendente = l.situacao === 'SEM_CONTA';

  return (
    <li className={`px-5 py-3 ${pendente ? 'bg-amber-500/[0.06]' : ''}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {/* O que o balancete dizia */}
        <div className="min-w-0 sm:w-[38%]">
          <p className="truncate text-sm text-[#231F20] dark:text-[#F5F6F4]">
            {l.descricao || <em className="text-[#6E6A61] dark:text-[#A8A49C]">sem descrição</em>}
          </p>
          <p className="text-xs tabular text-[#6E6A61] dark:text-[#A8A49C]">
            {l.conta && <span className="mr-2">{l.conta}</span>}
            {BRL.format(Math.abs(l.valor))}
            {l.lado && <span className="ml-1 font-bold">{l.lado}</span>}
          </p>
        </div>

        <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-[#6E6A61] sm:block dark:text-[#A8A49C]" />

        {/* Onde entra aqui */}
        <div className="min-w-0 flex-1">
          <select
            value={valor}
            onChange={(e) => onEscolher(e.target.value)}
            className={`w-full rounded-xl border px-3 py-2 text-xs dark:bg-[#231F20] dark:text-[#F5F6F4] ${
              pendente
                ? 'border-amber-500/50 text-amber-800 dark:text-amber-300'
                : 'border-black/10 text-[#231F20] dark:border-white/10'
            }`}
          >
            <option value="">— escolher conta no plano do Hub —</option>
            {opcoes.sugeridas.length > 0 && (
              <optgroup label="Sugestões pela descrição">
                {opcoes.sugeridas.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Plano completo">
              {opcoes.resto.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
              ))}
            </optgroup>
          </select>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
            {l.por === 'CODIGO' && <span>código idêntico ao do Hub</span>}
            {l.por === 'DE_PARA' && <span className="text-emerald-700 dark:text-emerald-400">você escolheu</span>}
            {l.ladoFinal && (
              <span className="tabular">
                entra a {l.ladoFinal === 'DEBIT' ? 'débito' : 'crédito'}
              </span>
            )}
            {l.invertida && (
              <span className="font-bold text-amber-700 dark:text-amber-400">
                saldo invertido — confira
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Concluido({ companyId, r }: { companyId: string; r: ResultadoAbertura }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-900 dark:text-emerald-300">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Check className="h-4 w-4" /> Saldos de abertura lançados.
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        <li>{r.linhas} conta(s) com saldo</li>
        <li className="tabular">Débito {BRL.format(r.debito)} · Crédito {BRL.format(r.credito)}</li>
        <li>
          {r.balancoFecha
            ? 'Ativo = Passivo + Patrimônio Líquido. O balanço fecha.'
            : `Atenção: o balanço ficou com diferença de ${BRL.format(Math.abs(r.diferenca))}.`}
        </li>
      </ul>
      <Link
        href={`/contador/clientes/${companyId}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-[#231F20] dark:bg-white/10 dark:text-[#F5F6F4]"
      >
        Voltar para a ficha <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
