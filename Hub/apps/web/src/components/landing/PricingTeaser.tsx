'use client';

import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

export function PricingTeaser() {
  const quickPlans = [
    {
      name: 'Hub Start',
      desc: 'Para quem já possui contabilidade externa e busca controle financeiro ágil, NFSe e contratos.',
      price: 'R$ 149',
      period: '/mês',
      featured: false,
      tag: 'Autogestão',
      highlight: 'Caixa realtime + NFSe 1-clique + Contratos',
    },
    {
      name: 'Hub Pro + Contabilidade',
      desc: 'A experiência definitiva com contador dedicado no WhatsApp, guias DAS e declarações inclusas.',
      price: 'R$ 389',
      period: '/mês',
      featured: true,
      tag: 'Mais Escolhido',
      highlight: 'Hub Completo + Contador Dedicado + DAS no Prazo',
    },
    {
      name: 'Holding & Private',
      desc: 'Gestão patrimonial, societária e tributária para famílias, múltiplos imóveis e bens.',
      price: 'R$ 890',
      period: '/mês',
      featured: false,
      tag: 'Patrimonial',
      highlight: 'Múltiplos Imóveis + Proteção Societária',
    },
  ];

  return (
    <section className="pricing-sec" id="planos" style={{ padding: '80px 0' }}>
      <div className="landing-wrap">
        <div className="pricing-head reveal in" style={{ marginBottom: '40px' }}>
          <span className="hero-eyebrow">
            <Sparkles className="h-3.5 w-3.5 inline mr-1 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Investimento Transparente
          </span>
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.025em', marginTop: '10px' }}>
            Planos sob medida para o momento da sua empresa.
          </h2>
          <p style={{ maxWidth: '600px', margin: '12px auto 0' }}>
            Sem fidelidade contratual, sem surpresas no fim do mês e com suporte direto de quem entende do seu negócio.
          </p>
        </div>

        {/* Mini Cards dos 3 Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {quickPlans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                plan.featured
                  ? 'bg-[#1C180D] text-[#FEFDF3] shadow-2xl border-2 border-[#DFFFAE] relative md:scale-[1.03]'
                  : 'bg-[#F4EFE4] text-[#231F20] border border-black/10 hover:border-black/20 shadow-sm hover:-translate-y-1'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3.5 right-6 bg-[#DFFFAE] text-[#1E3328] font-bold text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                  {plan.tag}
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xl tracking-tight">{plan.name}</h3>
                  {!plan.featured && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] bg-black/5 px-2.5 py-0.5 rounded-full">
                      {plan.tag}
                    </span>
                  )}
                </div>

                <div className="my-4">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">{plan.price}</span>
                  <span className={`text-xs ml-1 font-semibold ${plan.featured ? 'text-[#FEFDF3]/70' : 'text-[#6E6A61]'}`}>
                    {plan.period}
                  </span>
                </div>

                <p className={`text-xs leading-relaxed mb-6 ${plan.featured ? 'text-[#FEFDF3]/80' : 'text-[#6E6A61]'}`}>
                  {plan.desc}
                </p>

                <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-6 ${
                  plan.featured ? 'bg-white/10 text-[#DFFFAE]' : 'bg-white/70 text-[#2F4A3C] border border-black/5'
                }`}>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{plan.highlight}</span>
                </div>
              </div>

              <Link
                href="/planos"
                className={`w-full py-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  plan.featured
                    ? 'bg-[#DFFFAE] text-[#1E3328] hover:bg-white shadow-sm'
                    : 'bg-[#1E3328] text-[#DFFFAE] hover:bg-[#2F4A3C]'
                }`}
              >
                Experimentar o Hub
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* CTA para a Página Completa */}
        <div className="text-center pt-2">
          <Link
            href="/planos"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 text-xs font-bold text-[#231F20] hover:bg-[#F4EFE4] transition-all shadow-sm group"
          >
            <span>Ver Matriz Comparativa Completa de Recursos &amp; Valores</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-[#1E3328]" />
          </Link>
        </div>
      </div>
    </section>
  );
}

