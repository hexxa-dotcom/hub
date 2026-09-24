import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { propostaPublica, registrarVisualizacao } from '@/lib/server/propostas';
import { Resposta } from './Resposta';

/**
 * A PROPOSTA PELO LINK — o que o cliente recebe.
 *
 * A marca de quem enviou, os itens, o total, a validade e dois botões:
 * aceitar ou recusar. Abrir já avisa a empresa ("proposta vista"); aceitar
 * registra nome, e-mail, data, hora e IP, e a proposta vira contrato do
 * outro lado com um clique.
 */

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const r = await propostaPublica(token);
  return r ? { title: `Proposta ${r.proposta.numero} · ${r.empresa.nome}`, robots: { index: false } } : { title: 'Proposta', robots: { index: false } };
}

export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await propostaPublica(token);
  if (!r) notFound();
  await registrarVisualizacao(token).catch(() => null);
  const { proposta: p, empresa } = r;
  const respondida = p.status === 'aprovada' || p.status === 'rejeitada';

  return (
    <main className="min-h-screen bg-[#F3F2EC] text-[#0C110E]">
      <div className="mx-auto w-full max-w-[720px] space-y-10 px-4 pb-16 pt-12">
        <header className="flex items-center gap-4">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1.5" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C110E] text-xl text-[#D4FF00]">{empresa.nome.trim()[0]?.toUpperCase()}</span>
          )}
          <div>
            <p className="text-sm font-semibold">{empresa.nome}</p>
            <p className="text-xs text-black/50">CNPJ {empresa.cnpj}</p>
          </div>
        </header>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">
            Proposta {p.numero} · para {p.cliente.nome}
          </p>
          <h1 className="mt-3 text-3xl font-light uppercase leading-tight tracking-[0.04em]">{p.titulo}</h1>
          {p.observacoes && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-black/65">{p.observacoes}</p>}
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.06]">
          <ul className="divide-y divide-black/[0.06]">
            {p.itens.map((i, k) => (
              <li key={k} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                <span>
                  {i.descricao}
                  {i.qtd !== 1 && <span className="text-black/45"> · {i.qtd.toLocaleString('pt-BR')} × {BRL.format(i.valor)}</span>}
                </span>
                <span className="font-semibold tabular-nums">{BRL.format(i.qtd * i.valor)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-4 bg-[#0C110E] px-6 py-5 text-white">
            <span className="text-xs uppercase tracking-[0.16em] text-white/60">{p.recorrencia === 'MENSAL' ? 'Total por mês' : 'Total'}</span>
            <span className="text-2xl font-light tabular-nums text-[#D4FF00]">{BRL.format(p.total)}</span>
          </div>
        </section>
        <p className="text-xs text-black/50">
          {p.recorrencia === 'MENSAL' ? `Pagamento mensal${p.prazoMeses ? ` por ${p.prazoMeses} meses` : ''}. ` : ''}
          Proposta válida até {br(p.validade)}. ·{' '}
          <a href={`/p/${token}/pdf`} className="font-semibold text-black/70 underline-offset-4 hover:underline">
            Baixar em PDF
          </a>
        </p>

        {respondida ? (
          <p className={`rounded-[24px] px-6 py-5 text-sm font-semibold ${p.status === 'aprovada' ? 'bg-emerald-600/10 text-emerald-800' : 'bg-black/5 text-black/60'}`}>
            {p.status === 'aprovada'
              ? `Proposta aceita por ${p.decisao?.nome ?? 'você'} em ${p.decisao ? new Date(p.decisao.em).toLocaleDateString('pt-BR') : ''}. ${empresa.nome} já foi avisada e vai enviar o contrato.`
              : 'Proposta recusada. Obrigado pela resposta.'}
          </p>
        ) : p.status === 'expirada' ? (
          <p className="rounded-[24px] bg-black/5 px-6 py-5 text-sm text-black/60">Esta proposta expirou. Peça uma nova a {empresa.nome}.</p>
        ) : (
          <Resposta token={token} emailSugerido={p.cliente.email} />
        )}

        <footer className="text-center text-[11px] text-black/40">Proposta enviada por {empresa.nome} pela Hexx Digital.</footer>
      </div>
    </main>
  );
}
