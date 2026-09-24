'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, LogIn, Plus, Search } from 'lucide-react';
import type { ClienteDoNibo } from '@/lib/server/clientes-do-nibo';
import { habilitarClienteDoNiboAction, entrarNaAreaDoClienteAction } from '../actions';

/**
 * A carteira do Nibo, esperando o contador decidir quem entra na Hexx.
 * Habilitar cria a empresa; quem já foi habilitado mostra o atalho para a
 * área do cliente.
 */
export function ClientesDoNibo({ clientes }: { clientes: ClienteDoNibo[] }) {
  const [lista, setLista] = useState(clientes);
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [, startTransition] = useTransition();

  const filtrados = lista.filter(
    (c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.document.includes(busca.replace(/\D/g, '')),
  );
  const pendentes = lista.filter((c) => !c.companyId).length;

  async function habilitar(c: ClienteDoNibo) {
    setOcupado(c.document);
    setAviso(null);
    const r = await habilitarClienteDoNiboAction(c.document);
    setOcupado(null);
    setAviso({ ok: r.ok, texto: r.message });
    if (r.ok && r.companyId) {
      setLista((l) => l.map((x) => (x.document === c.document ? { ...x, companyId: r.companyId! } : x)));
    }
  }

  const cnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  return (
    <section className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#231F20] dark:text-[#F5F6F4]">Clientes do Nibo</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            {lista.length} empresas na carteira · {pendentes} ainda fora da Hexx. Habilite quem deve entrar.
          </p>
        </div>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6A61]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou CNPJ"
            className="rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-xs dark:border-white/10 dark:bg-white/10"
          />
        </label>
      </div>

      {aviso && (
        <p className={`mt-3 text-xs font-bold ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.texto}</p>
      )}

      <ul className="mt-4 divide-y divide-black/5 dark:divide-white/5">
        {filtrados.map((c) => (
          <li key={c.document} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{c.nome}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">CNPJ {cnpj(c.document)}</p>
            </div>
            {c.companyId ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Na Hexx
                </span>
                <Link
                  href={`/contador/clientes/${c.companyId}` as never}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#231F20] hover:bg-black/5 dark:border-white/10 dark:text-[#F5F6F4]"
                >
                  Detalhe
                </Link>
                <button
                  type="button"
                  onClick={() => startTransition(() => entrarNaAreaDoClienteAction(c.companyId!))}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] px-3 py-1.5 text-xs font-bold text-[#DFFFAE]"
                >
                  <LogIn className="h-3.5 w-3.5" /> Entrar
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => habilitar(c)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#1E3328] px-3 py-1.5 text-xs font-bold text-[#1E3328] hover:bg-[#1E3328] hover:text-[#DFFFAE] disabled:opacity-40 dark:border-[#DFFFAE] dark:text-[#DFFFAE]"
              >
                <Plus className="h-3.5 w-3.5" />
                {ocupado === c.document ? 'Consultando a Receita…' : 'Habilitar na Hexx'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
