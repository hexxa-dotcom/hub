'use client';

import Link from 'next/link';
import {
  Users, TrendingUp, AlertCircle, CheckCircle2,
  Clock, ArrowRight, FileText, CreditCard, DollarSign,
} from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIENTES = [
  { nome: 'Hexxa Demo Serviços LTDA', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2024-01' },
  { nome: 'Tech Soluções ME', plano: 'Crescimento', status: 'ativo', mrr: 299.90, desde: '2024-03' },
  { nome: 'Consultoria Silva & Cia', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2024-06' },
  { nome: 'Studio Criativo LTDA', plano: 'Crescimento', status: 'trial', mrr: 0, desde: '2026-06' },
  { nome: 'Advocacia Mendes', plano: 'Início', status: 'inadimplente', mrr: 149.90, desde: '2023-11' },
  { nome: 'DEF Comércio ME', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2025-02' },
];

const SOLICITACOES = [
  { id: 1, cliente: 'Tech Soluções ME', tipo: 'Cadastro de NF', desc: 'Configurar emissão de NFSe para o município de Florianópolis', criada: '2026-06-27', prioridade: 'alta' },
  { id: 2, cliente: 'Studio Criativo LTDA', tipo: 'Suporte', desc: 'Dúvida sobre cálculo de IRRF no pró-labore', criada: '2026-06-27', prioridade: 'media' },
  { id: 3, cliente: 'Advocacia Mendes', tipo: 'Cobrança', desc: 'Regularizar inadimplência — 2 meses em aberto', criada: '2026-06-25', prioridade: 'alta' },
];

function KPICard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${color ?? 'bg-brand-500/10 text-brand-600'}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const PRIORIDADE_CLS: Record<string, string> = {
  alta: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_CLS: Record<string, string> = {
  ativo: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trial: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  inadimplente: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  inativo: 'bg-slate-100 text-slate-500',
};

export default function AdminDashboard() {
  const ativos = CLIENTES.filter(c => c.status === 'ativo').length;
  const mrr = CLIENTES.filter(c => c.status === 'ativo').reduce((s, c) => s + c.mrr, 0);
  const inadimplentes = CLIENTES.filter(c => c.status === 'inadimplente').length;
  const trials = CLIENTES.filter(c => c.status === 'trial').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Visão geral da operação — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<DollarSign className="h-4 w-4" />} label="MRR" value={BRL.format(mrr)} sub="valor mensal recorrente" color="bg-green-50 text-green-600" />
        <KPICard icon={<Users className="h-4 w-4" />} label="Clientes ativos" value={String(ativos)} sub={`${trials} em trial`} />
        <KPICard icon={<AlertCircle className="h-4 w-4" />} label="Inadimplentes" value={String(inadimplentes)} sub="Requer ação" color="bg-red-50 text-red-600" />
        <KPICard icon={<Clock className="h-4 w-4" />} label="Solicitações abertas" value={String(SOLICITACOES.length)} sub="Aguardando resposta" color="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Solicitações abertas */}
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Solicitações abertas</h2>
            <Link href="/admin/solicitacoes" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {SOLICITACOES.map(s => (
              <li key={s.id} className="flex items-start gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORIDADE_CLS[s.prioridade]}`}>
                      {s.prioridade === 'alta' ? '⚡ Alta' : s.prioridade === 'media' ? '○ Média' : '· Baixa'}
                    </span>
                    <span className="text-xs text-slate-400">{s.tipo}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">{s.cliente}</p>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
                <Link href="/admin/solicitacoes"
                  className="shrink-0 rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                  Atender
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Últimos clientes */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Clientes</h2>
            <Link href="/admin/clientes" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {CLIENTES.slice(0, 5).map(c => (
              <li key={c.nome} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {c.nome.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{c.nome}</p>
                  <p className="text-xs text-slate-400">{c.plano}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[c.status]}`}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Distribuição de planos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Distribuição por plano</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { plano: 'Início', valor: 'R$ 149,90/mês', qtd: CLIENTES.filter(c => c.plano === 'Início').length, cor: 'bg-brand-500' },
            { plano: 'Crescimento', valor: 'R$ 299,90/mês', qtd: CLIENTES.filter(c => c.plano === 'Crescimento').length, cor: 'bg-violet-500' },
            { plano: 'Escala', valor: 'R$ 499,90/mês', qtd: CLIENTES.filter(c => c.plano === 'Escala').length, cor: 'bg-amber-500' },
          ].map(p => (
            <div key={p.plano} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <span className={`h-2 w-2 rounded-full ${p.cor} shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 dark:text-slate-200">{p.plano}</p>
                <p className="text-xs text-slate-500">{p.valor}</p>
              </div>
              <span className="text-2xl font-semibold text-slate-700 dark:text-slate-300">{p.qtd}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
