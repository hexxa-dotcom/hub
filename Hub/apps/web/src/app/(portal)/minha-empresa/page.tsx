import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, FileText, Calendar, Briefcase, MapPin, Pencil } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getFichaDaEmpresa } from '@/lib/server/ficha-da-empresa';
import { CertificadoCard } from '@/components/fiscal/CertificadoCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha empresa · Hexxa Hub' };

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const REGIME: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
};

/** "3 anos e 2 meses" — meses soltos não dizem nada a ninguém. */
function tempo(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parte = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (anos === 0) return parte(resto, 'mês', 'meses');
  if (resto === 0) return parte(anos, 'ano', 'anos');
  return `${parte(anos, 'ano', 'anos')} e ${parte(resto, 'mês', 'meses')}`;
}

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-[#231F20] dark:text-[#F5F6F4]">{valor}</dd>
    </div>
  );
}

function Bloco({
  titulo,
  Icone,
  children,
}: {
  titulo: string;
  Icone: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#231F20] sm:p-6">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
        <Icone className="h-3.5 w-3.5" /> {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function Page() {
  const ficha = await getFichaDaEmpresa(await getTenantContext());
  if (!ficha) notFound();

  const semDado = <span className="text-[#6E6A61] dark:text-[#A8A49C]">—</span>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 animate-in fade-in">
      {/* O retrato: o nome grande, e o que o empresário conta para alguém. */}
      <section className="rounded-3xl bg-[#1E3328] p-6 text-[#F5F6F4] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]/70">
          {ficha.situacao === 'ATIVA' ? 'Empresa ativa' : 'Empresa encerrada'}
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
          {ficha.nomeFantasia || ficha.razaoSocial}
        </h1>
        {ficha.nomeFantasia && <p className="text-sm text-[#F5F6F4]/70">{ficha.razaoSocial}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[#DFFFAE]/70">CNPJ</dt>
            <dd className="mt-0.5 text-sm font-medium tabular">{ficha.cnpj}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[#DFFFAE]/70">
              No mercado há
            </dt>
            <dd className="mt-0.5 text-sm font-medium">
              {ficha.tempoDeAtividade === null ? '—' : tempo(ficha.tempoDeAtividade)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[#DFFFAE]/70">
              Notas em {ficha.ano}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular">{ficha.notasNoAno}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[#DFFFAE]/70">
              Faturamento em {ficha.ano}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular">
              {BRL.format(ficha.faturamentoNoAno)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloco titulo="Cadastro" Icone={Building2}>
          <dl className="space-y-4">
            <Dado
              rotulo="Regime tributário"
              valor={ficha.regime ? (REGIME[ficha.regime] ?? ficha.regime) : semDado}
            />
            <Dado
              rotulo="Aberta em"
              valor={
                ficha.abertura
                  ? new Date(`${ficha.abertura}T12:00:00Z`).toLocaleDateString('pt-BR')
                  : semDado
              }
            />
            <Dado
              rotulo="Capital social"
              valor={ficha.capitalSocial === null ? semDado : BRL.format(ficha.capitalSocial)}
            />
            {ficha.capitalAIntegralizar > 0 && (
              <Dado
                rotulo="A integralizar"
                valor={
                  <span className="text-amber-700 dark:text-amber-400">
                    {BRL.format(ficha.capitalAIntegralizar)} — enquanto houver saldo, a lei veda
                    distribuir lucro.
                  </span>
                }
              />
            )}
          </dl>
        </Bloco>

        <Bloco titulo="Atividade" Icone={Briefcase}>
          <dl className="space-y-4">
            <Dado
              rotulo="Atividade principal"
              valor={
                ficha.atividadeTexto ?? (ficha.atividadeCodigo ? `CNAE ${ficha.atividadeCodigo}` : semDado)
              }
            />
            {ficha.atividadeCodigo && ficha.atividadeTexto && (
              <Dado rotulo="CNAE" valor={<span className="tabular">{ficha.atividadeCodigo}</span>} />
            )}
            <Dado
              rotulo="Endereço"
              valor={
                ficha.endereco ? (
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
                    {ficha.endereco}
                  </span>
                ) : (
                  semDado
                )
              }
            />
          </dl>
        </Bloco>
      </div>

      <Bloco titulo="Sócios" Icone={Users}>
        {ficha.socios.length === 0 ? (
          <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Nenhum sócio cadastrado.{' '}
            <Link href="/minha-contabilidade/socios" className="font-bold underline">
              Cadastrar agora
            </Link>{' '}
            — é o que permite calcular pró-labore e distribuição de lucros.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {ficha.socios.map((s) => (
              <li key={`${s.nome}-${s.cpf}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                <span className="flex-1 text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
                  {s.nome}
                </span>
                <span className="tabular text-sm text-[#6E6A61] dark:text-[#A8A49C]">
                  {s.participacao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                </span>
                {s.proLabore > 0 && (
                  <span className="tabular text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    pró-labore {BRL.format(s.proLabore)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <CertificadoCard />

      <div className="flex flex-wrap gap-2 pb-4">
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:border-white/10 dark:text-[#F5F6F4]"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar cadastro
        </Link>
        <Link
          href="/meu-negocio/notas"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:border-white/10 dark:text-[#F5F6F4]"
        >
          <FileText className="h-3.5 w-3.5" /> Minhas notas
        </Link>
        <Link
          href="/minha-contabilidade/socios"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:border-white/10 dark:text-[#F5F6F4]"
        >
          <Calendar className="h-3.5 w-3.5" /> Sócios e pró-labore
        </Link>
      </div>
    </div>
  );
}
