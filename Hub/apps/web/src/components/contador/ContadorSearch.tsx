'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, Loader2 } from 'lucide-react';

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
    <div ref={boxRef} className="relative w-64 sm:w-80 md:w-96">
      <label className="flex w-full items-center gap-2.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-sm text-[#6E6A61] dark:text-[#A8A49C] shadow-sm focus-within:shadow-md focus-within:border-[#2F4A3C] dark:focus-within:border-[#DFFFAE] transition-all">
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#2F4A3C]" /> : <Search className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          placeholder="Buscar cliente por nome ou CNPJ…"
          className="w-full bg-transparent text-[#231F20] dark:text-[#FEFDF3] outline-none placeholder:text-[#6E6A61] dark:placeholder:text-[#A8A49C] text-xs sm:text-sm"
        />
      </label>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[320px] rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] shadow-2xl overflow-hidden">
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">{loading ? 'Buscando empresas…' : 'Nenhuma empresa encontrada.'}</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selecionar(r.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left hover:bg-[#F4EFE4] dark:hover:bg-white/5 transition-colors"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#231F20] dark:text-[#FEFDF3]">{r.tradeName || r.legalName}</p>
                    <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{r.cnpj}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-black/5 dark:border-white/5 bg-[#F4EFE4]/50 dark:bg-white/5 px-4 py-2 text-[11px] text-[#6E6A61] dark:text-[#A8A49C] text-center">
            Resultados de clientes da base
          </div>
        </div>
      )}
    </div>
  );
}
