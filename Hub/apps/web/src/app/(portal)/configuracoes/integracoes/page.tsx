import { Plug, CheckCircle2, XCircle, ArrowRight, ExternalLink, Sparkles, Mail } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential, emailAccount } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { IntegrationStatusBlock } from './IntegrationStatusBlock';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Integrações Financeiras | Hexx Digital',
};

const BASE_ERPS = [
  {
    id: 'asaas',
    name: 'Asaas',
    sub: 'Gateway de Pagamentos & Pix',
    desc: 'Integração para emissão de cobranças via PIX e Boleto para seus clientes com baixa automática.',
    color: '#0030B9',
    logo: 'AS',
  },
  {
    id: 'omie',
    name: 'Omie / OneFlow',
    sub: 'Contabilidade e ERP',
    desc: 'Sincronização em tempo real de Lançamentos e Baixas diretamente para o seu balanço contábil.',
    color: '#F48221',
    logo: 'OM',
  },
  {
    id: 'webhook-repasse',
    name: 'Faturamento do SaaS do Cliente',
    sub: 'Repasse automático por webhook',
    desc: 'Recebe o faturamento do SaaS que você usa (ex.: telemedicina) em tempo real e gera automaticamente o valor a pagar de cada prestador vinculado, com base no % de repasse do contrato dele.',
    color: '#7C3AED',
    logo: 'WR',
  },
];

export default async function IntegracoesPage() {
  const ctx = await getTenantContext();

  // Buscar integrações ativas
  const credentials = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        provider: integrationCredential.provider,
        active: integrationCredential.active,
      })
      .from(integrationCredential)
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.active, true)
        )
      );
  });

  const connectedMap = new Map((credentials || []).map((c: any) => [c.provider, c]));

  const ERPS = BASE_ERPS.map(erp => ({
    ...erp,
    connected: connectedMap.has(erp.id),
  }));

  // E-mail não usa integration_credential (fica em email_account, tabela
  // própria — IMAP/SMTP, não API key) — checado à parte.
  const [emailAcc] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select({ isActive: emailAccount.isActive }).from(emailAccount).where(eq(emailAccount.companyId, ctx.companyId));
  });
  const emailConnected = emailAcc?.isActive ?? false;

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="rotulo text-ink-soft">Conexões</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Conecte o gateway de pagamento, assistente de IA e serviços externos para centralizar rotinas contábeis.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/suporte"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) hover:brightness-105 active:scale-95 transition-all"
          >
            Solicitar nova conexão <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Assistente de IA (MCP) */}
      <Link href={'/configuracoes/integracoes/mcp' as Route} className="block group">
        <Card level={2} tone="deep" className="card-finish p-6 relative overflow-hidden transition-all group-hover:brightness-105">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-hexxa-forest/20 text-hexxa-forest dark:bg-hexxa-lime/20 dark:text-hexxa-lime">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-bold text-base text-ink">Assistente de IA & API Externa (MCP)</h3>
              <p className="text-xs text-ink-soft mt-0.5">
                Conecte o Claude, ChatGPT ou sistemas externos para consultar relatórios e realizar lançamentos financeiros com tokens seguros.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime shrink-0 transition-transform group-hover:translate-x-1" />
          </div>
        </Card>
      </Link>

      {/* Grid de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {ERPS.map((erp) => (
          <Card key={erp.id} level={1} className="p-6 flex flex-col justify-between relative overflow-hidden group">
            {/* Decoração superior */}
            <div className="absolute top-0 left-0 right-0 h-1 opacity-80" style={{ backgroundColor: erp.color }} />
            
            <div>
              <div className="flex items-start justify-between mb-4 mt-1">
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-serif font-black text-xl shadow-(--elev-1) transition-transform group-hover:scale-105"
                    style={{ backgroundColor: erp.color }}
                  >
                    {erp.logo}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-ink leading-tight">{erp.name}</h3>
                    <p className="text-[11px] text-ink-soft">{erp.sub}</p>
                    {erp.connected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft mt-1">
                        <XCircle className="h-3.5 w-3.5" /> Não configurado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-ink-soft leading-relaxed mb-6">
                {erp.desc}
              </p>
            </div>

            {erp.connected ? (
              <IntegrationStatusBlock providerId={erp.id} />
            ) : (
              <div className="pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-ink-soft">Via API Segura</span>
                <Link
                  href={`/configuracoes/integracoes/${erp.id}` as Route}
                  className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
                >
                  Configurar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </Card>
        ))}

        {/* E-mail (IMAP/SMTP) */}
        <Card level={1} className="p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 opacity-80 bg-hexxa-forest" />
          <div>
            <div className="flex items-start justify-between mb-4 mt-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) transition-transform group-hover:scale-105">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-ink leading-tight">E-mail (NFS-e)</h3>
                  <p className="text-[11px] text-ink-soft">Envio automático por e-mail</p>
                  {emailConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft mt-1">
                      <XCircle className="h-3.5 w-3.5" /> Não configurado
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed mb-6">
              Conecte a caixa de e-mail (IMAP/SMTP) que a Hexx usa para encaminhar a NFS-e automaticamente para o tomador assim que ela for autorizada.
            </p>
          </div>
          <div className="pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-ink-soft">IMAP / SMTP</span>
            <Link
              href={'/configuracoes/integracoes/email' as Route}
              className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
            >
              {emailConnected ? 'Gerenciar' : 'Configurar'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>

    </div>
  );
}
