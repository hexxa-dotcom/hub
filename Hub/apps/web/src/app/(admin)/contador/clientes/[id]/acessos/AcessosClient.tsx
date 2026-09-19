'use client';

import { useActionState, useState, useTransition } from 'react';
import { UserPlus, Loader2, AlertCircle, Clock, Check, Trash2, Mail } from 'lucide-react';
import { convidarAction, removerAcessoAction, type EstadoConvite } from './actions';
import type { Convidado } from '@hexxa/db';

/**
 * Quem entra nesta empresa.
 *
 * ── A distinção que a tela precisa fazer ────────────────────────────────
 *
 * Convidado e usuário ativo não são o mesmo estado, e confundi-los deixa o
 * contador achando que o cliente já tem acesso quando ele nunca se cadastrou.
 * Por isso "aguardando primeiro acesso" aparece como etiqueta própria, e não
 * como ausência de informação.
 */

const PAPEIS = [
  { valor: 'OWNER', rotulo: 'Dono', ajuda: 'Acesso total, inclusive a sócios e distribuição de lucros.' },
  { valor: 'ADMIN', rotulo: 'Administrador', ajuda: 'Tudo, menos o que é exclusivo do dono.' },
  { valor: 'FINANCE', rotulo: 'Financeiro', ajuda: 'Contas a pagar e receber, notas, conciliação.' },
  { valor: 'STAFF', rotulo: 'Operacional', ajuda: 'Emite nota e registra movimento do dia a dia.' },
  { valor: 'VIEWER', rotulo: 'Só leitura', ajuda: 'Vê relatórios e documentos, não altera nada.' },
];

export function AcessosClient({
  companyId,
  razaoSocial,
  iniciais,
}: {
  companyId: string;
  razaoSocial: string;
  iniciais: Convidado[];
}) {
  const [estado, convidar, convidando] = useActionState<EstadoConvite, FormData>(
    convidarAction,
    { ok: false, mensagem: '' },
  );
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, remover] = useTransition();

  // A server action revalida a rota, mas a lista veio por prop do servidor:
  // refletir o convite aqui evita a janela em que a mensagem diz "criado" e a
  // lista ainda não mostra ninguém.
  const recemConvidado = estado.ok && estado.resultado && !lista.some((c) => c.email === estado.resultado!.email)
    ? {
        userId: estado.resultado.userId,
        email: estado.resultado.email,
        nome: estado.resultado.email.split('@')[0]!,
        papel: '—',
        pendente: !estado.resultado.jaTinhaConta,
        desde: new Date(),
      }
    : null;

  const todos = recemConvidado ? [recemConvidado, ...lista] : lista;

  function tirar(c: Convidado) {
    setErro(null);
    remover(async () => {
      const r = await removerAcessoAction(companyId, c.userId);
      if (r.ok) setLista((l) => l.filter((x) => x.userId !== c.userId));
      else setErro(r.erro ?? null);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Convidar</h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          O convite não manda e-mail: ele deixa o acesso pronto. Quando a pessoa se
          cadastrar no Hub com esse endereço, ela cai direto em {razaoSocial}, sem
          precisar de aprovação sua depois. Avise pelo canal que você já usa com ela.
        </p>

        <form action={convidar} className="mt-4 space-y-3">
          <input type="hidden" name="companyId" value={companyId} />

          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <label className="text-xs">
              <span className="block font-bold text-[#231F20] dark:text-[#F5F6F4]">E-mail</span>
              <input
                type="email"
                name="email"
                required
                placeholder="socio@empresa.com.br"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
              />
            </label>

            <label className="text-xs">
              <span className="block font-bold text-[#231F20] dark:text-[#F5F6F4]">Nome (opcional)</span>
              <input
                type="text"
                name="nome"
                placeholder="como chamá-la"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
              />
            </label>

            <label className="text-xs">
              <span className="block font-bold text-[#231F20] dark:text-[#F5F6F4]">Papel</span>
              <select
                name="papel"
                defaultValue="OWNER"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
              >
                {PAPEIS.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={convidando}
            className="inline-flex items-center gap-2 rounded-full bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] disabled:opacity-50 dark:bg-[#DFFFAE] dark:text-[#231F20]"
          >
            {convidando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            {convidando ? 'Criando…' : 'Dar acesso'}
          </button>
        </form>

        {estado.mensagem && (
          <p
            className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
              estado.ok
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-500/10 text-red-700 dark:text-red-400'
            }`}
          >
            {estado.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            {estado.mensagem}
          </p>
        )}

        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-[#6E6A61] dark:text-[#A8A49C]">
            O que cada papel pode fazer
          </summary>
          <ul className="mt-2 space-y-1.5 text-[#6E6A61] dark:text-[#A8A49C]">
            {PAPEIS.map((p) => (
              <li key={p.valor}>
                <strong className="text-[#231F20] dark:text-[#F5F6F4]">{p.rotulo}</strong> — {p.ajuda}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
        <div className="border-b border-black/5 px-5 py-3.5 dark:border-white/10">
          <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Quem tem acesso ({todos.length})
          </h2>
        </div>

        {erro && (
          <p className="flex items-start gap-2 border-b border-black/5 bg-red-500/10 px-5 py-2.5 text-xs text-red-700 dark:border-white/10 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {erro}
          </p>
        )}

        {todos.length === 0 ? (
          <p className="px-5 py-6 text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
            Ninguém. A empresa é escriturada, recebe guias e fecha o mês, mas o dono
            não tem como ver nada disso enquanto não for convidado.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {todos.map((c) => (
              <li key={c.userId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Mail className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#231F20] dark:text-[#F5F6F4]">{c.email}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    {rotuloDoPapel(c.papel)}
                    {c.pendente && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" /> aguardando o primeiro acesso
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => tirar(c)}
                  disabled={removendo}
                  title="Remover acesso"
                  className="shrink-0 rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-700 disabled:opacity-40 dark:text-[#A8A49C] dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function rotuloDoPapel(papel: string): string {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel;
}
