'use client';

import { useState } from 'react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const MRR_DATA = [
  { mes: 'Jul/25', mrr: 299.8,  novos: 2, churn: 0 },
  { mes: 'Ago/25', mrr: 449.7,  novos: 1, churn: 0 },
  { mes: 'Set/25', mrr: 449.7,  novos: 0, churn: 0 },
  { mes: 'Out/25', mrr: 599.6,  novos: 1, churn: 0 },
  { mes: 'Nov/25', mrr: 599.6,  novos: 0, churn: 0 },
  { mes: 'Dez/25', mrr: 749.5,  novos: 1, churn: 0 },
  { mes: 'Jan/26', mrr: 899.4,  novos: 1, churn: 0 },
  { mes: 'Fev/26', mrr: 899.4,  novos: 0, churn: 0 },
  { mes: 'Mar/26', mrr: 1049.3, novos: 1, churn: 0 },
  { mes: 'Abr/26', mrr: 899.4,  novos: 0, churn: 1 },
  { mes: 'Mai/26', mrr: 1049.3, novos: 1, churn: 0 },
  { mes: 'Jun/26', mrr: 1349.1, novos: 2, churn: 0 },
];

const PLANOS = [
  { nome: 'Início',      clientes: 4, valor: 149.90, cor: '#6366f1' },
  { nome: 'Crescimento', clientes: 2, valor: 299.90, cor: '#8b5cf6' },
  { nome: 'Escala',      clientes: 0, valor: 499.90, cor: '#f59e0b' },
];

function MrrChart() {
  const max = Math.max(...MRR_DATA.map(d => d.mrr));
  const W = 640, H = 200, PL = 60, PR = 16, PT = 16, PB = 32;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const barW = innerW / MRR_DATA.length;
  const pad = barW * 0.2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>
              {BRL.format(max * t).replace('R$ ', 'R$')}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {MRR_DATA.map((d, i) => {
        const barH = (d.mrr / max) * innerH;
        const x = PL + i * barW + pad;
        const y = PT + innerH - barH;
        const w = barW - pad * 2;
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={w} height={barH} rx={3} fill="#6366f1" fillOpacity={0.85} />
            <text x={x + w / 2} y={H - PB + 14} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.5}>
              {d.mes.replace('/26', '').replace('/25', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${color ?? 'text-slate-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function AdminRelatorios() {
  const atual = MRR_DATA[MRR_DATA.length - 1]!;
  const anterior = MRR_DATA[MRR_DATA.length - 2]!;
  const crescimento = ((atual.mrr - anterior.mrr) / anterior.mrr * 100).toFixed(1);
  const totalClientes = PLANOS.reduce((s, p) => s + p.clientes, 0);
  const mrrTotal = PLANOS.reduce((s, p) => s + p.clientes * p.valor, 0);
  const ltv = totalClientes > 0 ? (mrrTotal / totalClientes) * 24 : 0;
  const churnMeses = MRR_DATA.filter(d => d.churn > 0).length;
  const churnRate = ((churnMeses / MRR_DATA.length) * 100).toFixed(0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Relatórios</h1>
        <p className="text-sm text-slate-500">Evolução financeira e métricas de negócio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR atual" value={BRL.format(mrrTotal)} sub={`+${crescimento}% vs mês anterior`} color="text-green-600 dark:text-green-400" />
        <StatCard label="Clientes ativos" value={String(totalClientes)} sub="pagantes" />
        <StatCard label="LTV médio (24m)" value={BRL.format(ltv)} sub="por cliente" />
        <StatCard label="Churn rate" value={`${churnRate}%`} sub="últimos 12 meses" color={Number(churnRate) > 5 ? 'text-red-600' : 'text-slate-900 dark:text-white'} />
      </div>

      {/* MRR Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Evolução do MRR — 12 meses</h2>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            +{crescimento}% mês a mês
          </span>
        </div>
        <div className="text-slate-600 dark:text-slate-300">
          <MrrChart />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          {[
            { label: 'Novos clientes (período)', value: MRR_DATA.reduce((s, d) => s + d.novos, 0).toString() },
            { label: 'Churns (período)', value: MRR_DATA.reduce((s, d) => s + d.churn, 0).toString() },
            { label: 'Ticket médio', value: BRL.format(totalClientes > 0 ? mrrTotal / totalClientes : 0) },
          ].map(k => (
            <div key={k.label} className="text-center">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{k.value}</p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Distribuição por plano */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Receita por plano</h2>
        <div className="space-y-3">
          {PLANOS.map(p => {
            const receita = p.clientes * p.valor;
            const pct = mrrTotal > 0 ? (receita / mrrTotal) * 100 : 0;
            return (
              <div key={p.nome}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{p.nome}</span>
                    <span className="text-slate-400">{p.clientes} cliente{p.clientes !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{pct.toFixed(0)}%</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{BRL.format(receita)}/mês</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: p.cor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historico de novos/churn */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Novos vs Churn por mês</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2">Mês</th>
                <th className="pb-2 text-right">MRR</th>
                <th className="pb-2 text-center">Novos</th>
                <th className="pb-2 text-center">Churn</th>
                <th className="pb-2 text-right">Var.</th>
              </tr>
            </thead>
            <tbody>
              {MRR_DATA.map((d, i) => {
                const prev = i > 0 ? MRR_DATA[i - 1]!.mrr : d.mrr;
                const delta = d.mrr - prev;
                return (
                  <tr key={d.mes} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                    <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{d.mes}</td>
                    <td className="py-2 text-right font-semibold text-slate-800 dark:text-slate-200">{BRL.format(d.mrr)}</td>
                    <td className="py-2 text-center">
                      {d.novos > 0 ? <span className="text-green-600 font-semibold">+{d.novos}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 text-center">
                      {d.churn > 0 ? <span className="text-red-600 font-semibold">-{d.churn}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 text-right">
                      {i > 0 && (
                        <span className={delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {delta >= 0 ? '+' : ''}{BRL.format(delta)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
