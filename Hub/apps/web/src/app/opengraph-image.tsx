import { ImageResponse } from 'next/og';

export const alt = 'Hexx Hub | O Hub de Autogestão para Empresas de Serviços e Autônomos';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(145deg, #121008 0%, #1C180D 50%, #0D0C07 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          color: '#FEFDF3',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '38px' }}>
            <span style={{ fontWeight: 900, color: '#FEFDF3' }}>hexx</span>
            <span
              style={{
                display: 'flex',
                fontSize: '14px',
                fontWeight: 800,
                color: '#DFFFAE',
                border: '1.5px solid rgba(223, 255, 174, 0.4)',
                background: 'rgba(223, 255, 174, 0.12)',
                borderRadius: '8px',
                padding: '3px 10px',
                letterSpacing: '0.12em',
                transform: 'translateY(-2px)',
              }}
            >
              HUB
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              background: 'rgba(223, 255, 174, 0.12)',
              border: '1px solid rgba(223, 255, 174, 0.3)',
              borderRadius: '100px',
              padding: '10px 24px',
              color: '#DFFFAE',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            Hub de Autogestão &amp; Contabilidade
          </div>
        </div>

        {/* Center Main Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', fontSize: '54px', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', maxWidth: '950px' }}>
            Sua empresa inteira em um só lugar. Simples.
          </div>
          <div style={{ display: 'flex', fontSize: '24px', color: '#A2C1CD', maxWidth: '850px', lineHeight: 1.4 }}>
            Finanças em tempo real, contratos digitais, emissão de NFSe e contabilidade consultiva para autônomos e serviços.
          </div>
        </div>

        {/* Bottom Highlights Bar */}
        <div style={{ display: 'flex', gap: '30px', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#FEFDF3', fontWeight: 600 }}>
            <span style={{ color: '#DFFFAE', fontWeight: 800 }}>[✓]</span> Contabilidade em Realtime
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#FEFDF3', fontWeight: 600 }}>
            <span style={{ color: '#DFFFAE', fontWeight: 800 }}>[✓]</span> Emissão de NFSe com 1 Clique
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#FEFDF3', fontWeight: 600 }}>
            <span style={{ color: '#DFFFAE', fontWeight: 800 }}>[✓]</span> Assinaturas com Validade Jurídica
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
