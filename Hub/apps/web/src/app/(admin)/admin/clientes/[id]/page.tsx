'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, User, FileText,
  CreditCard, CheckCircle2, AlertCircle, Clock, TrendingUp,
  Calendar, DollarSign, BarChart2, RefreshCw, Send, Edit2,
} from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Status = 'ativo' | 'trial' | 'inadimplente' | 'inativo';
type Plano = 'Início' | 'Crescimento' | 'Escala';

type Cliente = {
  id: string;
  razao: string;
  fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano: Plano;
  status: Status;
  mrr: number;
  desde: string;
  responsavel: string;
  regime: string;
  municipio: string;
  uf: string;
  atividade: string;
  funcionarios: string;
  faturamentoAnual: string;
  inscricaoMunicipal: string;
  pendencias: number;
  asaasSubscriptionId?: string;
};

const CLIENTES: Cliente[] = [
  {
    id: '1', razao: 'Hexxa Demo Serviços LTDA', fantasia: 'Hexxa Demo', cnpj: '00.000.000/0001-00',
    email: 'demo@hexxa.com.br', telefone: '(47) 99999-0000', plano: 'Início', status: 'ativo',
    mrr: 149.90, desde: '2024-01-15', responsavel: 'Carlos Mendes', regime: 'Simples Nacional',
    municipio: 'Joinville', uf: 'SC', atividade: 'Desenvolvimento de software', funcionarios: '3–10',
    faturamentoAnual: 'R$ 120.000 – R$ 360.000', inscricaoMunicipal: '000.000.000-0', pendencias: 0,
  },
  {
    id: '2', razao: 'Tech Soluções ME', fantasia: 'TechSol', cnpj: '11.111.111/0001-11',
    email: 'contato@techsol.com.br', telefone: '(48) 98888-1111', plano: 'Crescimento', status: 'ativo',
    mrr: 299.90, desde: '2024-03-01', responsavel: 'Ana Beatriz Lima', regime: 'Lucro Presumido',
    municipio: 'Florianópolis', uf: 'SC', atividade: 'Consultoria em TI', funcionarios: '11–30',
    faturamentoAnual: 'R$ 500.000 – R$ 1.000.000', inscricaoMunicipal: '111.111.111-1', pendencias: 1,
    asaasSubscriptionId: 'sub_abc123',
  },
  {
    id: '3', razao: 'Consultoria Silva & Cia', fantasia: 'Silva Consultoria', cnpj: '22.222.222/0001-22',
    email: 'silva@silvaconsult.com.br', telefone: '(51) 97777-2222', plano: 'Início', status: 'ativo',
    mrr: 149.90, desde: '2024-06-10', responsavel: 'Roberto Silva', regime: 'Simples Nacional',
    municipio: 'Porto Alegre', uf: 'RS', atividade: 'Consultoria empresarial', funcionarios: '1–2',
    faturamentoAnual: 'R$ 60.000 – R$ 180.000', inscricaoMunicipal: '222.222.222-2', pendencias: 0,
  },
  {
    id: '4', razao: 'Studio Criativo LTDA', fantasia: 'Studio Criativo', cnpj: '33.333.333/0001-33',
    email: 'hello@studiocriativo.com', telefone: '(11) 96666-3333', plano: 'Crescimento', status: 'trial',
    mrr: 0, desde: '2026-06-01', responsavel: 'Julia Castro', regime: 'MEI',
    municipio: 'São Paulo', uf: 'SP', atividade: 'Design e comunicação visual', funcionarios: '1–2',
    faturamentoAnual: 'Até R$ 81.000', inscricaoMunicipal: '333.333.333-3', pendencias: 0,
  },
  {
    id: '5', razao: 'Advocacia Mendes Associados', fantasia: 'Mendes Adv', cnpj: '44.444.444/0001-44',
    email: 'adv@mendesassociados.com.br', telefone: '(41) 95555-4444', plano: 'Início', status: 'inadimplente',
    mrr: 149.90, desde: '2023-11-20', responsavel: 'Diego Mendes', regime: 'Simples Nacional',
    municipio: 'Curitiba', uf: 'PR', atividade: 'Serviços jurídicos', funcionarios: '3–10',
    faturamentoAnual: 'R$ 200.000 – R$ 400.000', inscricaoMunicipal: '444.444.444-4', pendencias: 2,
  },
  {
    id: '6', razao: 'DEF Comércio e Serviços ME', fantasia: 'DEF Serviços', cnpj: '55.555.555/0001-55',
    email: 'def@defservicos.com.br', telefone: '(62) 94444-5555', plano: 'Início', status: 'ativo',
    mrr: 149.90, desde: '2025-02-14', responsavel: 'Fernanda Oliveira', regime: 'MEI',
    municipio: 'Goiânia', uf: 'GO', atividade: 'Comércio varejista e serviços', funcionarios: '1–2',
    faturamentoAnual: 'Até R$ 81.000', inscricaoMunicipal: '555.555.555-5', pendencias: 0,
  },
];

