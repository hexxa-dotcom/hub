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
} from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getFichaDaEmpresa } from '@/lib/server/ficha-da-empresa';
import { getStatusDoCertificado } from '@/lib/server/certificado';
import { SectionHero } from '@/components/ui/SectionHero';
import { CopyButton, ShareCompanyButton, OpenMapsButton } from './CompanyProfileActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfil da Empresa · Hexxa Hub' };

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const REGIME: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
};

/** "3 anos e 2 meses" — meses soltos não dizem nada a ninguém. */
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] || 'S').toUpperCase();
  return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`.toUpperCase();
}

export default async function Page() {
  const tenantCtx = await getTenantContext();
  const ficha = await getFichaDaEmpresa(tenantCtx);
  if (!ficha) notFound();

  const certStatus = await getStatusDoCertificado(tenantCtx).catch(() => null);

  const formattedCNPJ = formatCNPJ(ficha.cnpj);
  const formattedCEP = formatCEP(ficha.zipcode);
  const fullAddress = ficha.endereco || '';

  // Cálculos financeiros e de inteligência
  const currentMonthIdx = new Date().getMonth() + 1;
  const mediaMensalFaturamento = ficha.faturamentoNoAno > 0 ? ficha.faturamentoNoAno / currentMonthIdx : 0;
  const ticketMedio = ficha.notasNoAno > 0 ? ficha.faturamentoNoAno / ficha.notasNoAno : 0;
  const capitalSocialTotal = ficha.capitalSocial ?? 0;

  // Data de validade do certificado digital
  const certValidoAte = certStatus?.ficha?.validoAte
    ? new Date(`${certStatus.ficha.validoAte}T12:00:00Z`).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="w-full space-y-8 animate-fade-up pb-20">
      {/* Top Section Hero */}
      <SectionHero
        title="Perfil da Empresa"
        infoTitle="Sobre o Perfil da Empresa"
        infoDescription="Ficha cadastral corporativa, quadro societário, regime tributário, atividades econômicas e visão consolidada da empresa."
        rightSlot={
          <div className="flex items-center gap-2">
            <ShareCompanyButton
              companyData={{
                nome: ficha.nomeFantasia || ficha.razaoSocial,
                razaoSocial: ficha.razaoSocial,
                cnpj: formattedCNPJ,
                regime: ficha.regime ? (REGIME[ficha.regime] ?? ficha.regime) : null,
                endereco: fullAddress,
                atividade: ficha.atividadeTexto,
                cnae: ficha.atividadeCodigo,
              }}
            />
            <Link
              href={'/minha-empresa/editar' as any}
              className="tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-ink-soft" />
              <span>Editar Cadastro</span>
            </Link>
          </div>
        }
      />

      {/* MASTER EXECUTIVE BANNER: O Retrato Corporativo com Faturamento Desencapsulado */}
      <div className="relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-6 sm:p-8 lg:p-10 shadow-(--elev-1)">
        {/* Glow atmosférico suave no fundo */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/5" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-[#D4FF00]/10 blur-3xl dark:bg-[#D4FF00]/5" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Lado Esquerdo: Identidade, Logo Redondo, Nomes, Tags e CNPJ */}
          <div className="flex items-start sm:items-center gap-5 sm:gap-7 min-w-0 flex-1">
            {/* Logo Redondo (padrão circular do sistema) */}
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E3328] to-[#2F4A3C] text-[#DFFFAE] border-2 border-[#2F4A3C] shadow-xl font-serif text-3xl sm:text-4xl font-black select-none">
              {(ficha.nomeFantasia || ficha.razaoSocial)[0]?.toUpperCase() || 'H'}
            </div>

            <div className="space-y-2 min-w-0 flex-1">
              {/* Badges de Enquadramento */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-bold text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-hexxa-forest dark:bg-hexxa-lime" />
                  {ficha.regime ? (REGIME[ficha.regime] ?? ficha.regime) : 'Simples Nacional'}
                  <span className="text-[10px] text-ink-soft font-semibold">• Anexo III</span>
                </span>

                {ficha.tempoDeAtividade !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-medium text-ink-soft">
                    <Clock className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" />
                    <span>No mercado há {tempo(ficha.tempoDeAtividade)}</span>
                  </span>
                )}

                {ficha.abertura && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-medium text-ink-soft">
                    <Calendar className="h-3.5 w-3.5 text-ink-soft/70" />
                    <span>Aberta em {new Date(`${ficha.abertura}T12:00:00Z`).toLocaleDateString('pt-BR')}</span>
                  </span>
                )}
              </div>

              {/* Título Principal */}
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight truncate">
                  {ficha.nomeFantasia || ficha.razaoSocial}
                </h1>
                {ficha.nomeFantasia && (
                  <p className="text-sm sm:text-base text-ink-soft font-medium truncate mt-0.5">
                    {ficha.razaoSocial}
                  </p>
                )}
              </div>

              {/* Barra do CNPJ com Cópia rápida */}
              <div className="pt-1 flex items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 px-3 py-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">CNPJ:</span>
                  <span className="font-mono text-sm font-bold text-ink tracking-tight">
                    {formattedCNPJ}
                  </span>
                </div>
                <CopyButton text={formattedCNPJ} label="Copiar CNPJ" variant="pill" />
              </div>
            </div>
          </div>

          {/* Lado Direito: Faturamento Anual Integrado Direto no Card (Sem encapsulamento) */}
          <div className="flex flex-col justify-center items-start lg:items-end min-w-[280px] lg:min-w-[340px] shrink-0 space-y-2 lg:text-right border-t lg:border-t-0 lg:border-l border-black/5 dark:border-white/10 pt-4 lg:pt-0 lg:pl-8">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Faturamento no Ano ({ficha.ano})
            </span>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink font-mono tabular tracking-tight">
              {BRL.format(ficha.faturamentoNoAno)}
            </div>
            <div className="space-y-0.5 text-xs text-ink-soft pt-1">
              <p>
                Média mensal de <span className="font-bold text-ink font-mono">{BRL.format(mediaMensalFaturamento)}</span>
              </p>
              <p>
                Ticket médio de <span className="font-bold text-ink font-mono">{BRL.format(ticketMedio)}</span> ({ficha.notasNoAno} {ficha.notasNoAno === 1 ? 'nota emitida' : 'notas emitidas'})
              </p>
            </div>
            <div className="pt-1">
              <Link
                href="/meu-negocio/notas"
                className="text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline inline-flex items-center gap-1"
              >
                <span>Ver notas fiscais</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL EM 2 COLUNAS: Sócios & Capital Social (Esquerda) e Atividades, Localização & Certificado (Direita) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* COLUNA ESQUERDA (7 colunas): Quadro Societário + Capital Social diretamente abaixo */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Quadro de Sócios & Governança (QSA) */}
          <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-6 sm:p-8 shadow-(--elev-1) space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">Quadro de Sócios & Governança (QSA)</h2>
                  <p className="text-xs text-ink-soft">Composição societária, pró-labore e distribuição de lucros</p>
                </div>
              </div>

              <Link
                href="/minha-contabilidade/socios"
                className="tap-target pressable text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline flex items-center gap-1"
              >
                <span>Gerenciar</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {ficha.socios.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center space-y-2">
                <Users className="h-8 w-8 text-ink-soft mx-auto opacity-50" />
                <p className="text-sm font-medium text-ink">Nenhum sócio cadastrado ainda</p>
                <p className="text-xs text-ink-soft max-w-sm mx-auto">
                  O cadastro de sócios é fundamental para calcular pró-labore mensal e a distribuição isenta de lucros.
                </p>
                <Link
                  href="/minha-contabilidade/socios"
                  className="inline-flex items-center gap-2 mt-2 rounded-full bg-hexxa-forest px-4 py-2 text-xs font-bold text-[#DFFFAE]"
                >
                  Cadastrar sócios agora
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {ficha.socios.map((s) => {
                  const cotaCapital = capitalSocialTotal > 0 ? (capitalSocialTotal * s.participacao) / 100 : 0;
                  return (
                    <div
                      key={`${s.nome}-${s.cpf}`}
                      className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-4 transition-all hover:border-black/10 dark:hover:border-white/10"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-hexxa-forest/20 to-emerald-500/20 text-hexxa-forest dark:text-hexxa-lime font-bold text-sm">
                            {getInitials(s.nome)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-ink truncate">{s.nome}</h3>
                            <div className="flex items-center gap-2 text-xs text-ink-soft">
                              <span className="font-semibold text-ink">Sócio-Administrador</span>
                              <span>•</span>
                              <span className="font-mono flex items-center gap-1">
                                <Lock className="h-3 w-3 opacity-60" /> CPF: {maskCPF(s.cpf)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-sm px-3 py-1 border border-emerald-500/20">
                            {s.participacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% das Quotas
                          </span>
                        </div>
                      </div>

                      {/* Barra visual de participação societária (Equity bar) */}
                      <div className="space-y-1">
                        <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-hexxa-forest to-emerald-500 dark:from-hexxa-lime dark:to-emerald-400 transition-all duration-500"
                            style={{ width: `${Math.max(2, Math.min(100, s.participacao))}%` }}
                          />
                        </div>
                      </div>

                      {/* Detalhes de Cota, Pró-labore e Lucro Distribuído no Mês */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                            Cota no Capital
                          </span>
                          <span className="font-mono font-bold text-ink text-sm mt-0.5 block">
                            {cotaCapital > 0 ? BRL.format(cotaCapital) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                            Pró-labore Mensal
                          </span>
                          <span className="font-mono font-bold text-ink text-sm mt-0.5 block">
                            {s.proLabore > 0 ? BRL.format(s.proLabore) : (
                              <span className="text-ink-soft font-normal text-xs">Sem pró-labore</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                            Lucro Distribuído (Mês)
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                            {s.lucroDistribuidoMes > 0 ? BRL.format(s.lucroDistribuidoMes) : 'R$ 0,00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Card: Capital Social & Estrutura Patrimonial (DIRETAMENTE ABAIXO DOS SÓCIOS) */}
          <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-6 sm:p-8 shadow-(--elev-1) space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">Capital Social & Integralização</h2>
                  <p className="text-xs text-ink-soft">Registro societário e patrimônio integralizado</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>100% Integralizado</span>
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft block">
                    Capital Social Subscrito
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-ink font-mono tabular tracking-tight mt-0.5">
                    {capitalSocialTotal > 0 ? BRL.format(capitalSocialTotal) : 'Não informado'}
                  </div>
                </div>

                <div className="text-xs text-ink-soft sm:text-right">
                  <span>Registro oficial: </span>
                  <span className="font-semibold text-ink">Junta Comercial (JUCESC)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-black/5 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-ink block">Composição Patrimonial</span>
                  <p className="text-ink-soft">
                    Integralizado integralmente em moeda corrente nacional (sem integralização em bens ou imóveis).
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold text-ink block">Direito a Lucros</span>
                  <p className="text-ink-soft">
                    Sem saldo a integralizar — distribuição de lucros aos sócios 100% liberada e isenta.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA (5 colunas): Atividades, Endereço e Certificado Digital Discreto */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Atividade Econômica (CNAE) */}
          <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-6 sm:p-7 shadow-(--elev-1) space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Atividade Econômica (CNAE)</h2>
                <p className="text-xs text-ink-soft">Enquadramento fiscal e descrição oficial</p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-3.5">
              {ficha.atividadeCodigo && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-hexxa-forest/10 dark:bg-hexxa-lime/15 px-3 py-1 text-xs font-mono font-extrabold text-hexxa-forest dark:text-hexxa-lime">
                  CNAE Principal: {ficha.atividadeCodigo}
                </div>
              )}
              <p className="text-sm font-semibold text-ink leading-relaxed">
                {ficha.atividadeTexto || 'Atividade principal não informada'}
              </p>

              <div className="pt-3 text-xs text-ink-soft border-t border-black/5 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Regime Tributário</span>
                  <span className="font-bold text-ink">Simples Nacional • Anexo III</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Alíquota Inicial</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">6,00%</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>Atividades Secundárias</span>
                  <span className="font-medium text-ink truncate max-w-[180px]" title="Contabilidade, Consultoria, TI, Edição">
                    Contabilidade, TI, Consultoria
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Card: Sede & Endereço Oficial */}
          <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-6 sm:p-7 shadow-(--elev-1) space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Sede & Endereço Oficial</h2>
                <p className="text-xs text-ink-soft">Endereço cadastrado na Receita Federal</p>
              </div>
            </div>

            {fullAddress ? (
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-3.5">
                <div>
                  <p className="text-sm sm:text-base font-bold text-ink leading-snug">
                    {fullAddress}
                  </p>
                  {formattedCEP && (
                    <p className="text-xs text-ink-soft font-mono mt-1">
                      CEP: {formattedCEP}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center gap-2">
                  <CopyButton text={fullAddress} label="Copiar Endereço" />
                  <OpenMapsButton address={fullAddress} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-5 text-center space-y-1 text-xs text-ink-soft">
                <p>Nenhum endereço cadastrado para esta empresa.</p>
                <Link href="/configuracoes" className="font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline block pt-1">
                  Adicionar endereço
                </Link>
              </div>
            )}
          </section>

          {/* Card: Certificado Digital A1 (DISCRETO E COMPACTO) */}
          <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#151916]/70 backdrop-blur-2xl p-5 sm:p-6 shadow-(--elev-1) flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft truncate">
                    Certificado Digital A1
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Operacional
                  </span>
                </div>
                <p className="text-sm font-bold text-ink truncate mt-0.5">
                  {certValidoAte ? `Válido até ${certValidoAte}` : 'ICP-Brasil A1 Validado'}
                </p>
                <p className="text-[11px] text-ink-soft truncate">
                  Titular: {certStatus?.ficha?.titular || ficha.razaoSocial}
                </p>
              </div>
            </div>

            <Link
              href="/minha-contabilidade/arquivos"
              className="tap-target pressable text-xs font-bold text-ink-soft hover:text-ink hover:underline shrink-0 flex items-center gap-1"
            >
              <span>Chaves</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </section>
        </div>
      </div>

      {/* RODAPÉ EXECUTIVO COM AÇÕES RÁPIDAS E COMPARTILHAMENTO */}
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-[#151916]/60 backdrop-blur-xl p-6 sm:p-7 shadow-(--elev-1) flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-ink">
            Ações Rápidas & Documentos Corporativos
          </h3>
          <p className="text-xs text-ink-soft max-w-xl">
            Acesse rapidamente os módulos contábeis, notas fiscais e documentos vinculados a esta empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={'/minha-empresa/editar' as any}
            className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs"
          >
            <Pencil className="h-3.5 w-3.5 text-ink-soft" />
            <span>Editar Cadastro</span>
          </Link>
          <Link
            href="/meu-negocio/notas"
            className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs"
          >
            <Receipt className="h-3.5 w-3.5 text-ink-soft" />
            <span>Minhas Notas</span>
          </Link>
          <Link
            href="/minha-contabilidade/socios"
            className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs"
          >
            <Users className="h-3.5 w-3.5 text-ink-soft" />
            <span>Sócios & Pró-labore</span>
          </Link>
          <Link
            href="/minha-contabilidade/arquivos"
            className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs"
          >
            <FolderOpen className="h-3.5 w-3.5 text-ink-soft" />
            <span>Documentos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
