import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  FileText,
  Calendar,
  Briefcase,
  MapPin,
  Pencil,
  ShieldCheck,
  TrendingUp,
  Coins,
  Clock,
  ArrowUpRight,
  Receipt,
  FolderOpen,
  CheckCircle2,
  Lock,
  Wallet,
  Sparkles,
  Globe,
  MessageSquare,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { Instagram, Linkedin } from '@/components/ui/SocialIcons';
import { getTenantContext } from '@/lib/server/tenant';
import { getFichaDaEmpresa } from '@/lib/server/ficha-da-empresa';
import { getStatusDoCertificado } from '@/lib/server/certificado';
import { SectionHero } from '@/components/ui/SectionHero';
import {
  CopyButton,
  ShareCompanyButton,
  OpenMapsButton,
  CompanyLogoBadge,
  PartnerAvatarBadge,
} from './CompanyProfileActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha empresa · Hexxa Hub' };

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const REGIME: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
};

function tempo(meses: number | null): string {
  if (meses === null || meses <= 0) return 'Menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parte = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (anos === 0) return parte(resto, 'mês', 'meses');
  if (resto === 0) return parte(anos, 'ano', 'anos');
  return `${parte(anos, 'ano', 'anos')} e ${parte(resto, 'mês', 'meses')}`;
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return cnpj;
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return cpf;
}

