import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getConferencia } from '@/lib/server/contratos';
import { ConferirArquivo } from './ConferirArquivo';

/**
 * CONFERÊNCIA DE CONTRATO — para quem está fora do Hub.
 *
 * O código impresso em todas as páginas do contrato traz a pessoa aqui. Ela
 * vê quem são as partes, quem assinou, quando e de onde, e pode conferir se
 * o PDF que recebeu é o original. Valor e cláusulas não aparecem.
 */

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Conferência de contrato · Hexxa Hub', robots: { index: false } };

const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  ATIVO: { texto: 'Assinado pelas duas partes', cor: 'text-emerald-700' },
  AGUARDANDO_ASSINATURA: { texto: 'Aguardando assinatura', cor: 'text-amber-700' },
  CANCELADO: { texto: 'Contrato encerrado', cor: 'text-black/60' },
  RECUSADO: { texto: 'Assinatura recusada', cor: 'text-rose-600' },
  EXPIRADO: { texto: 'Assinatura expirada', cor: 'text-black/60' },
};

export default async function ConferenciaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const c = await getConferencia(codigo);
  if (!c) notFound();
  const situacao = SITUACAO[c.status] ?? { texto: c.status, cor: 'text-black/60' };

  return (
    <main className="min-h-screen bg-[#F3F2EC] text-[#0C110E]">
      <div className="mx-auto w-full max-w-[640px] space-y-10 px-4 pb-16 pt-12">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">Conferência de contrato · Hexxa Hub</p>
          <h1 className="mt-3 text-2xl font-light uppercase leading-tight tracking-[0.05em]">{c.titulo}</h1>
          <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${situacao.cor}`}>
            <ShieldCheck className="h-4 w-4" /> {situacao.texto}
            {c.status === 'ATIVO' && c.assinadoEm ? ` em ${br(c.assinadoEm)}` : ''}
          </p>
          <p className="mt-1 font-mono text-xs text-black/50">Código {c.codigo}</p>
        </header>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">Partes</p>
          <ul className="mt-3 divide-y divide-black/[0.07] border-y border-black/[0.07]">
            {c.partes.map((p) => (
              <li key={p.papel} className="grid grid-cols-[110px_1fr] gap-4 py-3.5 text-sm">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/45">{p.papel}</span>
                <span>
                  {p.nome}
                  {p.documento && <span className="block font-mono text-xs text-black/50">{p.documento}</span>}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[110px_1fr] gap-4 py-3.5 text-sm">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/45">Vigência</span>
              <span>
                {br(c.vigencia.inicio)} a {br(c.vigencia.fim)}
              </span>
            </li>
          </ul>
        </section>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">Assinaturas</p>
          {c.assinatura === 'HUB' ? (
            c.assinaturas.length === 0 ? (
              <p className="mt-3 text-sm text-black/60">Ninguém assinou ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/[0.07] border-y border-black/[0.07]">
                {c.assinaturas.map((a) => (
                  <li key={a.em} className="py-3.5 text-sm">
                    <p className="font-semibold">{a.nome}</p>
                    <p className="text-xs text-black/55">
                      por {a.empresa}
                      {a.cpf ? ` · CPF ${a.cpf}` : ''} · {quando(a.em)}
                      {a.ip ? ` · IP ${a.ip}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="mt-3 text-sm text-black/60">
              {c.assinatura === 'DOCUSEAL'
                ? 'Assinado pelo DocuSeal, que emite o próprio relatório de auditoria com o registro de cada signatário.'
                : 'Contrato assinado fora do Hub e registrado com o arquivo assinado.'}
            </p>
          )}
        </section>

        {c.hash && (
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">O arquivo</p>
            <p className="break-all font-mono text-[11px] text-black/55">SHA-256 {c.hash}</p>
            <ConferirArquivo hash={c.hash} />
          </section>
        )}

        <footer className="text-[11px] leading-relaxed text-black/45">
          Assinatura eletrônica nos termos do art. 10, § 2º, da MP 2.200-2/2001: válida entre as partes que a aceitaram. Cada assinatura
          registra a pessoa, o CPF, a data, a hora, o endereço IP e o código do documento assinado.
        </footer>
      </div>
    </main>
  );
}
