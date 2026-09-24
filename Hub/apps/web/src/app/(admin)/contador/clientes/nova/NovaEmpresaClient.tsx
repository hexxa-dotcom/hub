'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Check, Building2, AlertCircle, RefreshCw } from 'lucide-react';
import { listarEmpresasAction, cadastrarAction } from './actions';
import type { EmpresaDisponivel, ResultadoCadastro } from '@hexxa/db';

/**
 * Cadastro de cliente: escolher, não digitar.
 *
 * ── A decisão de desenho ────────────────────────────────────────────────
 *
 * Não há formulário. Razão social, endereço, inscrição municipal e quadro
 * societário já existem conferidos no OneFlow — pedir que alguém os digite de
 * novo só cria uma segunda versão da verdade, com erros próprios. Foi assim
 * que a primeira empresa entrou com o nome fantasia no lugar da razão social.
 *
 * O contador escolhe a empresa numa lista e o resto se preenche. O que sobra
 * para depois é o que o OneFlow não tem: os saldos de abertura, que vêm do
 * balancete da contabilidade anterior.
 */
export function NovaEmpresaClient() {
  const [empresas, setEmpresas] = useState<EmpresaDisponivel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feitas, setFeitas] = useState<Record<string, ResultadoCadastro>>({});
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  function carregar() {
    iniciar(async () => {
      const r = await listarEmpresasAction();
      if (r.ok) { setEmpresas(r.empresas); setErro(null); }
      else setErro(r.erro ?? 'Não consegui falar com o OneFlow.');
    });
  }

  useEffect(carregar, []);

  async function cadastrar(e: EmpresaDisponivel) {
    setOcupada(e.appHash);
    const r = await cadastrarAction(e.appHash, e.cnpj);
    setOcupada(null);
    if (r.ok && r.resultado) {
      setFeitas((f) => ({ ...f, [e.appHash]: r.resultado! }));
      setEmpresas((lista) =>
        lista ? lista.map((x) => (x.appHash === e.appHash ? { ...x, jaCadastrada: true } : x)) : null,
      );
    } else {
      setErro(r.erro ?? 'Falha no cadastro.');
    }
  }

  const pendentes = empresas?.filter((e) => !e.jaCadastrada) ?? [];
  const cadastradas = empresas?.filter((e) => e.jaCadastrada) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
              Trazer cliente do OneFlow
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Razão social, endereço, inscrição municipal e quadro societário já estão
              cadastrados lá. Escolha a empresa e tudo vem junto — nada para digitar,
              nada para o cliente preencher.
            </p>
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] hover:text-[#231F20] disabled:opacity-50 dark:border-white/15 dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {erro}
        </p>
      )}

      {carregando && !empresas && (
        <p className="flex items-center gap-2 px-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando as empresas do escritório…
        </p>
      )}

      {pendentes.length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
          <div className="border-b border-black/5 px-5 py-3.5 dark:border-white/10">
            <h3 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
              Ainda não estão na Hexx ({pendentes.length})
            </h3>
          </div>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {pendentes.map((e) => (
              <li key={e.appHash} className="flex items-center gap-4 px-5 py-3.5">
                <Building2 className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
                    {e.razaoSocial}
                  </p>
                  <p className="text-xs tabular text-[#6E6A61] dark:text-[#A8A49C]">{e.cnpj}</p>
                </div>
                <button
                  type="button"
                  onClick={() => cadastrar(e)}
                  disabled={ocupada !== null}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
                >
                  {ocupada === e.appHash ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Trazendo…</>
                  ) : (
                    'Trazer para a Hexx'
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.entries(feitas).length > 0 && (
        <div className="space-y-2">
          {Object.entries(feitas).map(([hash, r]) => (
            <div
              key={hash}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-xs text-emerald-900 dark:text-emerald-300"
            >
              <p className="text-sm font-bold">
                <Check className="mr-1 inline h-4 w-4" />
                {r.razaoSocial}
              </p>
              <ul className="mt-2 space-y-0.5">
                <li>{r.socios} sócio(s) trazido(s) do quadro societário</li>
                <li>{r.contasDoPlano} contas criadas no plano (ITG 1000, Anexo 7)</li>
                <li>Módulos ativos no OneFlow: {r.modulos.join(', ') || 'nenhum'}</li>
              </ul>
              {r.avisos.map((a) => (
                <p key={a} className="mt-1.5 text-amber-800 dark:text-amber-300">⚠ {a}</p>
              ))}
              <p className="mt-2.5 opacity-80">
                Falta o que o OneFlow não tem: os saldos de abertura, do balancete da
                contabilidade anterior.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/contador/clientes/${r.companyId}/abertura`}
                  className="rounded-full bg-[#2F4A3C] px-3 py-1 font-bold text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]"
                >
                  Lançar saldos de abertura
                </Link>
                <Link
                  href={`/contador/clientes/${r.companyId}/acessos`}
                  className="rounded-full bg-white/70 px-3 py-1 font-bold text-[#231F20] dark:bg-white/10 dark:text-[#F5F6F4]"
                >
                  Dar acesso ao cliente
                </Link>
                <Link
                  href={`/contador/clientes/${r.companyId}/operacao`}
                  className="rounded-full bg-white/70 px-3 py-1 font-bold text-[#231F20] dark:bg-white/10 dark:text-[#F5F6F4]"
                >
                  Configurar operação
                </Link>
                <Link
                  href={`/contador/clientes/${r.companyId}`}
                  className="rounded-full bg-white/70 px-3 py-1 font-bold text-[#231F20] dark:bg-white/10 dark:text-[#F5F6F4]"
                >
                  Abrir ficha
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {cadastradas.length > 0 && (
        <details className="rounded-2xl border border-black/5 bg-white px-5 py-3.5 dark:border-white/10 dark:bg-[#1A1A18]">
          <summary className="cursor-pointer text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">
            Já na Hexx ({cadastradas.length})
          </summary>
          <ul className="mt-3 space-y-1.5">
            {cadastradas.map((e) => (
              <li key={e.appHash} className="flex items-center gap-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="truncate">{e.razaoSocial}</span>
                <span className="tabular opacity-70">{e.cnpj}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {empresas && pendentes.length === 0 && (
        <p className="px-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          Todas as empresas do escritório já estão na Hexx.
        </p>
      )}
    </div>
  );
}