function formatCEP(cep: string | null): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default async function Page() {
  const tenantCtx = await getTenantContext();
  const ficha = await getFichaDaEmpresa(tenantCtx);
  if (!ficha) notFound();

  const certStatus = await getStatusDoCertificado(tenantCtx).catch(() => null);

  const formattedCNPJ = formatCNPJ(ficha.cnpj);
  const formattedCEP = formatCEP(ficha.zipcode);
  const fullAddress = ficha.endereco || '';

  // Cálculos financeiros do dashboard executivo
  const currentMonthIdx = new Date().getMonth() + 1;
  const mediaMensalFaturamento = ficha.faturamentoNoAno > 0 ? ficha.faturamentoNoAno / currentMonthIdx : 0;
  const ticketMedio = ficha.notasNoAno > 0 ? ficha.faturamentoNoAno / ficha.notasNoAno : 0;
  const capitalSocialTotal = ficha.capitalSocial ?? 0;

  // Total de pro-labore consolidado no QSA
  const proLaboreConsolidado = ficha.socios.reduce((acc, s) => acc + s.proLabore, 0);
  const lucroDistribuidoMesConsolidado = ficha.socios.reduce((acc, s) => acc + s.lucroDistribuidoMes, 0);

  // Data de validade do certificado digital
  const certValidoAte = certStatus?.ficha?.validoAte
    ? new Date(`${certStatus.ficha.validoAte}T12:00:00Z`).toLocaleDateString('pt-BR')
    : null;

  // Formatação de links sociais
  const instagramHandle = ficha.instagram
    ? ficha.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')
    : null;
  const instagramUrl = ficha.instagram
    ? ficha.instagram.startsWith('http')
      ? ficha.instagram
      : `https://instagram.com/${ficha.instagram.replace(/^@/, '')}`
    : null;

  const websiteUrl = ficha.website
    ? ficha.website.startsWith('http')
      ? ficha.website
      : `https://${ficha.website}`
    : null;

  const whatsappClean = ficha.whatsapp ? ficha.whatsapp.replace(/\D/g, '') : null;
  const whatsappUrl = whatsappClean ? `https://wa.me/55${whatsappClean.replace(/^55/, '')}` : null;

  const hasAnySocial = Boolean(
    ficha.website || ficha.instagram || ficha.linkedin || ficha.whatsapp || ficha.email || ficha.phone,
  );

  const nome = ficha.nomeFantasia || ficha.razaoSocial;
  const regime = ficha.regime ? (REGIME[ficha.regime] ?? ficha.regime) : null;
  const abertura = ficha.abertura ? new Date(`${ficha.abertura}T12:00:00Z`).toLocaleDateString('pt-BR') : null;
  const linkedinUrl = ficha.linkedin ? (ficha.linkedin.startsWith('http') ? ficha.linkedin : `https://${ficha.linkedin}`) : null;
  const contatos = [
    websiteUrl && { rotulo: 'Site', valor: ficha.website!.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: websiteUrl },
    instagramUrl && { rotulo: 'Instagram', valor: instagramHandle!, href: instagramUrl },
    linkedinUrl && { rotulo: 'LinkedIn', valor: ficha.linkedin!.replace(/^https?:\/\/(www\.)?linkedin\.com\//, '').replace(/\/$/, ''), href: linkedinUrl },
    whatsappUrl && { rotulo: 'WhatsApp', valor: formatPhone(ficha.whatsapp), href: whatsappUrl },
    ficha.email && { rotulo: 'E-mail', valor: ficha.email, href: `mailto:${ficha.email}` },
    ficha.phone && { rotulo: 'Telefone', valor: formatPhone(ficha.phone), href: `tel:${ficha.phone.replace(/\D/g, '')}` },
  ].filter(Boolean) as { rotulo: string; valor: string; href: string }[];
  const fatos = [
    { rotulo: 'Situação', valor: ficha.situacao === 'ATIVA' ? 'Ativa' : 'Encerrada' },
    regime && { rotulo: 'Regime', valor: regime },
    { rotulo: 'Em atividade há', valor: tempo(ficha.tempoDeAtividade) },
    abertura && { rotulo: 'Fundada em', valor: abertura },
    ficha.city && { rotulo: 'Sede', valor: `${ficha.city}${ficha.state ? `/${ficha.state}` : ''}` },
  ].filter(Boolean) as { rotulo: string; valor: string }[];

  /*
   * A FICHA DA EMPRESA.
   *
   * Em cima, a identidade — o que se compartilha: nome, CNPJ, atividade,
   * sócios, contatos e sede, numa peça só, em texto, sem cards e sem ícones
   * de enfeite. Embaixo, separado, o que é só de quem administra: números do
   * ano, capital, pró-labore e o certificado. Antes eram oito blocos, cada um
   * com ícone, pílula e estilo próprios, misturando as duas coisas.
   */
  return (
    <div className="w-full space-y-16 animate-fade-up pb-20">
      <SectionHero
        title="Minha empresa"
        subtitulo="A ficha da sua empresa"
        infoTitle="Sobre a ficha da empresa"
        infoDescription="Os dados oficiais da empresa, prontos para compartilhar, e os números internos que só você vê."
        rightSlot={
          <div className="flex items-center gap-4">
            <Link
              href={'/minha-empresa/editar' as never}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar cadastro
            </Link>
            <ShareCompanyButton
              companyData={{
                nome,
                razaoSocial: ficha.razaoSocial,
                cnpj: formattedCNPJ,
                regime,
                endereco: fullAddress,
                atividade: ficha.atividadeTexto,
                cnae: ficha.atividadeCodigo,
                website: ficha.website,
                instagram: instagramHandle,
                whatsapp: ficha.whatsapp,
              }}
            />
          </div>
        }
      />

      {/* ── A FICHA ─────────────────────────────────────────────────────── */}
      <article className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#151916]/80 dark:ring-white/5">
        {/* Identidade */}
        <header className="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
          <CompanyLogoBadge logoUrl={ficha.logoUrl} companyName={nome} />
          <div className="min-w-0 flex-1">
            <p className="rotulo text-ink-soft">Ficha da empresa</p>
            <h2 className="mt-2 text-3xl font-light uppercase leading-tight tracking-[0.04em] text-ink sm:text-4xl">{nome}</h2>
            {ficha.nomeFantasia && ficha.nomeFantasia !== ficha.razaoSocial && (
              <p className="mt-1 text-sm text-ink-soft">{ficha.razaoSocial}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm tabular text-ink">CNPJ {formattedCNPJ}</span>
              <CopyButton text={formattedCNPJ} label="Copiar" variant="ghost" />
            </div>
          </div>
        </header>

        {/* Os fatos, numa linha */}
        <dl className="grid grid-cols-2 gap-px border-y border-black/5 bg-black/5 sm:grid-cols-3 lg:grid-cols-5 dark:border-white/10 dark:bg-white/10">
          {fatos.map((f) => (
            <div key={f.rotulo} className="bg-white/80 px-8 py-5 dark:bg-[#151916]/80">
              <dt className="rotulo text-ink-soft">{f.rotulo}</dt>
              <dd className="mt-1.5 text-sm font-semibold text-ink">{f.valor}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-10 p-8 sm:p-10 lg:grid-cols-2">
          {/* Atividade e sede */}
          <div className="space-y-8">
            {ficha.atividadeTexto && (
              <section>
                <p className="rotulo text-ink-soft">Atividade principal</p>
                <p className="mt-2 text-base leading-relaxed text-ink">{ficha.atividadeTexto}</p>
                {ficha.atividadeCodigo && <p className="mt-1 font-mono text-xs text-ink-soft">CNAE {ficha.atividadeCodigo}</p>}
              </section>
            )}
            {fullAddress && (
              <section>
                <p className="rotulo text-ink-soft">Endereço</p>
                <p className="mt-2 text-base leading-relaxed text-ink">{fullAddress}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
                  {formattedCEP && <span className="font-mono">CEP {formattedCEP}</span>}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                  >
                    Abrir no mapa
                  </a>
                </div>
              </section>
            )}
            <section>
              <p className="rotulo text-ink-soft">Contatos</p>
              {contatos.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Nenhum contato cadastrado.{' '}
                  <Link href={'/minha-empresa/editar' as never} className="font-semibold text-ink underline-offset-4 hover:underline">
                    Adicionar
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
                  {contatos.map((c) => (
                    <li key={c.rotulo} className="flex items-baseline justify-between gap-4 py-2.5">
                      <span className="text-xs text-ink-soft">{c.rotulo}</span>
                      <a href={c.href} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-ink underline-offset-4 hover:underline">
                        {c.valor}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sócios */}
          <section>
            <p className="rotulo text-ink-soft">Sócios</p>
            {ficha.socios.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Nenhum sócio cadastrado.</p>
            ) : (
              <ul className="mt-3 space-y-5">
                {ficha.socios.map((s) => (
                  <li key={s.id} className="flex items-center gap-4">
                    <PartnerAvatarBadge partnerId={s.id} partnerName={s.nome} avatarUrl={s.avatarUrl} isCurrentUser={s.isCurrentUser} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-semibold uppercase tracking-[0.04em] text-ink">{s.nome}</p>
                        <p className="shrink-0 font-serif text-sm font-bold tabular text-ink">
                          {s.participacao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                        </p>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <div className="h-full rounded-full bg-hexxa-forest dark:bg-hexxa-lime" style={{ width: `${Math.min(100, s.participacao)}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </article>

      {/* ── SÓ PARA VOCÊ ────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Lock className="h-3.5 w-3.5 text-ink-soft" />
          <p className="rotulo text-ink-soft">Só para você — não entra na ficha compartilhada</p>
        </div>
        <GradeDeResumo>
          <CardResumo
            destaque
            rotulo={`Faturamento em ${ficha.ano}`}
            valor={BRL.format(ficha.faturamentoNoAno)}
            nota={`${ficha.notasNoAno} ${ficha.notasNoAno === 1 ? 'nota emitida' : 'notas emitidas'} · média ${BRL.format(mediaMensalFaturamento)}/mês`}
            href="/meu-negocio/relatorios/faturamento"
          />
          <CardResumo
            rotulo="Capital social"
            valor={capitalSocialTotal > 0 ? BRL.format(capitalSocialTotal) : 'Não informado'}
            nota={ficha.capitalAIntegralizar > 0 ? `${BRL.format(ficha.capitalAIntegralizar)} a integralizar` : 'Conforme o contrato social'}
          />
          <CardResumo
            rotulo="Pró-labore mensal"
            valor={BRL.format(proLaboreConsolidado)}
            nota={`Lucro distribuído no mês: ${BRL.format(lucroDistribuidoMesConsolidado)}`}
            href="/minha-contabilidade/socios"
          />
          <CardResumo
            rotulo="Certificado digital"
            valor={certValidoAte ?? 'Não enviado'}
            tom={!certStatus || certStatus.nivel === 'AUSENTE' || certStatus.nivel === 'VENCIDO' || certStatus.nivel === 'INVALIDO' ? 'negativo' : certStatus.nivel === 'OK' ? 'padrao' : 'alerta'}
            nota={certStatus?.mensagem ?? 'Necessário para emitir nota e buscar faturamento'}
            href="/configuracoes/fiscal"
          />
        </GradeDeResumo>
        <p className="text-xs text-ink-soft">Ticket médio no ano: {BRL.format(ticketMedio)}</p>
      </section>
    </div>
  );
}
