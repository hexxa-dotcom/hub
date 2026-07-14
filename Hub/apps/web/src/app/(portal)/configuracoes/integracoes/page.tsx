import { GlassCard } from '@/components/ui/GlassCard';
import { Cable, CheckCircle2, RefreshCw, XCircle, ArrowRightLeft, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Integrações Financeiras | Hexx',
};

const BASE_ERPS = [
  { 
    id: 'contaazul', 
    name: 'Conta Azul', 
    desc: 'Sincronize lançamentos, clientes e fornecedores automaticamente.', 
    color: '#2684FF',
    logo: 'CA'
  },
  { 
    id: 'nibo', 
    name: 'Nibo', 
    desc: 'Integração completa de contas a pagar e receber do Nibo.', 
    color: '#00C389',
    logo: 'NB'
  },
  { 
    id: 'bling', 
    name: 'Bling', 
    desc: 'Gestão financeira e notas fiscais sincronizadas com ERP.', 
    color: '#2C3E50',
    logo: 'BL'
  },
  { 
    id: 'omie', 
    name: 'Omie', 
    desc: 'Importe faturamento e despesas automaticamente do Omie.', 
    color: '#FF7D00',
    logo: 'OM'
  },
  { 
    id: 'vhsys', 
    name: 'vHsys', 
    desc: 'Controle de caixa e relatórios integrados ao vHsys.', 
    color: '#00A859',
    logo: 'VH'
  },
  { 
    id: 'asaas', 
    name: 'Asaas (Gateway)', 
    desc: 'Gere cobranças via PIX e Boleto automaticamente (Sem taxas fixas).', 
    color: '#0030B9',
    logo: 'AS'
  },
];

export default async function IntegracoesPage() {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();
  
  // Buscar integrações ativas
  const { data: credentials } = await supabase
    .from('integration_credential')
    .select('provider, active')
    .eq('company_id', ctx.companyId)
    .eq('active', true);

  const connectedMap = new Map((credentials || []).map((c: any) => [c.provider, c]));

  const ERPS = BASE_ERPS.map(erp => {
    const isConnected = connectedMap.has(erp.id);
    return {
      ...erp,
      connected: isConnected,
      lastSync: isConnected ? 'Há pouco' : null,
      items: isConnected ? 0 : 0
    };
  });
  return (
    <div className="mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              <Cable className="h-3.5 w-3.5" /> Integrações
            </span>
            <span className="text-xs font-medium text-ink-soft bg-surface-card px-2.5 py-1 rounded-full border border-line shadow-sm">
              Beta
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sistemas Financeiros (ERP)</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-2xl">
            Conecte o seu software de gestão para centralizar contas a pagar, receber e faturamento direto no nosso Hub Financeiro. 
            Sem necessidade de exportar planilhas.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/suporte" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1.5 transition-colors">
            Pedir nova integração <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Grid de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {ERPS.map((erp) => (
          <GlassCard key={erp.id} title="" className="flex flex-col relative overflow-hidden group">
            {/* Decoração superior */}
            <div className="absolute top-0 left-0 right-0 h-1.5 opacity-80" style={{ backgroundColor: erp.color }} />
            
            <div className="flex items-start justify-between mb-4 mt-2">
              <div className="flex items-center gap-3">
                {/* Logo Mock */}
                <div 
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-black text-xl shadow-md transition-transform group-hover:scale-105"
                  style={{ backgroundColor: erp.color }}
                >
                  {erp.logo}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-ink leading-tight">{erp.name}</h3>
                  {erp.connected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft mt-0.5">
                      <XCircle className="h-3 w-3" /> Desconectado
                    </span>
                  )}
                </div>
              </div>
              
              {/* Toggle Simulado */}
              <button 
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${erp.connected ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'}`}
                aria-label={`Alternar integração ${erp.name}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${erp.connected ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <p className="text-sm text-ink-soft mb-6 flex-1">
              {erp.desc}
            </p>

            {erp.connected ? (
              <div className="rounded-xl bg-black/[0.07] dark:bg-white/5 p-3.5 mt-auto">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-ink-soft font-medium">Última sincronização</span>
                  <span className="text-ink font-semibold flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-brand-500" /> {erp.lastSync}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-soft font-medium">Registros importados</span>
                  <span className="text-ink font-semibold">{erp.items} itens</span>
                </div>
              </div>
            ) : (
              <div className="mt-auto pt-4 border-t border-line/50 flex items-center justify-between">
                <span className="text-xs text-ink-soft">Integração nativa via API</span>
                {['bling', 'omie', 'contaazul', 'nibo', 'asaas'].includes(erp.id) ? (
                  <Link href={`/configuracoes/integracoes/${erp.id}` as Route} className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 transition-colors">
                    Configurar <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button className="text-sm font-semibold text-ink-soft cursor-not-allowed flex items-center gap-1 transition-colors" disabled>
                    Em breve <ArrowRight className="h-4 w-4 opacity-50" />
                  </button>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      {/* Seção Explicativa / Como funciona */}
      <GlassCard title="" className="mt-8">
        <div className="flex flex-col md:flex-row items-center gap-8 p-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
              <ArrowRightLeft className="h-5 w-5 text-brand-500" />
              Como funciona a sincronização?
            </h3>
            <p className="text-sm text-ink-soft mb-4 leading-relaxed">
              Ao conectar o seu ERP, nós estabelecemos uma conexão segura de leitura (read-only) via API. 
              Nenhum dado é modificado no seu sistema de origem. Importamos contas a pagar, contas a receber e clientes/fornecedores 
              para que a nossa equipe contábil consiga realizar a conciliação bancária de forma 100% automatizada.
            </p>
            <ul className="text-sm space-y-2 text-ink-soft">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" /> Automação de lançamentos</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" /> Visão centralizada do fluxo de caixa</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" /> Eliminação total de planilhas manuais</li>
            </ul>
          </div>
          <div className="shrink-0 w-full md:w-auto flex justify-center">
            <div className="relative w-64 h-48 rounded-[2rem] bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 border border-brand-200/50 dark:border-brand-700/50 flex items-center justify-center shadow-inner overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(var(--color-brand-500) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              <div className="relative z-10 flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white dark:bg-surface-card shadow-lg flex items-center justify-center font-bold text-brand-600 text-xl border border-line">
                  CA
                </div>
                <div className="flex flex-col gap-1.5 items-center">
                  <div className="h-1.5 w-8 bg-brand-400 rounded-full animate-pulse" />
                  <div className="h-1.5 w-8 bg-brand-400 rounded-full animate-pulse delay-75" />
                  <div className="h-1.5 w-8 bg-brand-400 rounded-full animate-pulse delay-150" />
                </div>
                <div className="h-14 w-14 rounded-2xl bg-brand-600 shadow-lg flex items-center justify-center font-bold text-white text-xl border border-brand-500">
                  H
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
