'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, CreditCard, Mail, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type RiscoItem = {
  id: string;
  nome: string;
  email: string;
  plano: string;
  valor: number;
  tipo: 'trial' | 'inadimplente';
  diasRestantes?: number;
  diasAtraso?: number;
  asaasSubId?: string;
  acoes: ('cobrar' | 'email' | 'resolver')[];
  resolved: boolean;
};

const SEED: RiscoItem[] = [
  {
    id: '1', nome: 'Studio Criativo LTDA', email: 'hello@studiocriativo.com',
    plano: 'Crescimento', valor: 299.90, tipo: 'trial', diasRestantes: 3,
    acoes: ['cobrar', 'email'], resolved: false,
  },
  {
    id: '2', nome: 'Advocacia Mendes Associados', email: 'adv@mendesassociados.com.br',
    plano: 'Início', valor: 149.90, tipo: 'inadimplente', diasAtraso: 45,
    asaasSubId: 'sub_demo_123',
    acoes: ['cobrar', 'email', 'resolver'], resolved: false,
  },
];

type AcaoState = Record<string, 'idle' | 'loading' | 'done' | 'error'>;

export default function AdminRenovacoes() {
  const [items, setItems] = useState(SEED);
  const [estados, setEstados] = useState<AcaoState>({});

  function setEstado(key: string, val: AcaoState[string]) {
    setEstados(prev => ({ ...prev, [key]: val }));
  }

  async function cobrar(item: RiscoItem) {
    const key = `cobrar-${item.id}`;
    setEstado(key, 'loading');
    await new Promise(r => setTimeout(r, 1500));
    // Em produção: POST /api/asaas/subscriptions com o customerId do cliente
    setEstado(key, 'done');
  }

  async function enviarEmail(item: RiscoItem) {
    const key = `email-${item.id}`;
    setEstado(key, 'loading');
    await new Promise(r => setTimeout(r, 800));
    setEstado(key, 'done');
  }

  function resolver(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, resolved: true } : i));
  }

  const trials = items.filter(i => i.tipo === 'trial' && !i.resolved);
  const inadimplentes = items.filter(i => i.tipo === 'inadimplente' && !i.resolved);
  const resolvidos = items.filter(i => i.resolved);

  function AcaoBtn({ estado, onClick, icon: Icon, label, cls }: {
    estado: AcaoState[string]; onClick: () => void;
    icon: React.FC<{ className?: string }>; label: string; cls: string;
  }) {
    return (
      <button type="button" onClick={onClick} disabled={estado === 'loading' || estado === 'done'}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
          estado === 'done' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : cls
        }`}>
        {estado === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
          estado === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        {estado === 'done' ? 'Feito' : label}
      </button>
    );
  }

  function Card({ item }: { item: RiscoItem }) {
    const urgente = (item.tipo === 'trial' && (item.diasRestantes ?? 0) <= 2) ||
      (item.tipo === 'inadimplente' && (item.diasAtraso ?? 0) >= 30);

    return (
      <div className={`rounded-2xl border p-5 shadow-sm ${urgente
        ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
        : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-900/10'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {urgente
                ? <AlertTriangle className="h-4 w-4 text-red-500" />
                : <Clock className="h-4 w-4 text-yellow-500" />}
              <p className="font-semibold text-slate-900 dark:text-white">{item.nome}</p>
            </div>
            <p className="text-xs text-slate-500">{item.email}</p>
            <p className="text-xs text-slate-500 mt-0.5">Plano {item.plano} · {BRL.format(item.valor)}/mês</p>
          </div>
          <div className="shrink-0 text-right">
            {item.tipo === 'trial' && (
              <span className={`text-sm font-bold ${item.diasRestantes! <= 2 ? 'text-red-600' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {item.diasRestantes} dia{item.diasRestantes !== 1 ? 's' : ''} restante{item.diasRestantes !== 1 ? 's' : ''}
              </span>
            )}
            {item.tipo === 'inadimplente' && (
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {item.diasAtraso} dias em atraso
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.acoes.includes('cobrar') && (
            <AcaoBtn
              estado={estados[`cobrar-${item.id}`] ?? 'idle'}
              onClick={() => cobrar(item)}
              icon={CreditCard}
              label={item.tipo === 'trial' ? 'Criar assinatura' : 'Cobrar agora (Asaas)'}
              cls="bg-brand-500 text-white hover:bg-brand-600"
            />
          )}
          {item.acoes.includes('email') && (
            <AcaoBtn
              estado={estados[`email-${item.id}`] ?? 'idle'}
              onClick={() => enviarEmail(item)}
              icon={Mail}
              label={item.tipo === 'trial' ? 'E-mail de conversão' : 'E-mail de cobrança'}
              cls="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            />
          )}
          {item.acoes.includes('resolver') && (
            <button type="button" onClick={() => resolver(item.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-700 dark:bg-slate-800 dark:text-green-400 transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar regularizado
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Renovações em Risco</h1>
        <p className="text-sm text-slate-500">Trials expirando e clientes inadimplentes que precisam de ação</p>
      </div>

      {trials.length === 0 && inadimplentes.length === 0 && resolvidos.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-400" />
          <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">Nenhuma renovação em risco!</p>
          <p className="text-sm text-slate-400">Todos os clientes estão em dia.</p>
        </div>
      )}

      {trials.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
            <Clock className="h-4 w-4" /> Trials expirando ({trials.length})
          </h2>
          {trials.map(i => <Card key={i.id} item={i} />)}
        </section>
      )}

      {inadimplentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Inadimplentes ({inadimplentes.length})
          </h2>
          {inadimplentes.map(i => <Card key={i.id} item={i} />)}
        </section>
      )}

      {resolvidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Resolvidos ({resolvidos.length})
          </h2>
          {resolvidos.map(i => (
            <div key={i.id} className="rounded-2xl border border-green-200 bg-green-50 p-4 opacity-60 dark:border-green-900/30 dark:bg-green-900/10">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ {i.nome}</p>
              <p className="text-xs text-green-600 dark:text-green-500">Regularizado</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