const STATUS_CFG: Record<Status, { label: string; cls: string; dot: string }> = {
  ativo:        { label: 'Ativo',        cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  trial:        { label: 'Trial',        cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   dot: 'bg-blue-500' },
  inadimplente: { label: 'Inadimplente', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',       dot: 'bg-red-500' },
  inativo:      { label: 'Inativo',      cls: 'bg-slate-100 text-slate-500',                                        dot: 'bg-slate-400' },
};

const PLANO_VALOR: Record<Plano, number> = { 'Início': 149.90, 'Crescimento': 299.90, 'Escala': 499.90 };

function calcMeses(desde: string): number {
  const d = new Date(desde + 'T12:00:00');
  const hoje = new Date('2026-06-28');
  return Math.max(0, (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth()));
}

function gerarHistorico(c: Cliente) {
  const meses = calcMeses(c.desde);
  if (meses === 0 || c.mrr === 0) return [];
  const inicio = new Date(c.desde + 'T12:00:00');
  const result = [];
  for (let i = 0; i < Math.min(meses, 12); i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const status: 'pago' | 'atrasado' | 'pendente' =
      c.status === 'inadimplente' && i === meses - 1 ? 'atrasado' :
      c.status === 'inadimplente' && i === meses - 2 ? 'atrasado' : 'pago';
    result.push({
      mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      valor: c.mrr,
      status,
    });
  }
  return result.reverse();
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = CLIENTES.find(x => x.id === id);

  const [status, setStatus] = useState(c?.status ?? 'inativo');

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-slate-500">Cliente não encontrado.</p>
        <Link href="/admin/clientes" className="text-sm text-brand-500 hover:underline">← Voltar</Link>
      </div>
    );
  }

  const st = STATUS_CFG[status];
  const meses = calcMeses(c.desde);
  const totalFaturado = c.mrr * meses;
  const historico = gerarHistorico({ ...c, status });
  const maxVal = Math.max(...historico.map(h => h.valor), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/clientes"
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{c.razao}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {c.pendencias > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {c.pendencias} pendência{c.pendencias > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{c.fantasia} · CNPJ {c.cnpj} · {c.municipio}/{c.uf}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={`mailto:${c.email}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
            <Send className="h-3.5 w-3.5" /> E-mail
          </a>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
            <Edit2 className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'MRR atual', value: c.mrr > 0 ? BRL.format(c.mrr) : '—', sub: `Plano ${c.plano}`, icon: DollarSign, color: 'text-green-600 dark:text-green-400' },
          { label: 'Total faturado', value: totalFaturado > 0 ? BRL.format(totalFaturado) : '—', sub: `em ${meses} mês${meses !== 1 ? 'es' : ''}`, icon: TrendingUp, color: 'text-brand-600 dark:text-brand-400' },
          { label: 'Cliente desde', value: meses > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '< 1 mês', sub: fmtDate(c.desde), icon: Calendar, color: 'text-violet-600 dark:text-violet-400' },
          { label: 'LTV estimado', value: c.mrr > 0 ? BRL.format(c.mrr * 24) : '—', sub: 'base 24 meses', icon: BarChart2, color: 'text-amber-600 dark:text-amber-400' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left — dados + histórico */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dados da empresa */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Building2 className="h-4 w-4 text-slate-400" /> Dados da empresa
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ['Razão social', c.razao],
                ['Nome fantasia', c.fantasia],
                ['CNPJ', c.cnpj],
                ['Insc. municipal', c.inscricaoMunicipal],
                ['Regime tributário', c.regime],
                ['Atividade', c.atividade],
                ['Município', `${c.municipio}/${c.uf}`],
                ['Funcionários', c.funcionarios],
                ['Fat. anual estimado', c.faturamentoAnual],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-400">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contato */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <User className="h-4 w-4 text-slate-400" /> Contato responsável
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Responsável</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.responsavel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">E-mail</p>
                  <a href={`mailto:${c.email}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400 break-all">{c.email}</a>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Telefone</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.telefone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de faturamento */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <BarChart2 className="h-4 w-4 text-slate-400" /> Faturamento mensal
            </h2>
            <p className="text-xs text-slate-400 mb-4">Últimos {historico.length} meses com a Hexxa</p>

            {historico.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Sem histórico — cliente em trial ou recém-cadastrado.</p>
            ) : (
              <>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1.5 h-20 mb-4">
                  {[...historico].reverse().map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1 group relative">
                      <div
                        className={`w-full rounded-t transition-all ${
                          h.status === 'pago' ? 'bg-brand-500' :
                          h.status === 'atrasado' ? 'bg-red-400' : 'bg-slate-200'
                        }`}
                        style={{ height: `${(h.valor / maxVal) * 64}px` }}
                      />
                      <span className="text-[9px] text-slate-400 truncate w-full text-center">{h.mes}</span>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                        {BRL.format(h.valor)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela */}
                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Mês</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Valor</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {historico.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 capitalize">{h.mes}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">{BRL.format(h.valor)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              h.status === 'pago' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                              h.status === 'atrasado' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                              'bg-yellow-50 text-yellow-700'
                            }`}>
                              {h.status === 'pago' ? <CheckCircle2 className="h-2.5 w-2.5" /> :
                               h.status === 'atrasado' ? <AlertCircle className="h-2.5 w-2.5" /> :
                               <Clock className="h-2.5 w-2.5" />}
                              {h.status === 'pago' ? 'Pago' : h.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800 dark:text-slate-200">
                          {BRL.format(historico.reduce((s, h) => s + (h.status !== 'atrasado' ? h.valor : 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right — sidebar */}
        <div className="space-y-4">
          {/* Plano */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CreditCard className="h-4 w-4 text-slate-400" /> Plano contratado
            </h2>
            <div className="space-y-2">
              {(['Início', 'Crescimento', 'Escala'] as Plano[]).map(p => (
                <div key={p} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${c.plano === p ? 'bg-brand-500/10 ring-1 ring-brand-400/40' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <div>
                    <p className={`text-sm font-semibold ${c.plano === p ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>{p}</p>
                    <p className={`text-xs ${c.plano === p ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>{BRL.format(PLANO_VALOR[p])}/mês</p>
                  </div>
                  {c.plano === p && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                </div>
              ))}
            </div>
            {c.asaasSubscriptionId && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Cobrança via Asaas ativa
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Calendar className="h-4 w-4 text-slate-400" /> Linha do tempo
            </h2>
            <ol className="relative border-l border-slate-200 dark:border-slate-700 pl-4 space-y-4">
              <li>
                <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-brand-500" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Hoje</p>
                <p className="text-[11px] text-slate-400">28/06/2026</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{meses} {meses === 1 ? 'mês' : 'meses'} como cliente</p>
              </li>
              {meses >= 12 && (
                <li>
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-amber-400" />
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">1 ano completo</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(new Date(c.desde + 'T12:00:00').setFullYear(new Date(c.desde + 'T12:00:00').getFullYear() + 1)).toLocaleDateString('pt-BR')}
                  </p>
                </li>
              )}
              <li>
                <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-violet-400" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Início do contrato</p>
                <p className="text-[11px] text-slate-400">{fmtDate(c.desde)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Plano {c.plano}</p>
              </li>
            </ol>
          </div>

          {/* Ações rápidas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Ações rápidas</h2>
            <div className="space-y-2">
              <Link href="/admin/comunicacoes"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <Send className="h-4 w-4 text-slate-400" /> Enviar comunicação
              </Link>
              <Link href="/admin/notas"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <FileText className="h-4 w-4 text-slate-400" /> Ver notas fiscais
              </Link>
              <Link href="/admin/contratos"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <FileText className="h-4 w-4 text-slate-400" /> Gerar contrato
              </Link>
              <Link href="/admin/onboarding"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-slate-400" /> Ver onboarding
              </Link>
              <Link href={`/admin/clientes/${c.id}/fiscal`}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <BarChart2 className="h-4 w-4 text-slate-400" /> Gestão Fiscal (PGDAS)
              </Link>
              {status === 'inadimplente' && (
                <button onClick={() => setStatus('ativo')}
                  className="flex w-full items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors">
                  <RefreshCw className="h-4 w-4" /> Regularizar conta
                </button>
              )}
              {status === 'trial' && (
                <button onClick={() => setStatus('ativo')}
                  className="flex w-full items-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-500/20 dark:text-brand-400 transition-colors">
                  <CheckCircle2 className="h-4 w-4" /> Ativar conta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
