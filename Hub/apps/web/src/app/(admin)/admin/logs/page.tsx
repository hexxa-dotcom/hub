'use client';

import { useState } from 'react';
import { Search, Activity } from 'lucide-react';

type LogTipo = 'plano' | 'cliente' | 'nf' | 'cobranca' | 'suporte' | 'sistema' | 'acesso';

type LogEntry = {
  id: string;
  quando: string;
  admin: string;
  tipo: LogTipo;
  acao: string;
  entidade: string;
  detalhe?: string;
};

const TIPO_CFG: Record<LogTipo, { label: string; cls: string; dot: string }> = {
  plano:    { label: 'Plano',    cls: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',   dot: 'bg-violet-500' },
  cliente:  { label: 'Cliente',  cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',           dot: 'bg-blue-500' },
  nf:       { label: 'NF',       cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',         dot: 'bg-slate-400' },
  cobranca: { label: 'Cobrança', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',       dot: 'bg-green-500' },
  suporte:  { label: 'Suporte',  cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',   dot: 'bg-yellow-500' },
  sistema:  { label: 'Sistema',  cls: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',   dot: 'bg-orange-500' },
  acesso:   { label: 'Acesso',   cls: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',           dot: 'bg-teal-500' },
};

const SEED: LogEntry[] = [
  { id: '1',  quando: '2026-06-28 14:32', admin: 'Filipe Heck',   tipo: 'plano',    acao: 'Alterou plano',      entidade: 'Tech Soluções ME',          detalhe: 'Início → Crescimento' },
  { id: '2',  quando: '2026-06-28 14:10', admin: 'Filipe Heck',   tipo: 'cobranca', acao: 'Criou assinatura',   entidade: 'Tech Soluções ME',          detalhe: 'Asaas sub_abc123 · PIX · R$ 299,90/mês' },
  { id: '3',  quando: '2026-06-28 13:55', admin: 'Filipe Heck',   tipo: 'suporte',  acao: 'Respondeu ticket',   entidade: 'Studio Criativo LTDA',      detalhe: 'Dúvida sobre IRRF no pró-labore' },
  { id: '4',  quando: '2026-06-28 11:20', admin: 'Filipe Heck',   tipo: 'cliente',  acao: 'Ativou conta',       entidade: 'DEF Comércio e Serviços ME', detalhe: 'Trial → Ativo' },
  { id: '5',  quando: '2026-06-27 16:45', admin: 'Sistema',       tipo: 'sistema',  acao: 'Webhook recebido',   entidade: 'Asaas',                     detalhe: 'PAYMENT_RECEIVED · Tech Soluções ME · R$ 299,90' },
  { id: '6',  quando: '2026-06-27 16:44', admin: 'Sistema',       tipo: 'cobranca', acao: 'Pagamento confirmado',entidade: 'Tech Soluções ME',          detalhe: 'Fatura Jun/2026 · R$ 299,90' },
  { id: '7',  quando: '2026-06-27 10:30', admin: 'Filipe Heck',   tipo: 'suporte',  acao: 'Abriu ticket',       entidade: 'Advocacia Mendes Associados',detalhe: 'Cobrança em aberto — 2 meses' },
  { id: '8',  quando: '2026-06-26 09:15', admin: 'Filipe Heck',   tipo: 'nf',       acao: 'Reemitiu NF',        entidade: 'Tech Soluções ME',          detalhe: 'Erro → NFS-047 · R$ 4.500,00' },
  { id: '9',  quando: '2026-06-25 15:00', admin: 'Sistema',       tipo: 'sistema',  acao: 'Alerta disparado',   entidade: 'Advocacia Mendes Associados',detalhe: 'Inadimplência ≥30 dias' },
  { id: '10', quando: '2026-06-25 08:00', admin: 'Sistema',       tipo: 'sistema',  acao: 'E-mail automático',  entidade: 'Studio Criativo LTDA',      detalhe: 'Trial expirando em 3 dias' },
  { id: '11', quando: '2026-06-24 17:22', admin: 'Filipe Heck',   tipo: 'plano',    acao: 'Editou plano',       entidade: 'Plano Crescimento',         detalhe: 'Adicionou recurso: Assinatura eletrônica' },
  { id: '12', quando: '2026-06-23 10:00', admin: 'Filipe Heck',   tipo: 'acesso',   acao: 'Login admin',        entidade: 'filipeheck7@gmail.com',     detalhe: 'IP: 179.x.x.x · Chrome / Mac' },
  { id: '13', quando: '2026-06-22 14:30', admin: 'Filipe Heck',   tipo: 'cliente',  acao: 'Cadastrou cliente',  entidade: 'Studio Criativo LTDA',      detalhe: 'CNPJ 33.333.333/0001-33 · Plano Crescimento trial' },
  { id: '14', quando: '2026-06-21 11:45', admin: 'Sistema',       tipo: 'sistema',  acao: 'Webhook falhou',     entidade: 'Asaas',                     detalhe: 'Timeout 504 — tentativa 1/3' },
  { id: '15', quando: '2026-06-20 16:00', admin: 'Filipe Heck',   tipo: 'suporte',  acao: 'Resolveu ticket',    entidade: 'DEF Comércio e Serviços ME', detalhe: 'Onboarding concluído' },
];

export default function AdminLogs() {
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<LogTipo | 'todos'>('todos');
  const [filterAdmin, setFilterAdmin] = useState<'todos' | 'humano' | 'sistema'>('todos');

  const filtered = SEED.filter(l => {
    const matchSearch = [l.acao, l.entidade, l.detalhe ?? '', l.admin].some(v =>
      v.toLowerCase().includes(search.toLowerCase()),
    );
    const matchTipo = filterTipo === 'todos' || l.tipo === filterTipo;
    const matchAdmin = filterAdmin === 'todos' ||
      (filterAdmin === 'sistema' && l.admin === 'Sistema') ||
      (filterAdmin === 'humano' && l.admin !== 'Sistema');
    return matchSearch && matchTipo && matchAdmin;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Log de Atividade</h1>
        <p className="text-sm text-slate-500">Auditoria de todas as ações na plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ação, entidade…" className="w-44 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" />
        </div>

        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as LogTipo | 'todos')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 outline-none">
          <option value="todos">Todos os tipos</option>
          {(Object.keys(TIPO_CFG) as LogTipo[]).map(t => (
            <option key={t} value={t}>{TIPO_CFG[t].label}</option>
          ))}
        </select>

        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {(['todos', 'humano', 'sistema'] as const).map(a => (
            <button key={a} onClick={() => setFilterAdmin(a)}
              className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors capitalize ${filterAdmin === a ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              {a === 'todos' ? 'Todos' : a === 'humano' ? 'Admin' : 'Sistema'}
            </button>
          ))}
        </div>

        <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {filtered.length} entradas
        </span>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">Nenhum log encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(l => {
              const t = TIPO_CFG[l.tipo];
              const isSystem = l.admin === 'Sistema';
              return (
                <div key={l.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Dot */}
                  <div className="mt-1.5 flex flex-col items-center shrink-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{l.acao}</p>
                      <span className="text-sm text-slate-400">→</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{l.entidade}</p>
                    </div>
                    {l.detalhe && <p className="mt-0.5 text-xs text-slate-400 truncate">{l.detalhe}</p>}
                  </div>
                  {/* Meta */}
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-medium ${isSystem ? 'text-orange-500' : 'text-slate-600 dark:text-slate-400'}`}>{l.admin}</p>
                    <p className="text-[11px] text-slate-400">{l.quando}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
