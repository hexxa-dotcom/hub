import { Cabecalho, Rodape } from './Chrome';
import type { Secao } from '@/lib/contratos/textos';

/** Página de texto jurídico no site — o mesmo texto versionado que o cliente aceita no Hub. */
export function PaginaLegal({ titulo, versao, blocos }: { titulo: string; versao: string; blocos: { titulo?: string; secoes: Secao[] }[] }) {
  return (
    <>
      <Cabecalho />
      <main style={{ background: '#F3F2EE', color: '#0E0E10' }}>
        <div className="wrap" style={{ maxWidth: 820, paddingTop: 88, paddingBottom: 112, display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="rot" style={{ color: '#5A5A56' }}>{versao}</div>
            <h1 className="h2">{titulo}</h1>
          </div>
          {blocos.map((b, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {b.titulo && <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.03em' }}>{b.titulo}</h2>}
              {b.secoes.map((s) => (
                <section key={s.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-sem-reveal>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>{s.titulo}</h3>
                  {s.itens.map((p, j) => <p key={j} style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: '#3A3A38' }}>{p}</p>)}
                </section>
              ))}
            </div>
          ))}
        </div>
      </main>
      <Rodape />
    </>
  );
}
