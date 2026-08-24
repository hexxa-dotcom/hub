'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FeatureRow {
  name: string;
  gestao: boolean | string;
  completo: boolean | string;
  holding: boolean | string;
}

interface FeatureCategory {
  category: string;
  rows: FeatureRow[];
}

const comparisonData: FeatureCategory[] = [
  {
    category: 'Gestão Operacional & Financeira',
    rows: [
      { name: 'Fluxo de caixa em tempo real', gestao: true, completo: true, holding: true },
      { name: 'Conciliação bancária automática', gestao: true, completo: true, holding: true },
      { name: 'Emissão de NFSe (Notas Fiscais de Serviço)', gestao: 'Ilimitada', completo: 'Ilimitada', holding: 'Ilimitada' },
      { name: 'Cobranças automáticas via Pix e Boleto', gestao: true, completo: true, holding: true },
      { name: 'DRE e Relatório de Lucro Real mensal', gestao: true, completo: true, holding: true },
    ],
  },
  {
    category: 'Contratos & Assinaturas Digitais',
    rows: [
      { name: 'Modelos prontos para serviços (Recorrente / Pontual / Hora)', gestao: true, completo: true, holding: true },
      { name: 'Assinatura digital com validade jurídica (ICP-Brasil)', gestao: 'Ilimitada', completo: 'Ilimitada', holding: 'Ilimitada' },
      { name: 'Trilha de auditoria com IP, data e Hash criptográfico', gestao: true, completo: true, holding: true },
      { name: 'Cofre digital na nuvem para certidões e arquivos', gestao: true, completo: true, holding: true },
    ],
  },
  {
    category: 'Contabilidade Especializada & Impostos',
    rows: [
      { name: 'Contador dedicado à sua empresa', gestao: false, completo: true, holding: true },
      { name: 'Cálculo automático de impostos (DAS / Simples Nacional)', gestao: false, completo: true, holding: true },
      { name: 'Entrega de declarações obrigatórias (DEFIS, DCTF, DIRF, etc.)', gestao: false, completo: true, holding: true },
      { name: 'Abertura de CNPJ gratuita ou migração sem burocracia', gestao: false, completo: true, holding: true },
      { name: 'Planejamento tributário para redução legal de alíquota', gestao: false, completo: true, holding: true },
      { name: 'Estruturação societária e blindagem patrimonial', gestao: false, completo: false, holding: true },
      { name: 'Gestão de aluguéis e múltiplos imóveis de holding', gestao: false, completo: false, holding: true },
    ],
  },
  {
    category: 'Atendimento & Relacionamento',
    rows: [
      { name: 'Atendimento humano direto no WhatsApp', gestao: true, completo: true, holding: true },
      { name: 'Tempo de resposta garantido', gestao: 'Até 1 dia útil', completo: 'Prioritário', holding: 'Exclusivo' },
      { name: 'Consultoria contábil mensal', gestao: false, completo: true, holding: true },
      { name: 'Sem contrato de fidelidade (cancele a qualquer momento)', gestao: true, completo: true, holding: true },
    ],
  },
];

export function FeatureComparisonTable() {
  const [open, setOpen] = useState(false);

  const renderValue = (val: boolean | string) => {
    if (typeof val === 'string') {
      return <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{val}</span>;
    }
    return val ? (
      <span style={{ color: 'var(--lime)', fontWeight: 800, fontSize: '18px' }}>✓</span>
    ) : (
      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>—</span>
    );
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setOpen(!open)}
          className="btn-landing btn-landing-dark w-full sm:w-auto"
          style={{ border: '1px solid rgba(255,255,255,0.2)' }}
        >
          {open ? 'Ocultar Comparativo Detalhado ↑' : 'Comparar Todos os Recursos Lado a Lado ↓'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: '36px',
            background: 'var(--dark)',
            color: 'var(--cream)',
            borderRadius: '24px',
            padding: '28px 18px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(254, 253, 243, 0.5)', marginBottom: '14px', fontWeight: 600 }}>
            ← Arraste para o lado para ver todos os planos →
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '660px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '16px', fontSize: '16px', fontFamily: 'var(--font-serif)' }}>
                  Recursos &amp; Funcionalidades
                </th>
                <th style={{ textAlign: 'center', padding: '16px', width: '22%' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>Hub Start</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>R$ 149/mês</div>
                  <Link href={'/checkout?plan=gestao' as any} className="btn-landing btn-landing-white btn-landing-sm" style={{ marginTop: '10px' }}>
                    Escolher
                  </Link>
                </th>
                <th style={{ textAlign: 'center', padding: '16px', width: '26%', background: 'rgba(223, 255, 174, 0.06)', borderRadius: '12px 12px 0 0' }}>
                  <span className="mock-pill" style={{ display: 'inline-block', marginBottom: '4px' }}>Recomendado</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--lime)' }}>Hub Pro + Contabilidade</div>
                  <div style={{ fontSize: '13px', color: 'var(--cream)', marginTop: '2px' }}>R$ 389/mês</div>
                  <Link href={'/checkout?plan=completo' as any} className="btn-landing btn-landing-lime btn-landing-sm" style={{ marginTop: '10px' }}>
                    Escolher
                  </Link>
                </th>
                <th style={{ textAlign: 'center', padding: '16px', width: '22%' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>Holding &amp; Private</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>R$ 890/mês</div>
                  <Link href={'/checkout?plan=holding' as any} className="btn-landing btn-landing-white btn-landing-sm" style={{ marginTop: '10px' }}>
                    Escolher
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((cat, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '24px 16px 10px',
                        fontWeight: 800,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--lime)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {cat.category}
                    </td>
                  </tr>
                  {cat.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.2s',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: 'rgba(254, 253, 243, 0.9)' }}>
                        {row.name}
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }}>{renderValue(row.gestao)}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', background: 'rgba(223, 255, 174, 0.06)' }}>
                        {renderValue(row.completo)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }}>{renderValue(row.holding)}</td>
                    </tr>
                  ))}
                </div>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
