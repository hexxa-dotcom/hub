'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Spinner, Warning } from '@phosphor-icons/react';
import { salvarPontoDePartida, type EstadoDoPontoDePartida } from './actions';

const inicial: EstadoDoPontoDePartida = { ok: true, message: '' };

/**
 * Passo 3: de onde o Hub começa a contar.
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

  const campo =
    'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm tabular dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]';

  if (estado.ok && estado.message) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white p-8 text-center dark:border-white/10 dark:bg-[#231F20]">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" weight="fill" />
        <h2 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
          {estado.message}
        </h2>
        <p className="mt-2 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          Já dá para emitir nota, acompanhar o imposto e ver quanto do dinheiro é seu.
        </p>
        <Link
          href="/cliente"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-2.5 text-sm font-bold text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]"
        >
          Ver meu Hub <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-3xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#231F20] sm:p-8"
    >
      <h2 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
        De onde você está partindo
      </h2>
      <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
        Dois números que você sabe de cabeça. Não precisa de balancete nem de contador agora.
      </p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Quanto há hoje na conta da empresa?
          </span>
          <p className="mb-1.5 mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
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
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Quanto a empresa faturou nos últimos 12 meses?
          </span>
          <p className="mb-1.5 mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            É o que define sua faixa no Simples e o aviso de teto. Se abriu agora, coloque o que já
            faturou.
          </p>
          <input
            name="faturamento"
            inputMode="decimal"
            required
            defaultValue={faturamentoAtual ?? ''}
            placeholder="0,00"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Data desse saldo
          </span>
          <input type="date" name="data" required defaultValue={hoje} className={`${campo} mt-1.5`} />
        </label>
      </div>

      {!estado.ok && estado.message && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {estado.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-3 text-sm font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
      >
        {pendente ? <Spinner className="h-4 w-4 animate-spin" /> : null}
        Concluir
      </button>

      <p className="mt-3 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Dá para corrigir depois — e quando chegar seu extrato ou balancete, o contador ajusta.
      </p>
    </form>
  );
}
