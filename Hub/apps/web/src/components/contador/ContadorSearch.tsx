'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Buildings, Spinner } from '@phosphor-icons/react';

type Result = { id: string; legalName: string; tradeName: string | null; cnpj: string };

export function ContadorSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contador/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function selecionar(id: string) {
    setOpen(false);
    setQuery('');
    router.push(`/contador/clientes/${id}` as never);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800">
        {loading ? <Spinner className="h-4 w-4 animate-spin" /> : <MagnifyingGlass className="h-4 w-4" />}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente por nome ou CNPJ…"
          className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
        />
      </label>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-11 z-40 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">{loading ? 'Buscando…' : 'Nenhuma empresa encontrada.'}</p>
          ) : (
            results.map((r) => (
              <button key={r.id} type="button" onClick={() => selecionar(r.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 last:border-0 dark:border-slate-800 transition-colors">
                <Buildings className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.tradeName || r.legalName}</p>
                  <p className="truncate text-xs text-slate-400">{r.cnpj}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
