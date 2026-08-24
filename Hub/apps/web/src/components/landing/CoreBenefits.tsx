'use client';

import Link from 'next/link';
import { ArrowRight, Receipt, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';

export function CoreBenefits() {
  const benefits = [
    {
      icon: <Receipt className="h-6 w-6 text-[#1E3328]" />,
      badge: 'Agilidade',
      title: 'Emissão de NFSe com 1 Clique',
      desc: 'Esqueça os portais lentos da prefeitura. Emita notas fiscais de serviço em segundos, com envio automático de PDF e XML para o seu cliente.',
      highlight: 'Sem burocracia municipal',
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-[#1E3328]" />,
      badge: 'Clareza Total',
      title: 'Fluxo de Caixa & Lucro Real',
      desc: 'Conciliação inteligente das suas contas PJ. Saiba exatamente quanto faturou, suas despesas e quanto sobra de lucro líquido no fim do mês.',
      highlight: 'DRE e saldo em tempo real',
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-[#1E3328]" />,
      badge: 'Economia Legal',
      title: 'Impostos Otimizados & DAS no Prazo',
      desc: 'Planejamento tributário consultivo com Fator R para você pagar a menor alíquota legal do Simples Nacional, sem risco de multas.',
      highlight: 'Contador dedicado no WhatsApp',
    },
  ];

  return (
    <section className="py-20 bg-[#FEFDF3] dark:bg-[#121614] border-t border-black/5 dark:border-white/5" id="beneficios">
      <div className="landing-wrap max-w-6xl mx-auto px-4">
        {/* Cabeçalho da Seção */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/10 dark:border-white/10 px-3.5 py-1 text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE]">
            <Sparkles className="h-3.5 w-3.5" /> Como a Hexx simplifica sua vida
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
            Tudo o que você precisa para operar sem dor de cabeça.
          </h2>
          <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed">
            Elimine ferramentas avulsas e planilhas confusas. A plataforma financeira e a contabilidade consultiva trabalham juntas para você focar no que importa: faturar.
          </p>
        </div>

        {/* 3 Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/10 dark:border-white/10 p-7 flex flex-col justify-between hover:shadow-md hover:border-black/20 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DFFFAE] shadow-sm group-hover:scale-105 transition-transform">
                    {b.icon}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] bg-white/60 dark:bg-white/5 px-2.5 py-1 rounded-full border border-black/5 dark:border-white/5">
                    {b.badge}
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#FEFDF3] mb-2.5">
                  {b.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed mb-6">
                  {b.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE]">
                <span>{b.highlight}</span>
                <span className="text-sm">✓</span>
              </div>
            </div>
          ))}
        </div>

        {/* Link para o tour detalhado */}
        <div className="text-center">
          <Link
            href="/recursos"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline"
          >
            <span>Quer ver as telas e funcionalidades detalhadas? Acesse o Tour do Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
