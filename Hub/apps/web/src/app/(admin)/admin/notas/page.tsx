'use client';

import { useState } from 'react';
import { Search, FileText, CheckCircle2, Clock, XCircle, Download, ExternalLink, RefreshCw } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type NFStatus = 'emitida' | 'pendente' | 'cancelada' | 'erro';

type NotaFiscal = {
  id: string;
  numero: string;
  cliente: string;
  tomador: string;
  servico: string;
  valor: number;
  emissao: string;
  status: NFStatus;
  municipio: string;
  obs?: string;
};

const SEED: NotaFiscal[] = [
  { id: '1', numero: 'NFS-001', cliente: 'Tech Soluções ME', tomador: 'Empresa ABC Ltda', servico: 'Consultoria em TI', valor: 8500, emissao: '2026-06-25', status: 'emitida', municipio: 'Florianópolis/SC' },
  { id: '2', numero: 'NFS-002', cliente: 'Hexxa Demo Serviços LTDA', tomador: 'Projeto Web XYZ', servico: 'Desenvolvimento de software', valor: 12000, emissao: '2026-06-24', status: 'emitida', municipio: 'Joinville/SC' },
  { id: '3', numero: 'NFS-003', cliente: 'Consultoria Silva & Cia', tomador: 'Startup DEF', servico: 'Consultoria financeira', valor: 5500, emissao: '2026-06-23', status: 'emitida', municipio: 'Porto Alegre/RS' },
  { id: '4', numero: '—', cliente: 'Studio Criativo LTDA', tomador: 'Agência GHI', servico: 'Design de identidade visual', valor: 6000, emissao: '2026-06-28', status: 'pendente', municipio: 'São Paulo/SP', obs: 'Aguardando configuração do município no sistema' },
  { id: '5', numero: 'NFS-045', cliente: 'DEF Comércio e Serviços ME', tomador: 'Comércio JKL', servico: 'Serviços de gestão', valor: 3200, emissao: '2026-06-20', status: 'cancelada', municipio: 'Goiânia/GO', obs: 'Cancelada a pedido do cliente' },
  { id: '6', numero: '—', cliente: 'Tech Soluções ME', tomador: 'Empresa MNO', servico: 'Suporte técnico mensal', valor: 4500, emissao: '2026-06-27', status: 'erro', municipio: 'Florianópolis/SC', obs: 'Rejeição da prefeitura: código de serviço inválido (LC116 item 1.01)' },
];

const S_CFG: Record<NFStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  emitida: { label: 'Emitida', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  pendente: { label: 'Pendente', cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  cancelada: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800', icon: XCircle },
  erro: { label: 'Erro', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

export default function AdminNotas() {
  const [items, setItems] = useState(SEED);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<NFStatus | 'todas'>('todas');

  const filtered = items.filter(n => {
    const match = [n.cliente, n.tomador, n.numero, n.servico].some(v => v.toLowerCase().includes(search.toLowerCase()));
    return match && (filterStatus === 'todas' || n.status === filterStatus);
  });

  const totalEmitido = items.filter(n => n.status === 'emitida').reduce((s, n) => s + n.valor, 0);
  const erros = items.filter(n => n.status === 'erro').length;
  const pendentes = items.filter(n => n.status === 'pendente').length;

  function reemitir(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, status: 'emitida', numero: `NFS-00${Math.floor(Math.random() * 900 + 100)}`, obs: undefined } : n));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Notas Fiscais</h1>
        <p className="text-sm text-slate-500">Gestão cross-cliente de emissões NFSe</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total emitido (mês)', value: BRL.format(totalEmitido), cls: 'text-green-700 dark:text-green-400' },
          { label: 'Notas emitidas', value: String(items.filter(n => n.status === 'emitida').length), cls: '' },
          { label: 'Pendentes', value: String(pendentes), cls: pendentes > 0 ? 'text-yellow-700 dark:text-yellow-400' : '' },
          { label: 'Com erro', value: String(erros), cls: erros > 0 ? 'text-red-700 dark:text-red-400' : '' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-xl font-semibold ${k.cls || 'text-slate-900 dark:text-white'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, tomador, NF…" className="w-48 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" />
        </div>
        {(['todas', 'emitida', 'pendente', 'erro', 'cancelada'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {s === 'todas' ? `Todas (${items.length})` : `${S_CFG[s]?.label ?? s} (${items.filter(n => n.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-medium text-slate-500">
              <th className="px-5 py-3">Número</th>
              <th className="px-3 py-3">Cliente</th>
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
                <>
                  <tr key={n.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{n.numero}</td>
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">
                      <p className="truncate max-w-[140px]">{n.cliente}</p>
                      <p className="text-[11px] text-slate-400">{n.municipio}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      <span className="truncate max-w-[120px] block">{n.tomador}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden lg:table-cell">
                      <span className="truncate max-w-[140px] block">{n.servico}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{BRL.format(n.valor)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.cls}`}>
                        <StIcon className="h-3 w-3" />{st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 hidden sm:table-cell">
                      {n.emissao.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {n.status === 'emitida' && (
                          <button title="Baixar XML" className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {n.status === 'erro' && (
                          <button onClick={() => reemitir(n.id)} title="Tentar novamente"
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" /> Corrigir
                          </button>
                        )}
                        {n.status === 'pendente' && (
                          <button onClick={() => reemitir(n.id)} title="Emitir agora"
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20 transition-colors">
                            <FileText className="h-3.5 w-3.5" /> Emitir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {(n.status === 'erro' || n.status === 'pendente') && n.obs && (
                    <tr key={`${n.id}-obs`} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10">
                      <td colSpan={8} className="px-5 py-2 text-xs text-red-600 dark:text-red-400">
                        ⚠ {n.obs}
                      </td>
                    </tr>
                  )}
                </>
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
