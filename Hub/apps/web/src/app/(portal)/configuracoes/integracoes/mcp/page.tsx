import { Card } from '@/components/ui/Card';
import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { isAdminUser } from '@/lib/server/admin-guard';
import { McpTokensClient } from './McpTokensClient';

export const metadata = {
  title: 'Assistente de IA & API | Hexxa Hub',
};

export default async function McpSetupPage() {
  const isAdmin = await isAdminUser();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hexx.com.br';
  const mcpUrl = `${baseUrl}/api/mcp`;

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-1)">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">Assistente de IA & API</h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft">
              Conecte o Claude, o ChatGPT ou um sistema externo para consultar e lançar dados financeiros da sua empresa com segurança.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card level={1} className="p-6 sm:p-8 space-y-4">
            <h2 className="font-serif font-bold text-base text-ink">Assistente de IA (MCP) — só leitura</h2>
            <div className="mt-3 space-y-4 text-sm">
              <ol className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-6">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">1</span>
                  <h3 className="font-semibold text-ink text-sm mb-1">Crie um token "Só leitura"</h3>
                  <p className="text-xs text-ink-soft">Dê um nome (ex.: "Claude Desktop") e copie o valor gerado — ele só aparece uma vez.</p>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">2</span>
                  <h3 className="font-semibold text-ink text-sm mb-1">Adicione o servidor MCP no seu assistente</h3>
                  <p className="text-xs text-ink-soft mb-2">No Claude Desktop/Code ou outro cliente MCP compatível com HTTP remoto, use:</p>
                  <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3 text-xs font-mono text-ink-soft space-y-1 break-all">
                    <p>URL: <span className="text-ink font-semibold">{mcpUrl}</span></p>
                    <p>Header: <span className="text-ink font-semibold">Authorization: Bearer &lt;seu token&gt;</span></p>
                  </div>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">3</span>
                  <h3 className="font-semibold text-ink text-sm mb-1">Pergunte</h3>
                  <p className="text-xs text-ink-soft">
                    "Como está o faturamento desse mês?", "Quanto tenho a pagar essa semana?", "Me dá o resumo de julho".
                  </p>
                </li>
              </ol>

              <a
                href="https://modelcontextprotocol.io/quickstart/user"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline pt-2"
              >
                Guia oficial de configuração do MCP <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Card>

          <Card level={1} className="p-6 sm:p-8 space-y-4">
            <h2 className="font-serif font-bold text-base text-ink">API REST — integração externa (leitura e escrita)</h2>
            <div className="space-y-3 text-sm">
              <p className="text-xs text-ink-soft">
                Para outro sistema (financeiro, ERP, planilha automatizada) lançar ou consultar dados, crie um token{' '}
                <strong className="text-ink">"Leitura e escrita"</strong> e use:
              </p>
              <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3 text-xs font-mono text-ink-soft space-y-2 break-all">
                <p><span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span> {baseUrl}/api/v1/despesas</p>
                <p><span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span> {baseUrl}/api/v1/faturamento</p>
                <p><span className="text-sky-600 dark:text-sky-400 font-bold">GET</span> {baseUrl}/api/v1/contas?tipo=pagar</p>
              </div>
              <p className="text-xs text-ink-soft">
                Corpo do POST (JSON): <code className="text-ink">descricao</code>, <code className="text-ink">valor</code>,{' '}
                <code className="text-ink">vencimento</code> (AAAA-MM-DD), <code className="text-ink">categoria</code> (opcional).
                Mesmo header <code className="text-ink">Authorization: Bearer &lt;token&gt;</code> do MCP.
              </p>
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 shadow-(--elev-1)">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Escopo importa</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Um token "Só leitura" nunca consegue lançar nada nesses endpoints, mesmo que seja compartilhado — apenas tokens
                  "Leitura e escrita" possuem permissão. Recomendamos "Só leitura" para assistentes de IA pessoais.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <McpTokensClient isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
