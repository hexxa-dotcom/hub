import Link from 'next/link';
import Image from 'next/image';
import { EMPRESA, waLink } from '@/lib/site/planos';

/** Cabeçalho fixo do site. `ancora` = links da home (#produto…) ou rotas completas (/#produto). */
export function Cabecalho({ naHome = false }: { naHome?: boolean }) {
  const h = (a: string) => (naHome ? a : `/${a}`);
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(14,14,16,.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid #1C1C20' }}>
      <div className="wrap" style={{ paddingTop: 18, paddingBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'nowrap' }}>
        <Link href="/" style={{ display: 'flex' }} aria-label="Hexx Digital — início">
          <Image src="/brand/hexx-horizontal-negativo.svg" alt="hexx" width={114} height={26} priority style={{ height: 26, width: 'auto', display: 'block' }} />
        </Link>
        <nav className="nav-site" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14, color: '#B8B8B4', flexWrap: 'wrap' }}>
          <a href={h('#produto')}>A Hexx</a>
          <Link href="/planos">Planos</Link>
          <a href={h('#faq')}>Perguntas</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={'/auth/login' as never} className="btn-o topo-btn" style={{ fontSize: 14, padding: '11px 16px' }}>Entrar</Link>
          <a href={h('#planos')} className="btn-s topo-btn" style={{ fontSize: 14, padding: '12px 18px' }}><span className="so-largo">Experimentar a Hexx</span><span className="so-estreito">Planos</span></a>
        </div>
      </div>
    </header>
  );
}

export function Rodape() {
  const col = { display: 'flex', flexDirection: 'column' as const, gap: 12, fontSize: 14, color: '#B8B8B4' };
  const tit = { fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: '#8A8A86', marginBottom: 4 };
  return (
    <footer style={{ background: '#0E0E10', borderTop: '1px solid #1C1C20' }}>
      <div className="wrap" style={{ paddingTop: 72, paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 56 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 40 }}>
          <div className="rodape-marca" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Image src="/brand/hexx-vertical-negativo.svg" alt="hexx" width={143} height={72} style={{ height: 72, width: 'auto', alignSelf: 'flex-start' }} />
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: '#B8B8B4' }}>Clareza pra decidir.<br />Liberdade pra crescer.</p>
          </div>
          <div style={col}>
            <div className="m" style={tit}>Navegação</div>
            <a href="/#produto">A Hexx por dentro</a>
            <Link href="/planos">Planos e preços</Link>
            <Link href={'/auth/login' as never}>Portal do cliente</Link>
            <Link href={'/auth/login/contador' as never}>Área do contador</Link>
          </div>
          <div style={col}>
            <div className="m" style={tit}>Hexx Digital</div>
            <a href="/#faq">Perguntas frequentes</a>
            <a href="/#contato">Fale com a gente</a>
            <a href={waLink('Olá, quero conhecer a Hexx')}>{EMPRESA.telefone}</a>
            <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderTop: '1px solid #1C1C20', paddingTop: 24, fontSize: 12, color: '#8A8A86' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>© {new Date().getFullYear()} Hexx Digital · CNPJ {EMPRESA.cnpj}</div>
            <div>Contador responsável · CRC {EMPRESA.crcContador}</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href={'/termos' as never}>Termos de uso</Link>
            <Link href={'/privacidade' as never}>Política de privacidade</Link>
          </div>
          <div className="m">{EMPRESA.dominio}</div>
        </div>
      </div>
    </footer>
  );
}

export function BotaoWhatsapp() {
  return (
    <a href={waLink('Olá, quero conhecer a Hexx')} className="fab" target="_blank" rel="noopener noreferrer">
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0E0E10' }} />WhatsApp
    </a>
  );
}
