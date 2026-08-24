'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, CheckCircle2, Clock, XCircle, FlaskConical } from 'lucide-react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type NotaFiscal = {
  id: string;
  numero: string;
  cliente: string;
  companyId: string;
  tomador: string;
  servico: string;
  valor: number;
  emissao: string;
  status: 'ISSUED' | 'ISSUING' | 'CANCELED' | 'ERROR' | 'DRAFT';
  isMock: boolean;
};

const S_CFG: Record<NotaFiscal['status'], { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ISSUED: { label: 'Emitida', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  ISSUING: { label: 'Processando', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: Clock },
  DRAFT: { label: 'Rascunho', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: Clock },
  CANCELED: { label: 'Cancelada', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: XCircle },
  ERROR: { label: 'Erro', cls: 'bg-red-500/10 text-red-700 dark:text-red-400', icon: XCircle },
};

export function NotasFiscaisTable({ initial }: { initial: NotaFiscal[] }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<NotaFiscal['status'] | 'todas'>('todas');

  const filtered = initial.filter(n => {
    const match = [n.cliente, n.tomador, n.numero, n.servico].some(v => v.toLowerCase().includes(search.toLowerCase()));
    return match && (filterStatus === 'todas' || n.status === filterStatus);
  });

  const totalEmitido = initial.filter(n => n.status === 'ISSUED' && !n.isMock).reduce((s, n) => s + n.valor, 0);
  const erros = initial.filter(n => n.status === 'ERROR').length;
  const pendentes = initial.filter(n => n.status === 'ISSUING' || n.status === 'DRAFT').length;

  const filterTabs = [
    { id: 'todas', label: `Todas (${initial.length})` },
    { id: 'ISSUED', label: `Emitidas (${initial.filter(n => n.status === 'ISSUED').length})` },
    { id: 'ISSUING', label: `Processando (${initial.filter(n => n.status === 'ISSUING').length})` },
    { id: 'ERROR', label: `Com erro (${initial.filter(n => n.status === 'ERROR').length})` },
    { id: 'CANCELED', label: `Canceladas (${initial.filter(n => n.status === 'CANCELED').length})` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Notas Fiscais</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Visão cross-cliente das emissões NFSe (somente leitura — a emissão é feita na tela do próprio cliente)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total emitido (real)', value: BRL.format(totalEmitido), cls: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Notas emitidas', value: String(initial.filter(n => n.status === 'ISSUED').length), cls: 'text-[#231F20] dark:text-[#FEFDF3]' },
          { label: 'Pendentes', value: String(pendentes), cls: pendentes > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[#6E6A61] dark:text-[#A8A49C]' },
          { label: 'Com erro', value: String(erros), cls: erros > 0 ? 'text-red-700 dark:text-red-400' : 'text-[#6E6A61] dark:text-[#A8A49C]' },
        ].map(k => (
          <div key={k.label} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">{k.label}</p>
            <p className={`mt-1 font-serif font-bold text-2xl ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 shadow-xs">
          <Search className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, tomador, NF…" className="w-48 sm:w-64 bg-transparent text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none" />
        </div>

        <SegmentedTabs
          tabs={filterTabs}
          activeTab={filterStatus}
          onChange={(id) => setFilterStatus(id as any)}
          layoutId="notasFiscaisAdminTabs"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-sm">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 text-left font-bold text-[#6E6A61] dark:text-[#A8A49C]">
              <th className="px-5 py-3.5">Número</th>
              <th className="px-3 py-3.5">Cliente (tenant)</th>
              <th className="px-3 py-3.5 hidden md:table-cell">Tomador</th>
              <th className="px-3 py-3.5 hidden lg:table-cell">Serviço</th>
              <th className="px-3 py-3.5 text-right">Valor</th>
              <th className="px-3 py-3.5 text-center">Status</th>
              <th className="px-3 py-3.5 hidden sm:table-cell">Emissão</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10 bg-[#FEFDF3] dark:bg-[#121614]">
            {filtered.map(n => {
              const st = S_CFG[n.status];
              const StIcon = st.icon;
              return (
                <tr key={n.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-[#6E6A61] dark:text-[#A8A49C]">{n.numero}</td>
                  <td className="px-3 py-3.5 font-bold text-[#231F20] dark:text-[#FEFDF3]">
                    <p className="truncate max-w-[140px]">{n.cliente}</p>
                  </td>
                  <td className="px-3 py-3.5 text-[#6E6A61] dark:text-[#A8A49C] hidden md:table-cell">
                    <span className="truncate max-w-[120px] block">{n.tomador}</span>
                  </td>
                  <td className="px-3 py-3.5 text-[#6E6A61] dark:text-[#A8A49C] hidden lg:table-cell">
                    <span className="truncate max-w-[140px] block">{n.servico}</span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(n.valor)}</td>
                  <td className="px-3 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>
                        <StIcon className="h-3 w-3" />{st.label}
                      </span>
                      {n.isMock && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                          <FlaskConical className="h-2.5 w-2.5" /> Teste
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#6E6A61] dark:text-[#A8A49C] hidden sm:table-cell">
                    {n.emissao.split('-').reverse().join('/')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/contador/clientes/${n.companyId}`} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                      Ver cliente →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] bg-[#FEFDF3] dark:bg-[#121614]">Nenhuma nota encontrada.</div>
        )}
      </div>
    </div>
  );
}

