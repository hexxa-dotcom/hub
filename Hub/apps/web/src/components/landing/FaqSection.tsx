'use client';

import { useState } from 'react';

export function FaqSection() {
  const faqs = [
    {
      q: 'A Hexx é só uma contabilidade?',
      a: 'Não. A contabilidade é a base — o que você recebe é um hub completo de gestão: finanças, contratos, assinatura digital, impostos e relatórios, com um time que conhece empresas de serviço por dentro.',
    },
    {
      q: 'O que é o Hexx Hub?',
      a: 'É a plataforma all-in-one da Hexx Digital: gestão financeira, contratos, assinatura digital, cálculo automático de impostos e relatórios — tudo em um só lugar, com a contabilidade da Hexx nos bastidores.',
    },
    {
      q: 'Pra quem é o Hub?',
      a: 'Para empresas de serviço — principalmente profissionais autônomos que tocam o negócio sozinhos ou com equipe enxuta: consultores, designers, desenvolvedores, terapeutas, advogados e afins.',
    },
    {
      q: 'Ainda não tenho CNPJ. Posso usar?',
      a: 'Pode — a gente abre pra você. A Hexx cuida da abertura do CNPJ, escolhe o enquadramento tributário certo e já entrega sua empresa funcionando dentro do Hub.',
    },
    {
      q: 'A assinatura digital tem validade jurídica?',
      a: 'Sim. Os contratos assinados pelo Hub seguem a legislação brasileira de assinaturas eletrônicas, com trilha de auditoria completa: quem assinou, quando e de onde.',
    },
    {
      q: 'Como funciona o cálculo automático de impostos?',
      a: 'O Hub acompanha seu faturamento, calcula os impostos do seu enquadramento, gera as guias e avisa antes do vencimento. Você só confirma o pagamento — sem susto no fim do mês.',
    },
    {
      q: 'Já tenho contador. Consigo migrar?',
      a: 'Sim, e a migração é por nossa conta. A Hexx solicita os documentos ao seu contador atual e faz toda a transição sem burocracia pra você.',
    },
    {
      q: 'Como funcionam os planos e pagamentos?',
      a: 'Você pode contratar diretamente pelo site ou falar com um consultor. Sem taxas escondidas, com cobrança mensal e total transparência.',
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="faq" id="faq">
      <div className="landing-wrap">
        <h2 className="landing-serif reveal in">Perguntas Frequentes</h2>
        <div className="faq-grid reveal in">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <details
                key={i}
                className="faq-item"
                open={isOpen}
                onClick={(e) => {
                  e.preventDefault();
                  toggle(i);
                }}
              >
                <summary>
                  <span>{faq.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="ans">{faq.a}</div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
