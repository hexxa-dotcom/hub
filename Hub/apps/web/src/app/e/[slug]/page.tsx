import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Globe, Mail, MessageCircle, Phone, UserPlus, ArrowUpRight } from 'lucide-react';
import { Instagram, Linkedin } from '@/components/ui/SocialIcons';
import { CartaoDaEmpresa } from '@/components/ficha/CartaoDaEmpresa';
import { contatosDaEmpresa, formatarCnpj, type TipoDeContato } from '@/components/ficha/contatos';
import { getFichaPublica, qrDaFicha, urlDaFicha } from '@/lib/server/ficha-publica';

/**
 * A FICHA PÚBLICA — o link que o empresário põe na bio.
 *
 * Como um Linktree, mas da empresa: o cartão de visita no topo, os botões de
 * contato um embaixo do outro, e os dados oficiais — os mesmos do cartão CNPJ
 * — para quem quer conferir com quem está falando. Tudo o que aparece aqui já
 * é público; o que não é nunca chega a sair do banco (ver `getFichaPublica`).
 */

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const ICONE: Record<TipoDeContato, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  site: Globe,
  linkedin: Linkedin,
  email: Mail,
  telefone: Phone,
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFichaPublica(slug);
  if (!f) return { title: 'Ficha não encontrada', robots: { index: false } };
  const descricao = [f.atividadeTexto, f.cidade && `${f.cidade}${f.uf ? `/${f.uf}` : ''}`].filter(Boolean).join(' · ');
  return {
    title: f.nome,
    description: descricao || `CNPJ ${formatarCnpj(f.cnpj)}`,
    openGraph: { title: f.nome, description: descricao || undefined, type: 'profile' },
  };
}

function tempoDeEmpresa(abertura: string): string {
  const meses = Math.floor((Date.now() - Date.parse(`${abertura}T12:00:00Z`)) / (30.44 * 86400000));
  const anos = Math.floor(meses / 12);
  if (anos >= 1) return `${anos} ${anos === 1 ? 'ano' : 'anos'} de empresa`;
  return meses <= 1 ? 'Empresa nova' : `${meses} meses de empresa`;
}

export default async function FichaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await getFichaPublica(slug);
  if (!f) notFound();

  const url = await urlDaFicha(f.slug);
  const qr = await qrDaFicha(url);
  const contatos = contatosDaEmpresa(f);
  const cnpj = formatarCnpj(f.cnpj);
  const sede = f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ''}` : null;
  const abertura = f.abertura ? new Date(`${f.abertura}T12:00:00Z`).toLocaleDateString('pt-BR') : null;

  const dados = [
    { rotulo: 'Razão social', valor: f.razaoSocial.toUpperCase() },
    { rotulo: 'CNPJ', valor: cnpj, mono: true },
    { rotulo: 'Situação', valor: f.situacao === 'ATIVA' ? 'Ativa' : 'Encerrada' },
    abertura && { rotulo: 'Abertura', valor: `${abertura} · ${tempoDeEmpresa(f.abertura!)}` },
    f.capitalSocial && { rotulo: 'Capital social', valor: BRL.format(f.capitalSocial) },
    sede && { rotulo: 'Sede', valor: sede },
    f.atividadeTexto && { rotulo: 'Atividade principal', valor: f.atividadeTexto, nota: f.atividadeCodigo ? `CNAE ${f.atividadeCodigo}` : null },
  ].filter(Boolean) as { rotulo: string; valor: string; mono?: boolean; nota?: string | null }[];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F3F2EC] text-[#0C110E]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#D4FF00]/25 blur-[120px]" />

      <div className="relative mx-auto flex w-full max-w-[560px] flex-col gap-10 px-4 pb-16 pt-10 sm:pt-16">
        <CartaoDaEmpresa
          dados={{
            nome: f.nome,
            atividade: f.atividadeTexto,
            cnpj,
            desde: f.abertura?.slice(0, 4) ?? null,
            sede,
            ativa: f.situacao === 'ATIVA',
            logoUrl: f.logoUrl,
          }}
          qrSvg={qr}
        />

        {/* Os botões, como numa página de links. */}
        <nav className="flex flex-col gap-3" aria-label="Contatos">
          {contatos.map((c, i) => {
            const Icone = ICONE[c.tipo];
            const principal = i === 0;
            return (
              <a
                key={c.tipo}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`group flex items-center gap-4 rounded-full px-5 py-4 transition-all hover:-translate-y-0.5 ${
                  principal
                    ? 'bg-[#0C110E] text-white shadow-[0_14px_30px_-12px_rgba(12,17,14,0.55)]'
                    : 'bg-white text-[#0C110E] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06] hover:ring-black/15'
                }`}
              >
                <Icone className={`h-5 w-5 shrink-0 ${principal ? 'text-[#D4FF00]' : 'text-[#0C110E]/70'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[10px] font-medium uppercase tracking-[0.18em] ${principal ? 'text-white/50' : 'text-black/40'}`}>{c.rotulo}</span>
                  <span className="block truncate text-[15px] font-medium">{c.valor}</span>
                </span>
                <ArrowUpRight className={`h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${principal ? 'text-white/50' : 'text-black/30'}`} />
              </a>
            );
          })}
          <a
            href={`/e/${f.slug}/contato`}
            className="flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-[#0C110E]/70 border border-dashed border-black/20 transition-colors hover:border-black/40 hover:text-[#0C110E]"
          >
            <UserPlus className="h-4 w-4" /> Salvar contato no celular
          </a>
        </nav>

        {/* Os dados oficiais — os mesmos do cartão CNPJ. */}
        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">Dados da empresa</p>
          <dl className="mt-4 divide-y divide-black/[0.07] border-y border-black/[0.07]">
            {dados.map((d) => (
              <div key={d.rotulo} className="grid grid-cols-[120px_1fr] gap-4 py-3.5 sm:grid-cols-[150px_1fr]">
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/45">{d.rotulo}</dt>
                <dd className={`text-sm text-[#0C110E] ${d.mono ? 'font-mono tabular' : ''}`}>
                  {d.valor}
                  {d.nota && <span className="mt-0.5 block font-mono text-xs text-black/45">{d.nota}</span>}
                </dd>
              </div>
            ))}
            {f.socios.length > 0 && (
              <div className="grid grid-cols-[120px_1fr] gap-4 py-3.5 sm:grid-cols-[150px_1fr]">
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/45">{f.socios.length === 1 ? 'Sócio' : 'Sócios'}</dt>
                <dd>
                  <ul className="space-y-2.5">
                    {f.socios.map((s) => (
                      <li key={s.nome} className="flex items-center gap-3 text-sm">
                        {s.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C110E] text-[10px] font-semibold text-[#D4FF00]">
                            {s.nome
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                        )}
                        <span className="uppercase tracking-[0.04em]">{s.nome}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <footer className="text-center text-[11px] leading-relaxed text-black/40">
          Dados conferidos com o cadastro da Receita Federal.
          <br />
          Ficha publicada pela própria empresa no <span className="font-semibold text-black/60">Hexxa Hub</span>.
        </footer>
      </div>
    </main>
  );
}
