'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlass, CheckCircle, Clock, XCircle, Flask } from '@phosphor-icons/react';

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
  ISSUED: { label: 'Emitida', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  ISSUING: { label: 'Processando', cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  DRAFT: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800', icon: Clock },
  CANCELED: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800', icon: XCircle },
  ERROR: { label: 'Erro', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Notas Fiscais</h1>
        <p className="text-sm text-slate-500">Visão cross-cliente das emissões NFSe (somente leitura — a emissão é feita na tela do próprio cliente)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total emitido (real)', value: BRL.format(totalEmitido), cls: 'text-green-700 dark:text-green-400' },
          { label: 'Notas emitidas', value: String(initial.filter(n => n.status === 'ISSUED').length), cls: '' },
          { label: 'Pendentes', value: String(pendentes), cls: pendentes > 0 ? 'text-yellow-700 dark:text-yellow-400' : '' },
          { label: 'Com erro', value: String(erros), cls: erros > 0 ? 'text-red-700 dark:text-red-400' : '' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-xl font-semibold ${k.cls || 'text-slate-900 dark:text-white'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <MagnifyingGlass className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, tomador, NF…" className="w-48 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" />
        </div>
        {(['todas', 'ISSUED', 'ISSUING', 'ERROR', 'CANCELED'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {s === 'todas' ? `Todas (${initial.length})` : `${S_CFG[s]?.label ?? s} (${initial.filter(n => n.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-medium text-slate-500">
              <th className="px-5 py-3">Número</th>
              <th className="px-3 py-3">Cliente (tenant)</th>
              <th className="px-3 py-3 hidden md:table-cell">Tomador</th>
              <th className="px-3 py-3 hidden lg:table-cell">Serviço</th>
              <th className="px-3 py-3 text-right">Valor</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 hidden sm:table-cell">Emissão</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(n => {
              const st = S_CFG[n.status];
              const StIcon = st.icon;
              return (
                <tr key={n.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{n.numero}</td>
                  <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">
                    <p className="truncate max-w-[140px]">{n.cliente}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">
                    <span className="truncate max-w-[120px] block">{n.tomador}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-500 hidden lg:table-cell">
                    <span className="truncate max-w-[140px] block">{n.servico}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{BRL.format(n.valor)}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.cls}`}>
                        <StIcon className="h-3 w-3" />{st.label}
                      </span>
                      {n.isMock && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Flask className="h-2.5 w-2.5" /> Teste (não enviada ao governo)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 hidden sm:table-cell">
                    {n.emissao.split('-').reverse().join('/')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/contador/clientes/${n.companyId}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                      Ver cliente
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">Nenhuma nota encontrada.</div>
        )}
      </div>
    </div>
  );
}
