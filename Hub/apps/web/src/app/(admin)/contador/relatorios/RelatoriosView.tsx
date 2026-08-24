'use client';

import { BarChart3 } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type MonthPoint = { mes: string; pago: number; total: number; novos: number };
export type PlanoReceita = { nome: string; clientes: number; valor: number };

const PLANO_COR: Record<string, string> = { 'Início': '#2F4A3C', 'Crescimento': '#1E3328', 'Escala': '#84cc16' };

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

function FaturamentoChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 640, H = 200, PL = 60, PR = 16, PT = 16, PB = 32;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const barW = innerW / data.length;
  const pad = barW * 0.2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = PT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>
              {BRL.format(max * t).replace('R$ ', 'R$')}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.total / max) * innerH;
        const x = PL + i * barW + pad;
        const y = PT + innerH - barH;
        const w = barW - pad * 2;
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={w} height={barH} rx={4} fill="#1E3328" fillOpacity={0.85} />
            <text x={x + w / 2} y={H - PB + 14} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.5}>
              {monthLabel(d.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
      <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 font-serif font-bold text-2xl ${color ?? 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{sub}</p>}
    </div>
  );
}

export function RelatoriosView({
  planos,
  mrrAtual,
  totalClientesAtivos,
  faturamento,
}: {
  planos: PlanoReceita[];
  mrrAtual: number;
  totalClientesAtivos: number;
  faturamento: MonthPoint[];
}) {
  const ltv = totalClientesAtivos > 0 ? (mrrAtual / totalClientesAtivos) * 24 : 0;
  const ticketMedio = totalClientesAtivos > 0 ? mrrAtual / totalClientesAtivos : 0;
  const totalPagoPeriodo = faturamento.reduce((s, d) => s + d.pago, 0);
  const totalNovosPeriodo = faturamento.reduce((s, d) => s + d.novos, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Relatórios</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Situação atual das assinaturas e faturamento real de honorários</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR atual" value={BRL.format(mrrAtual)} sub="soma dos planos ativos agora" color="text-emerald-700 dark:text-emerald-400" />
        <StatCard label="Clientes ativos" value={String(totalClientesAtivos)} sub="pagantes" />
        <StatCard label="LTV estimado (24m)" value={BRL.format(ltv)} sub="baseado no MRR atual" />
        <StatCard label="Ticket médio" value={BRL.format(ticketMedio)} sub="por cliente ativo" />
      </div>

      {/* Faturamento real por mês */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Faturas de honorários — por mês</h2>
          <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Gerado pelo fechamento mensal</span>
        </div>
        {faturamento.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <BarChart3 className="h-10 w-10 opacity-20" />
            <p className="text-xs sm:text-sm">Ainda sem faturas geradas — aparece aqui após o primeiro fechamento mensal rodar.</p>
          </div>
        ) : (
          <>
            <div className="text-[#231F20] dark:text-[#FEFDF3]">
              <FaturamentoChart data={faturamento} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 dark:border-white/10 pt-4">
              <div className="text-center">
                <p className="font-serif font-bold text-xl text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(totalPagoPeriodo)}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Total pago no período</p>
              </div>
              <div className="text-center">
                <p className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">{totalNovosPeriodo}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Novas empresas cadastradas no período</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Distribuição por plano */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <h2 className="mb-4 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Receita por plano</h2>
        <div className="space-y-4">
          {planos.map((p) => {
            const receita = p.clientes * p.valor;
            const pct = mrrAtual > 0 ? (receita / mrrAtual) * 100 : 0;
            const cor = PLANO_COR[p.nome] ?? '#94a3b8';
            return (
              <div key={p.nome}>
                <div className="flex items-center justify-between mb-1.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
                    <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{p.nome}</span>
                    <span className="text-[#6E6A61] dark:text-[#A8A49C]">({p.clientes} cliente{p.clientes !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">{pct.toFixed(0)}%</span>
                    <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(receita)}/mês</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 p-0.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

