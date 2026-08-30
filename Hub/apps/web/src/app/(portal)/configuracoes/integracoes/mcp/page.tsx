import { GlassCard } from '@/components/ui/GlassCard';
import { ArrowLeft, ArrowSquareOut, Sparkle } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { isAdminUser } from '@/lib/server/admin-guard';
import { McpTokensClient } from './McpTokensClient';

export const metadata = {
  title: 'Assistente de IA & API | Hexx',
};

export default async function McpSetupPage() {
  const isAdmin = await isAdminUser();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hexx.com.br';
  const mcpUrl = `${baseUrl}/api/mcp`;

  return (
    <div className="mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4">
        <Link
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1E3328] text-[#DFFFAE] shadow-md">
            <Sparkle className="h-7 w-7" weight="fill" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Assistente de IA & API</h1>
            <p className="mt-1 text-ink-soft">
              Conecte o Claude, o ChatGPT ou um sistema externo pra consultar (e, se o token permitir, lançar) o financeiro
              da sua empresa por fora do Hub.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <GlassCard title="Assistente de IA (MCP) — só leitura">
            <div className="mt-3 space-y-4 text-sm">
              <ol className="relative border-l border-line/70 ml-3 space-y-5">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card text-xs">1</span>
                  <h3 className="font-semibold text-ink text-sm mb-1">Crie um token "Só leitura"</h3>
                  <p className="text-xs text-ink-soft">Dê um nome (ex.: "Claude Desktop") e copie o valor mostrado — ele só aparece uma vez.</p>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card text-xs">2</span>
                  <h3 className="font-semibold text-ink text-sm mb-1">Adicione o servidor MCP no seu assistente</h3>
                  <p className="text-xs text-ink-soft mb-2">No Claude Desktop/Code ou outro cliente MCP compatível com HTTP remoto, use:</p>
                  <div className="rounded-2xl bg-surface-card border border-line p-3 text-xs font-mono text-ink-soft space-y-1 break-all">
                    <p>URL: <span className="text-ink">{mcpUrl}</span></p>
                    <p>Header: <span className="text-ink">Authorization: Bearer &lt;seu token&gt;</span></p>
                  </div>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card text-xs">3</span>
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Guia oficial de configuração do MCP <ArrowSquareOut className="h-3.5 w-3.5" />
              </a>
            </div>
          </GlassCard>

          <GlassCard title="API REST — integração externa (leitura e escrita)">
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-xs text-ink-soft">
                Pra outro sistema (financeiro, ERP, planilha automatizada) lançar ou consultar dados, crie um token{' '}
                <strong>"Leitura e escrita"</strong> e use:
              </p>
              <div className="rounded-2xl bg-surface-card border border-line p-3 text-xs font-mono text-ink-soft space-y-2 break-all">
                <p><span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span> {baseUrl}/api/v1/despesas</p>
                <p><span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span> {baseUrl}/api/v1/faturamento</p>
                <p><span className="text-sky-600 dark:text-sky-400 font-bold">GET</span> {baseUrl}/api/v1/contas?tipo=pagar</p>
              </div>
              <p className="text-xs text-ink-soft">
                Corpo do POST (JSON): <code className="text-ink">descricao</code>, <code className="text-ink">valor</code>,{' '}
                <code className="text-ink">vencimento</code> (AAAA-MM-DD), <code className="text-ink">categoria</code> (opcional).
                Mesmo header <code className="text-ink">Authorization: Bearer &lt;token&gt;</code> do MCP.
              </p>
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3.5">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Escopo importa</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Um token "Só leitura" nunca consegue lançar nada nesses endpoints, mesmo que vaze — só um token
                  "Leitura e escrita" pode. Use "Só leitura" pra assistentes de IA e guarde "Leitura e escrita" só pros
                  sistemas que realmente precisam lançar dado.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm h-fit">
          <McpTokensClient isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
