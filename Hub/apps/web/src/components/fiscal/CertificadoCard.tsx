import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX, Upload } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getStatusDoCertificado, type NivelDoAviso } from '@/lib/server/certificado';

/**
 * A ficha do certificado digital, sempre visível.
 *
 * O certificado vence uma vez por ano e para a emissão de notas quando vence.
 * A informação estava dentro do arquivo desde sempre, e ninguém a mostrava:
 * o cliente descobria no dia em que a nota não saía.
 *
 * O tom sobe com a urgência, mas o card nunca some — inclusive quando está
 * tudo certo. "Validado, vence em 14/03/2027" é o que transforma um arquivo
 * que alguém subiu uma vez em algo que a pessoa sabe que está funcionando.
 */
const ESTILO: Record<NivelDoAviso, { cor: string; Icone: typeof ShieldCheck }> = {
  OK: {
    cor: 'border-black/5 bg-white dark:border-white/10 dark:bg-[#231F20]',
    Icone: ShieldCheck,
  },
  ATENCAO: {
    cor: 'border-amber-500/30 bg-amber-500/5',
    Icone: ShieldAlert,
  },
  URGENTE: {
    cor: 'border-red-500/40 bg-red-500/10',
    Icone: ShieldAlert,
  },
  VENCIDO: {
    cor: 'border-red-500/40 bg-red-500/10',
    Icone: ShieldX,
  },
  INVALIDO: {
    cor: 'border-red-500/40 bg-red-500/10',
    Icone: ShieldX,
  },
  AUSENTE: {
    cor: 'border-black/5 bg-white dark:border-white/10 dark:bg-[#231F20]',
    Icone: Upload,
  },
};

const TEXTO: Record<NivelDoAviso, string> = {
  OK: 'text-[#231F20] dark:text-[#F5F6F4]',
  ATENCAO: 'text-amber-800 dark:text-amber-300',
  URGENTE: 'text-red-800 dark:text-red-300',
  VENCIDO: 'text-red-800 dark:text-red-300',
  INVALIDO: 'text-red-800 dark:text-red-300',
  AUSENTE: 'text-[#231F20] dark:text-[#F5F6F4]',
};

export async function CertificadoCard({ href = '/meu-negocio/fiscal' }: { href?: string }) {
  let status;
  try {
    status = await getStatusDoCertificado(await getTenantContext());
  } catch (err) {
    console.error('[CertificadoCard] falhou:', err);
    return null;
  }

  const { cor, Icone } = ESTILO[status.nivel];

  return (
    <section className={`rounded-3xl border p-5 ${cor}`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
            status.nivel === 'OK'
              ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
              : status.nivel === 'ATENCAO'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : status.nivel === 'AUSENTE'
                  ? 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
                  : 'bg-red-500/15 text-red-700 dark:text-red-400'
          }`}
        >
          <Icone className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
            Certificado digital
          </h2>
          <p className={`mt-1 text-sm font-medium ${TEXTO[status.nivel]}`}>{status.mensagem}</p>

          {status.ficha && status.nivel !== 'INVALIDO' && (
            <dl className="mt-3 space-y-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              <div className="flex gap-2">
                <dt className="shrink-0">Titular</dt>
                <dd className="truncate font-medium text-[#231F20] dark:text-[#F5F6F4]">
                  {status.ficha.titular}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">Válido de</dt>
                <dd className="font-medium text-[#231F20] dark:text-[#F5F6F4]">
                  {new Date(`${status.ficha.validoDe}T12:00:00Z`).toLocaleDateString('pt-BR')} a{' '}
                  {new Date(`${status.ficha.validoAte}T12:00:00Z`).toLocaleDateString('pt-BR')}
                </dd>
              </div>
            </dl>
          )}

          {status.nivel !== 'OK' && (
            <Link
              href={href as never}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]"
            >
              <Upload className="h-3.5 w-3.5" />
              {status.nivel === 'AUSENTE' ? 'Enviar certificado' : 'Enviar novo certificado'}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
