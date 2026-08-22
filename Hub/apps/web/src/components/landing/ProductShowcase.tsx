'use client';

import { useState } from 'react';

const tabs = [
  {
    id: 'finance',
    name: 'Caixa em Tempo Real',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: 'Fluxo de caixa inteligente e conciliação bancária sem planilhas',
    desc: 'Cada centavo que entra ou sai da sua empresa é categorizado automaticamente. Tenha clareza absoluta de quem pagou, quem está devendo e seu lucro líquido real.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Saldo Disponível · Conta PJ
          </span>
          <span className="mock-pill">Conciliado ✓</span>
        </div>
        <div className="landing-serif" style={{ fontSize: '36px', fontWeight: 700, color: 'var(--ink)', marginBottom: '20px' }}>
          R$ 38.450,00
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Consultoria Estratégica (Cliente Alpha)</span>
            <span className="pos">+ R$ 12.000,00</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Projeto UI/UX Sprint #04</span>
            <span className="pos">+ R$ 8.500,00</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '10px', padding: '10px 14px' }}>
            <span>Servidores Cloud &amp; Ferramentas</span>
            <span className="neg">− R$ 680,00</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'nfse',
    name: 'Emissão de NFSe',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    title: 'Emita notas fiscais de serviço em segundos',
    desc: 'Sem portais lentos da prefeitura. Emita notas com 1 clique e envie o PDF e XML automaticamente para o e-mail do seu cliente, com cálculo correto de retenções.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            NFSe #00842 · Autorizada
          </span>
          <span className="mock-pill">Transmitida à Prefeitura</span>
        </div>
        <div style={{ padding: '16px', background: 'var(--beige)', borderRadius: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Tomador do Serviço</div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>Acme Corp Tecnologia Ltda</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>CNPJ: 42.189.300/0001-92</div>
        </div>
        <div className="mock-row">
          <span>Valor dos serviços</span>
          <span style={{ fontWeight: 800 }}>R$ 15.000,00</span>
        </div>
        <div className="mock-row">
          <span>ISS / Simples Nacional</span>
          <span className="mock-pill gray">Incluso</span>
        </div>
      </div>
    ),
  },
  {
    id: 'contracts',
    name: 'Contratos & Assinaturas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
        <path d="M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z" />
      </svg>
    ),
    title: 'Modelos validados e assinatura digital com valor jurídico',
    desc: 'Crie propostas e contratos profissionais para serviços pontuais ou recorrentes. O cliente assina pelo celular sem imprimir nada, com validade ICP-Brasil e log de auditoria.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Contrato de Prestação de Serviços
          </span>
          <span className="mock-pill">100% Assinado</span>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
          <div className="sigline landing-serif" style={{ display: 'inline-block' }}>
            Filipe Heck
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontWeight: 600 }}>
            Trilha de Auditoria: IP 179.184.22.10 · Hash SHA-256 Validado
          </div>
        </div>
        <div className="mock-row">
          <span>Prestador</span>
          <span className="mock-pill">Assinado</span>
        </div>
        <div className="mock-row">
          <span>Contratante</span>
          <span className="mock-pill">Assinado</span>
        </div>
      </div>
    ),
  },
  {
    id: 'tax',
    name: 'Contabilidade Realtime',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Impostos automáticos e zero surpresa no fim do mês',
    desc: 'A contabilidade da Hexx calcula seus tributos em tempo real com base no faturamento real da sua empresa. A guia DAS chega pronta antes da data de vencimento.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Guia de Impostos do Mês
          </span>
          <span className="mock-pill">Pronta para Pagamento</span>
        </div>
        <div className="landing-serif" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
          DAS · R$ 684,20
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600, marginBottom: '18px' }}>
          Simples Nacional · Alíquota otimizada 6% (Anexo III)
        </div>
        <div className="mock-row">
          <span>Vencimento</span>
          <span style={{ fontWeight: 800 }}>20 do mês</span>
        </div>
        <div className="mock-row">
          <span>Linha Digitável / Pix</span>
          <span className="mock-pill">Copia e Cola</span>
        </div>
      </div>
    ),
  },
  {
    id: 'vault',
    name: 'Cofre & Relatórios',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: 'Cofre seguro com todos os documentos e saúde da empresa',
    desc: 'Certidões negativas, contrato social, comprovantes e DRE gerencial arquivados na nuvem. Acesse de qualquer lugar quando precisar solicitar crédito ou fechar contratos.',
    preview: (
      <div className="showcase-preview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Cofre Digital · Documentos
          </span>
          <span className="mock-pill">100% em dia</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>CND Federal (Receita Federal)</span>
            <span className="pos">Válida ✓</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>Contrato Social Consolidado</span>
            <span className="mock-pill gray">PDF</span>
          </div>
          <div className="mock-row" style={{ background: 'var(--beige)', borderRadius: '8px', padding: '10px 14px' }}>
            <span>DRE Gerencial do Ano</span>
            <span className="pos">Lucro 78%</span>
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
          <h2 className="landing-serif">Tudo o que sua empresa de serviço precisa. Em uma só tela.</h2>
          <p>
            Diga adeus à colcha de retalhos de 5 softwares diferentes. No Hexx Hub você tem autonomia total para autogerenciar seu negócio com a contabilidade operando em tempo real.
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
              <h3 className="landing-serif">{tabs[activeTab]?.title}</h3>
              <p>{tabs[activeTab]?.desc}</p>
              <a href="#planos" className="btn-landing btn-landing-lime">
                Experimente o Hub →
              </a>
            </div>
            <div>{tabs[activeTab]?.preview}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
