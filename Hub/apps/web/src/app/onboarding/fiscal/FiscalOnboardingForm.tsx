'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Spinner, Warning } from '@phosphor-icons/react';
import { salvarFiscal, type EstadoFiscal } from './actions';

const inicial: EstadoFiscal = { ok: true, message: '' };

export function FiscalOnboardingForm({
  dados,
}: {
  dados: {
    razaoSocial: string | null;
    cnae: string | null;
    optanteSimples: boolean;
    itemListaServico: string;
    aliquotaIss: number | null;
    codigoTributacaoMunicipio: string;
  };
}) {
  const [estado, action, pendente] = useActionState(salvarFiscal, inicial);

  const campo =
    'mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]';

  if (estado.ok && estado.message) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white p-8 text-center dark:border-white/10 dark:bg-[#231F20]">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" weight="fill" />
        <h2 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
          {estado.message}
        </h2>
        <Link
          href="/onboarding/ponto-de-partida"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-2.5 text-sm font-bold text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]"
        >
          Último passo <ArrowRight className="h-4 w-4" />
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
        Sua nota fiscal
      </h2>
      <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
        Já trouxemos da Receita o CNPJ, o município{dados.cnae ? `, o CNAE ${dados.cnae}` : ''} e o
        regime{dados.optanteSimples ? ' (Simples Nacional)' : ''}. Faltam duas coisas que só a
        prefeitura sabe.
      </p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Item da lista de serviços (LC 116)
          </span>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            É o que descreve seu serviço na nota. Ex.: 17.19 para contabilidade, 4.01 para medicina,
            1.07 para suporte de TI. Está na sua nota antiga ou com a prefeitura.
          </p>
          <input
            name="itemListaServico"
            required
            defaultValue={dados.itemListaServico}
            placeholder="17.19"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Alíquota de ISS do seu município
          </span>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Entre 2% e 5%, definida por lei municipal para o seu tipo de serviço.
          </p>
          <input
            name="aliquotaIss"
            inputMode="decimal"
            required
            defaultValue={dados.aliquotaIss ?? ''}
            placeholder="5"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Código de tributação do município{' '}
            <span className="font-normal text-[#6E6A61] dark:text-[#A8A49C]">— se houver</span>
          </span>
          <input
            name="codigoTributacaoMunicipio"
            defaultValue={dados.codigoTributacaoMunicipio}
            className={campo}
          />
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
        Continuar
      </button>

      <p className="mt-3 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        O certificado digital só é preciso na hora de emitir a primeira nota — pedimos lá.
      </p>
    </form>
  );
}
