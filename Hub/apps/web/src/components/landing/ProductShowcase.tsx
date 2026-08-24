'use client';

import { useState } from 'react';
import Link from 'next/link';

const tabs = [
  {
    id: 'finance',
    name: 'Caixa & Cobranças',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: 'Fluxo de caixa inteligente, conciliação e cobranças Pix/Boleto',
    desc: 'Cada centavo que entra ou sai da sua empresa é categorizado automaticamente. Emita cobranças via Pix dinâmico ou boleto com baixa automática direta no caixa.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Saldo Disponível · Conta PJ
          </span>
          <span className="mock-pill">Conciliação Automática ✓</span>
        </div>
        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--ink)', marginBottom: '20px', letterSpacing: '-0.025em' }}>
          R$ 48.920,00
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Contrato Mensal · Cliente Prime</span>
            <span className="pos">+ R$ 14.500,00</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Cobrança Pix Liquidada (Asaas)</span>
            <span className="pos">+ R$ 6.800,00</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Servidores &amp; Ferramentas SaaS</span>
            <span className="neg">− R$ 840,00</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'nfse',
    name: 'NFSe 1-Clique',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    title: 'Emita notas fiscais de serviço em segundos com 1 clique',
    desc: 'Integração direta com o Sefin Nacional e mais de 1.500 prefeituras pelo Focus NFe. Envio automático de PDF e XML para o e-mail do tomador com cálculo de retenções.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            NFSe #00914 · Autorizada
          </span>
          <span className="mock-pill">Sefin Nacional / Focus</span>
        </div>
        <div style={{ padding: '16px', background: 'var(--beige)', borderRadius: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Tomador do Serviço</div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>Nexus Tecnologia &amp; Inovação S.A.</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>CNPJ: 38.912.441/0001-08</div>
        </div>
        <div className="mock-row">
          <span>Valor dos serviços</span>
          <span style={{ fontWeight: 800 }}>R$ 18.000,00</span>
        </div>
        <div className="mock-row">
          <span>DANFSE &amp; XML</span>
          <span className="mock-pill">Enviado por E-mail</span>
        </div>
      </div>
    ),
  },
  {
    id: 'contracts',
    name: 'Propostas & Contratos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
        <path d="M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z" />
      </svg>
    ),
    title: 'Do orçamento ao contrato com assinatura digital válida (DocuSeal)',
    desc: 'Crie propostas comerciais profissionais. Ao serem aprovadas pelo cliente, o contrato é assinado digitalmente com validade jurídica ICP-Brasil e log de auditoria.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Contrato de Prestação de Serviços
          </span>
          <span className="mock-pill">100% Assinado (ICP-Brasil)</span>
        </div>
        <div style={{ textAlign: 'center', padding: '20px 0 14px' }}>
          <div className="sigline" style={{ display: 'inline-block', fontSize: '24px', fontWeight: 700 }}>
            Filipe Heck
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontWeight: 600 }}>
            Trilha de Auditoria: IP 179.184.22.10 · Hash SHA-256 Validado
          </div>
        </div>
        <div className="mock-row">
          <span>Proposta Comercial</span>
          <span className="mock-pill">Aceita pelo Cliente</span>
        </div>
        <div className="mock-row">
          <span>Faturamento Automático</span>
          <span className="mock-pill">Vinculado ao Contrato</span>
        </div>
      </div>
    ),
  },
  {
    id: 'tax',
    name: 'Termômetro Tributário',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Monitore seu Fator R (28%) e pague a menor alíquota (6% vs 15,5%)',
    desc: 'O Hub calcula sua proporção de folha/pró-labore sobre o faturamento mês a mês para garantir o enquadramento no Anexo III, economizando milhares de reais em impostos.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Termômetro do Fator R · Mês Atual
          </span>
          <span className="mock-pill">Anexo III Otimizado (6%)</span>
        </div>
        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ink)', marginBottom: '4px', letterSpacing: '-0.025em' }}>
          Fator R: 28.4%
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600, marginBottom: '16px' }}>
          Economia estimada de R$ 2.450,00 neste mês
        </div>
        <div className="mock-row">
          <span>Guia DAS do Mês</span>
          <span style={{ fontWeight: 800 }}>R$ 720,00</span>
        </div>
        <div className="mock-row">
          <span>Pagamento via Pix</span>
          <span className="mock-pill">Copia e Cola</span>
        </div>
      </div>
    ),
  },
  {
    id: 'vault',
    name: 'Lucros & Cofre',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: 'Distribuição de lucros isenta de IR e cofre fiscal seguro',
    desc: 'Saiba exatamente quanto transferir para sua conta pessoa física 100% isento de Imposto de Renda, com certidões negativas (CNDs) e balanços arquivados na nuvem.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Distribuição de Lucros &amp; Cofre
          </span>
          <span className="mock-pill">100% Isento de IRPF</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>Lucro Contábil Disponível</span>
            <span className="pos">R$ 24.800,00</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>CND Federal (Receita Federal)</span>
            <span className="pos">Emitida &amp; Válida ✓</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>DRE Gerencial Consolidado</span>
            <span className="mock-pill gray">PDF Disponível</span>
          </div>
        </div>
      </div>
    ),
  },
];

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="showcase-sec" id="hub-por-dentro">
      <div className="landing-wrap">
        <div className="showcase-head reveal in">
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.025em' }}>Tudo o que sua empresa de serviço precisa. Em uma só tela.</h2>
          <p>
            Diga adeus à colcha de retalhos de vários softwares avulsos. No Hexx Hub você tem autonomia total para gerenciar seu negócio com a contabilidade operando em tempo real.
          </p>
        </div>

        <div className="showcase-tabs reveal in">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              className={`showcase-tab ${activeTab === i ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="showcase-window reveal in">
          <div className="showcase-bar">
            <div className="showcase-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="showcase-title">Hexx Hub · {tabs[activeTab]?.name}</div>
            <div style={{ width: '40px' }}></div>
          </div>

          <div className="showcase-body">
            <div className="showcase-info">
              <h3 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px' }}>{tabs[activeTab]?.title}</h3>
              <p style={{ lineHeight: 1.6, opacity: 0.85 }}>{tabs[activeTab]?.desc}</p>
              <Link href="/planos" className="btn-landing btn-landing-lime" style={{ marginTop: '18px' }}>
                Experimentar o Hub →
              </Link>
            </div>
            <div>{tabs[activeTab]?.preview}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

