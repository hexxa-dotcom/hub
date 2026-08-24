'use client';

import { ShieldCheck, CheckCircle2, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';

type HealthScoreCardProps = {
  tudoEmDia: boolean;
  fatorR: number;
  anexo: string;
  /** versão reduzida, pra caber lado a lado com outros cards num grid de 3 colunas */
  compact?: boolean;
};

export function HealthScoreCard({ tudoEmDia, fatorR, anexo, compact = false }: HealthScoreCardProps) {
  if (compact) {
    return (
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 md:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE]">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <h2 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">
                Saúde Fiscal
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-2.5 py-0.5 text-[10px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] animate-pulse" />
              {tudoEmDia ? 'Conforme' : 'Atenção'}
            </span>
          </div>

          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
              <span className="text-[#6E6A61] dark:text-[#A8A49C]">Simples Nacional em conformidade</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
              <span className="text-[#6E6A61] dark:text-[#A8A49C]">Anexo {anexo} · Fator R {(fatorR * 100).toFixed(1)}%</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
              <span className="text-[#6E6A61] dark:text-[#A8A49C]">Certidões (CND) vigentes</span>
            </li>
          </ul>
        </div>

        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
          <Sparkles className="h-3 w-3 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Hexxa Realtime
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
              Saúde Fiscal &amp; Contábil
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-3 py-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]/50">
            <span className="h-2 w-2 rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] animate-pulse" />
            {tudoEmDia ? 'Conforme 100%' : 'Atenção Necessária'}
          </span>
        </div>

        <div className="space-y-3.5 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Receita Federal &amp; Simples Nacional</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Declarações e apurações em conformidade ativa.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Enquadramento Tributário Otimizado</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                Anexo {anexo} com Fator R de {(fatorR * 100).toFixed(1)}% (tributação reduzida).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE] mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Certidões Negativas de Débito (CND)</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Federal, Estadual e Trabalhista vigentes.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Monitoramento Contábil Ativo
        </span>
        <span className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Hexxa Realtime</span>
      </div>
    </div>
  );
}
