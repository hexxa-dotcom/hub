'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Spinner, UploadSimple, Warning } from '@phosphor-icons/react';
import {
  salvarPontoDePartida,
  lerPgdasEnviado,
  type EstadoDoPontoDePartida,
  type EstadoDaLeituraPgdas,
} from './actions';

const inicial: EstadoDoPontoDePartida = { ok: true, message: '' };
const inicialPgdas: EstadoDaLeituraPgdas = { ok: true, message: '', faturamento: null };

/**
 * Passo 3: de onde a Hexx começa a contar.
 *
 * Dois campos, e os dois explicam o que destravam. Um formulário de abertura
 * contábil pediria plano de contas e balancete; quem acabou de assinar
 * abandonaria ali. Ver `salvarPontoDePartida` para o porquê de cada escolha.
 */
export function PontoDePartidaForm({
  hoje,
  saldoAtual,
  faturamentoAtual,
}: {
  hoje: string;
  saldoAtual: number | null;
  faturamentoAtual: number | null;
}) {
  const [estado, action, pendente] = useActionState(salvarPontoDePartida, inicial);
  const [pgdas, pgdasAction, lendo] = useActionState(lerPgdasEnviado, inicialPgdas);

  // Controlado porque a leitura do extrato chega DEPOIS da primeira
  // renderização — `defaultValue` ignoraria o valor lido.
  const [faturamento, setFaturamento] = useState(
    faturamentoAtual === null ? '' : String(faturamentoAtual),
  );
  useEffect(() => {
    if (pgdas.faturamento !== null) setFaturamento(String(pgdas.faturamento));
  }, [pgdas]);

  const campo =
    'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm tabular';

  if (estado.ok && estado.message) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-black" weight="fill" />
        <h2 className="text-xl font-bold text-black">
          {estado.message}
        </h2>
        <p className="mt-2 text-sm text-black/60">
          Já dá para emitir nota, acompanhar o imposto e ver quanto do dinheiro é seu.
        </p>
        <Link
          href="/cliente"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white"
        >
          Ver meu Hub <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Formulário próprio para a leitura — <form> não aninha, e ler o
          extrato não pode submeter (nem validar) o passo inteiro. */}
      <form id="ler-pgdas" action={pgdasAction} className="hidden" />

    <form
      action={action}
      className="rounded-2xl border border-black/10 bg-white p-6 sm:p-8"
    >
      <h2 className="text-xl font-bold text-black">
        De onde você está partindo
      </h2>
      <p className="mt-1 text-sm text-black/60">
        Dois números que você sabe de cabeça. Não precisa de balancete nem de contador agora.
      </p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-bold text-black">
            Quanto há hoje na conta da empresa?
          </span>
          <p className="mb-1.5 mt-0.5 text-xs text-black/60">
            Some as contas da empresa. É daqui que sai o &ldquo;livre para retirar&rdquo;. Pode ser
            zero.
          </p>
          <input
            name="saldo"
            inputMode="decimal"
            required
            defaultValue={saldoAtual ?? ''}
            placeholder="0,00"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-black">
            Quanto a empresa faturou nos últimos 12 meses?
          </span>
          <p className="mb-1.5 mt-0.5 text-xs text-black/60">
            É o que define sua faixa no Simples e o aviso de teto. Se abriu agora, coloque o que já
            faturou.
          </p>
          <input
            name="faturamento"
            inputMode="decimal"
            required
            value={faturamento}
            onChange={(e) => setFaturamento(e.target.value)}
            placeholder="0,00"
            className={campo}
          />

        </label>

        <div className="mt-3 rounded-2xl border border-dashed border-black/15 p-3">
            <p className="text-xs font-bold text-black">
              Tem o extrato do Simples?
            </p>
            <p className="mt-0.5 text-xs text-black/60">
              Envie o PDF do PGDAS e eu leio o valor exato que a Receita calculou.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="file"
                name="pgdas"
                accept=".pdf,application/pdf"
                form="ler-pgdas"
                className="text-xs text-black/60 file:mr-2 file:rounded-full file:border-0 file:border file:border-black/15 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
              />
              <button
                type="submit"
                form="ler-pgdas"
                disabled={lendo}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
              >
                {lendo ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <UploadSimple className="h-3.5 w-3.5" />}
                Ler extrato
              </button>
            </div>
            {pgdas.message && (
              <p
                className={`mt-2 text-xs ${
                  pgdas.ok ? 'text-black' : 'text-black'
                }`}
              >
                {pgdas.message}
              </p>
            )}
          </div>

        <label className="block">
          <span className="text-sm font-bold text-black">
            Data desse saldo
          </span>
          <input type="date" name="data" required defaultValue={hoje} className={`${campo} mt-1.5`} />
        </label>
      </div>

      {!estado.ok && estado.message && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-black">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {estado.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pendente ? <Spinner className="h-4 w-4 animate-spin" /> : null}
        Concluir
      </button>

      <p className="mt-3 text-center text-xs text-black/60">
        Dá para corrigir depois — e quando chegar seu extrato ou balancete, o contador ajusta.
      </p>
    </form>
    </>
  );
}
