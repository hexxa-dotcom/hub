'use client';

import { ListaEmColunas, Titulo, Valor, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';
import { inssProLabore, irrfMensal, TETO_INSS_2026 } from '@hexxa/core/folha';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Users,
  Plus,
  X,
  Pencil,
  CheckCircle2,
  Coins,
  Send,
  Trash2,
  Loader2,
  TrendingUp,
  Info,
  Calendar,
  Landmark,
  Sparkles,
} from 'lucide-react';
import { LucroCard } from './LucroCard';
import { Card } from '@/components/ui/Card';
import { DistributionRequestForm } from '@/components/profit-distribution/DistributionRequestForm';
import type { PartnerRow } from './actions';
import type { DistributionRow, YearlyProfitSummary, DistributionFrequency } from '@/lib/server/profit-distribution';
import { savePartnerAction, deletePartnerAction, lancarProLaboreMesAction } from './actions';
import { setDistributionFrequencyAction } from '@/lib/server/profit-distribution';

// ── Constants ─────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi =
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lb = 'text-xs font-bold text-ink-soft tracking-wide uppercase';
const YEAR = new Date().getFullYear();

// ── Contas do pró-labore: as de 2026, em @hexxa/core/folha (fonte única) ────
function calcINSS(v: number) { return inssProLabore(v); }
function calcIRRF(bruto: number) { return irrfMensal(bruto, inssProLabore(bruto)); }

function initials(n: string) {
  return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalSocio({
  socio, onSave, onClose, saving,
}: {
  socio: PartnerRow | null;
  onSave: (s: { id?: string; nome: string; cpf: string; participacao: number; prolabore: number }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState(socio?.nome ?? '');
  const [cpf, setCpf] = useState(socio?.cpf ?? '');
  const [part, setPart] = useState(String(socio?.participacao ?? ''));
  const [prol, setProl] = useState(String(socio?.prolabore ?? ''));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: socio?.id, nome, cpf, participacao: Number(part), prolabore: Number(prol.replace(',', '.')) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-surface-card p-6 sm:p-8 shadow-(--elev-3) card-finish space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="rotulo text-ink-soft">
            {socio ? 'Editar Sócio' : 'Novo Sócio'}
          </h2>
          <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1.5 text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lb}>Nome Completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome do sócio" className={`mt-1.5 ${fi}`} />
          </div>
          <div>
            <label className={lb}>CPF</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={`mt-1.5 ${fi}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Participação (%)</label>
              <input value={part} onChange={e => setPart(e.target.value)} type="number" min="0" max="100" step="0.01" required placeholder="50" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Pró-labore (R$)</label>
              <input value={prol} onChange={e => setProl(e.target.value)} inputMode="decimal" required placeholder="3000" className={`mt-1.5 ${fi}`} />
            </div>
          </div>
          <p className="text-[11px] text-ink-soft">INSS (11%) e IRRF pelas tabelas de 2026, com a isenção de IR até R$ 5.000. O pró-labore líquido entra sozinho no financeiro todo mês.</p>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar Sócio'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProLaboreTab ──────────────────────────────────────────────────────────────

function ProLaboreTab({
  socios, prolaboreMinimoRecomendado, fatorRFavoravel, fatorRAplica, anexoApurado,
}: {
  socios: PartnerRow[];
  prolaboreMinimoRecomendado: number;
  fatorRFavoravel: boolean;
  /** O Fator R decide o imposto desta empresa? Ver `fatorRSeAplica`. */
  fatorRAplica: boolean;
  anexoApurado: string | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);

  const totalBruto = socios.reduce((s, x) => s + x.prolabore, 0);
  const totalINSS  = socios.reduce((s, x) => s + calcINSS(x.prolabore), 0);
  const totalIRRF  = socios.reduce((s, x) => s + calcIRRF(x.prolabore), 0);
  const totalLiq   = socios.reduce((s, x) => s + (x.prolabore - calcINSS(x.prolabore) - calcIRRF(x.prolabore)), 0);

  function flashMsg(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 5000);
  }

  async function handleSave(data: { id?: string; nome: string; cpf: string; participacao: number; prolabore: number }) {
    setSaving(true);
    try {
      const result = await savePartnerAction(data);
      flashMsg(result.message);
      setModal({ open: false, editId: null });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmarRemocao(null);
    setBusyId(id);
    try {
      const result = await deletePartnerAction(id);
      flashMsg(result.message);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleLancar(id: string) {
    setBusyId(id);
    try {
      const result = await lancarProLaboreMesAction(id);
      flashMsg(result.message);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const editingSocio = modal.editId ? (socios.find(s => s.id === modal.editId) ?? null) : null;
  const faltaParaFatorR = Math.max(0, prolaboreMinimoRecomendado - totalBruto);

  return (
    <>
      {flash && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}

      {/*
        Recomendação de pró-labore pelo Fator R — só quando ele decide o
        imposto. Para quem está no Anexo III pela atividade, recomendar mais
        pró-labore é recomendar mais INSS sem ganho nenhum.
      */}
      {!fatorRAplica ? (
        <Card level={1} className="p-6 card-finish">
          <h3 className="text-sm font-semibold text-ink">O Fator R não decide o seu imposto</h3>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            O contábil apurou sua empresa no Anexo {anexoApurado ?? 'III'}. Aumentar o pró-labore não
            reduz o imposto — só aumenta o INSS. Defina o valor pelo que faz sentido para os sócios, e
            fale com o seu contador antes de mudar.
          </p>
        </Card>
      ) : (
      <Card level={1} className={`p-6 card-finish ${fatorRFavoravel ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className="flex items-start gap-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${fatorRFavoravel ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">
              {fatorRFavoravel ? 'Pró-labore Atual Mantém Fator R Favorável' : 'Pró-labore Atual Abaixo do Recomendado'}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft">
              Para manter o Fator R ≥ 28% (Anexo III, menor alíquota), o pró-labore total recomendado é{' '}
              <strong className="font-serif tabular text-ink">{BRL.format(prolaboreMinimoRecomendado)}</strong>/mês. Hoje a soma é <strong className="font-serif tabular text-ink">{BRL.format(totalBruto)}</strong>/mês.
            </p>
            {!fatorRFavoravel && faltaParaFatorR > 0 && (
              <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                Faltam <span className="font-serif tabular">{BRL.format(faltaParaFatorR)}</span>/mês em pró-labore para reenquadrar no Anexo III.
              </p>
            )}
            <p className="mt-2 flex items-start gap-1 text-[11px] text-ink-soft">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Otimize o equilíbrio entre Pró-labore (com encargos) e Distribuição de Lucros (isenta de IRPF).
            </p>
          </div>
        </div>
      </Card>
      )}

      <GradeDeResumo>
        <CardResumo destaque rotulo="Pró-labore líquido" valor={BRL.format(totalLiq)} nota="O que os sócios recebem no mês" />
        <CardResumo rotulo="Pró-labore bruto" valor={BRL.format(totalBruto)} nota="Antes dos descontos" />
        <CardResumo rotulo="INSS (11%)" valor={BRL.format(totalINSS)} tom={totalINSS > 0 ? 'alerta' : 'padrao'} nota="Retido na fonte" />
        <CardResumo rotulo="IRRF" valor={BRL.format(totalIRRF)} tom={totalIRRF > 0 ? 'negativo' : 'padrao'} nota="Imposto de renda retido" />
      </GradeDeResumo>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rotulo text-ink-soft">Sócios</p>
          <button
            type="button"
            onClick={() => setModal({ open: true, editId: null })}
            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-4 w-4" /> Novo sócio
          </button>
        </div>
        <ListaEmColunas
          colunas={[
            { rotulo: 'Sócio', largura: 'minmax(0,1fr)' },
            { rotulo: 'Pró-labore', largura: '8rem', alinhar: 'direita', soDesktop: true },
            { rotulo: 'INSS e IRRF', largura: '8rem', alinhar: 'direita', soDesktop: true },
            { rotulo: 'Líquido', largura: '8rem', alinhar: 'direita' },
          ]}
          itens={socios}
          chave={(x) => x.id}
          vazio="Nenhum sócio cadastrado ainda."
          celulas={(x) => {
            const nome = nomeDeExibicao(x.nome);
            const desc = calcINSS(x.prolabore) + calcIRRF(x.prolabore);
            return [
              <Titulo key="t" nome={nome} monograma={iniciais(nome)} apoio={`${x.participacao}% de participação${x.cpf ? ` · CPF ***.${x.cpf.replace(/\D/g, '').slice(3, 6)}.${x.cpf.replace(/\D/g, '').slice(6, 9)}-**` : ''}`} />,
              <Valor key="b" vazio={!x.prolabore}>{BRL.format(x.prolabore)}</Valor>,
              <Valor key="d" tom="suave" vazio={!desc}>− {BRL.format(desc)}</Valor>,
              <Valor key="l" tom="entrada" vazio={!x.prolabore}>{BRL.format(x.prolabore - desc)}</Valor>,
            ];
          }}
          detalhe={(x) => {
            const i = calcINSS(x.prolabore);
            const r = calcIRRF(x.prolabore);
            return (
              <Detalhe
                acoes={
                  <>
                    <BotaoDiscreto onClick={() => setModal({ open: true, editId: x.id })}>Editar</BotaoDiscreto>
                    {x.prolabore > 0 && (
                      <BotaoDiscreto onClick={() => handleLancar(x.id)}>
                        {busyId === x.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar agora
                      </BotaoDiscreto>
                    )}
                    {confirmarRemocao === x.id ? (
                      <span className="flex items-center gap-3 px-2 py-1.5 text-xs font-semibold">
                        <span className="font-normal text-ink-soft">Remover o sócio?</span>
                        <button type="button" disabled={busyId === x.id} onClick={() => handleDelete(x.id)} className="text-rose-600 disabled:opacity-50 dark:text-rose-400">Sim</button>
                        <button type="button" onClick={() => setConfirmarRemocao(null)} className="text-ink-soft hover:text-ink">Não</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmarRemocao(x.id)} className="px-2 py-1.5 text-xs font-semibold text-ink-soft hover:text-rose-600">
                        Remover
                      </button>
                    )}
                  </>
                }
              >
                <Campo rotulo="Pró-labore bruto"><span className="font-serif tabular">{BRL.format(x.prolabore)}</span></Campo>
                <Campo rotulo="INSS (11%)"><span className="font-serif tabular">− {BRL.format(i)}</span></Campo>
                <Campo rotulo="IRRF"><span className="font-serif tabular">− {BRL.format(r)}</span></Campo>
                <Campo rotulo="Líquido" largo>
                  <span className="font-serif tabular">{BRL.format(x.prolabore - i - r)}</span>
                  <span className="text-ink-soft"> · entra no financeiro sozinho todo dia 1º</span>
                </Campo>
              </Detalhe>
            );
          }}
        />
      </section>

      <p className="text-xs text-ink-soft px-1">
        INSS: 11% sobre o pró-labore, limitado a {BRL.format(TETO_INSS_2026 * 0.11)} (teto de 2026). IRRF pela tabela progressiva vigente, sobre a base já sem o INSS, com a isenção até R$ 5.000.
      </p>

      {modal.open && (
        <ModalSocio
          socio={editingSocio}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editId: null })}
          saving={saving}
        />
      )}
    </>
  );
}

// ── Lucro Acumulado do Ano + Periodicidade ──────────────────────────────────────

const FREQUENCIAS: { id: DistributionFrequency; label: string }[] = [
  { id: 'MENSAL', label: 'Mensal' },
  { id: 'TRIMESTRAL', label: 'Trimestral' },
  { id: 'SEMESTRAL', label: 'Semestral' },
  { id: 'ANUAL', label: 'Anual' },
];

function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function YearlyProfitBanner({ yearlyProfit }: { yearlyProfit: YearlyProfitSummary }) {
  const router = useRouter();
  const [frequency, setFrequency] = useState(yearlyProfit.frequency);
  const [saving, setSaving] = useState(false);

  async function handleFrequency(f: DistributionFrequency) {
    if (f === frequency) return;
    setFrequency(f);
    setSaving(true);
    try {
      await setDistributionFrequencyAction(f);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-6 card-finish">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h2 className="rotulo text-ink-soft">Lucro Acumulado em {yearlyProfit.year}</h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              {yearlyProfit.fonte === 'OFICIAL'
                ? `Resultado da contabilidade oficial, acumulado até ${yearlyProfit.mesOficial?.split('-').reverse().join('/')}.`
                : 'Resultado da contabilidade oficial.'}
            </p>
          </div>
        </div>
      </div>

      {/*
        Sem lucro oficial, nenhum número. "R$ 0,00 disponível" leria como
        "a empresa não teve lucro" — e o que é verdade é outra coisa: o número
        ainda não existe. Dizer o motivo é a diferença entre as duas.
      */}
      {yearlyProfit.fonte === 'INDISPONIVEL' ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-xs leading-relaxed text-amber-900 dark:text-amber-300">
          <p className="font-bold">Distribuição indisponível por enquanto</p>
          <p className="mt-1">{yearlyProfit.motivoIndisponivel}</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="rotulo text-ink-soft">Lucro Líquido do Ano</p>
          <p className="mt-1 font-serif tabular font-bold text-xl sm:text-2xl text-ink">{BRL.format(yearlyProfit.netProfit)}</p>
        </div>
        <div>
          <p className="rotulo text-ink-soft">Já Distribuído em {yearlyProfit.year}</p>
          <p className="mt-1 font-serif tabular font-bold text-xl sm:text-2xl text-ink-soft">{BRL.format(yearlyProfit.distributedThisYear)}</p>
        </div>
        <div className="col-span-2 rounded-2xl bg-hexxa-forest text-hexxa-lime border border-white/5 px-5 py-3 sm:col-span-2 shadow-(--elev-inset)">
          <p className="rotulo text-hexxa-lime/80">Disponível para Distribuir</p>
          <p className="mt-0.5 font-serif tabular font-bold text-2xl text-hexxa-lime">{BRL.format(yearlyProfit.availableToDistribute)}</p>
        </div>
      </div>
      )}

      <div className="border-t border-black/5 dark:border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">Periodicidade de Distribuição</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <Calendar className="h-3.5 w-3.5" /> Próxima sugerida: <strong className="font-serif tabular text-ink">{fmtDateShort(yearlyProfit.nextSuggestedDate)}</strong>
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-1">
            {FREQUENCIAS.map(f => (
              <button
                key={f.id}
                type="button"
                disabled={saving}
                onClick={() => handleFrequency(f.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  frequency === f.id ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-1)' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── DistribuicaoTab ───────────────────────────────────────────────────────────

function DistribuicaoTab({
  distribuicoes,
  yearlyProfit,
  partners,
  onConfirmed,
}: {
  distribuicoes: DistributionRow[];
  yearlyProfit: YearlyProfitSummary;
  partners: PartnerRow[];
  onConfirmed: () => void;
}) {
  const total = distribuicoes.reduce((s, d) => s + d.amount, 0);
  const partnersCount = new Set(distribuicoes.map(d => d.partnerName)).size;

  return (
    <>
      <YearlyProfitBanner yearlyProfit={yearlyProfit} />
      <LucroCard />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
          <div className="flex items-start justify-between">
            <h3 className="rotulo text-hexxa-lime">Total Distribuído em {YEAR}</h3>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-hexxa-lime shadow-(--elev-inset)">
              <Coins className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 font-serif tabular font-bold text-3xl sm:text-4xl text-hexxa-sand">{BRL.format(total)}</p>
          <p className="mt-1 text-xs text-hexxa-lime/80">{distribuicoes.length} lançamento(s) registrado(s)</p>
        </Card>
        <Card level={1} className="p-6 sm:p-8 card-finish">
          <div className="flex items-start justify-between">
            <h3 className="rotulo text-ink-soft">Sócios Contemplados</h3>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 font-serif tabular font-bold text-3xl sm:text-4xl text-ink">{partnersCount}</p>
          <p className="mt-1 text-xs text-ink-soft">no histórico anual</p>
        </Card>
      </div>

      <DistributionRequestForm
        partners={partners.map((p) => ({ id: p.id, nome: p.nome, participacao: p.participacao }))}
        availableToDistribute={yearlyProfit.availableToDistribute}
        indisponivel={yearlyProfit.motivoIndisponivel}
        onConfirmed={onConfirmed}
      />

      <Card level={1} className="p-6 sm:p-8 card-finish">
        <h2 className="rotulo text-ink-soft">Histórico de Distribuições</h2>
        {distribuicoes.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nenhuma distribuição lançada ainda.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <ListaEmColunas
              colunas={[
                { rotulo: 'Sócio', largura: 'minmax(0,1fr)' },
                { rotulo: 'Data', largura: '6rem', alinhar: 'direita', soDesktop: true },
                { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
              ]}
              itens={distribuicoes}
              chave={(d) => d.id}
              celulas={(d) => [
                <Titulo key="t" nome={nomeDeExibicao(d.partnerName)} apoio={d.notes ?? undefined} />,
                <span key="d" className="text-xs tabular text-ink-soft">{fmtDate(d.distributedAt)}</span>,
                <Valor key="v">{BRL.format(d.amount)}</Valor>,
              ]}
            />
            <p className="flex items-center justify-between px-6 text-sm">
              <span className="rotulo text-ink-soft">Total distribuído</span>
              <span className="font-serif font-bold tabular text-ink">{BRL.format(total)}</span>
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-soft">
          Lucro distribuído é isento de IR para o sócio. A contabilidade leva estas distribuições para a escrituração e para a declaração anual.
        </p>
      </Card>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HubSocios({
  initialPartners, initialDistribuicoes, prolaboreMinimoRecomendado, fatorRFavoravel,
  fatorRAplica = true, anexoApurado = null, yearlyProfit,
}: {
  initialPartners: PartnerRow[];
  initialDistribuicoes: DistributionRow[];
  prolaboreMinimoRecomendado: number;
  prolaboreAtualTotal: number;
  fatorRFavoravel: boolean;
  fatorRAplica?: boolean;
  anexoApurado?: string | null;
  yearlyProfit: YearlyProfitSummary;
}) {
  const [tab, setTab] = useState<'prolabore' | 'distribuicao'>('prolabore');
  const router = useRouter();

  return (
    <div className="space-y-8">
      <div className="flex overflow-x-auto no-scrollbar py-1">
        <SegmentedTabs
          tabs={[
            { id: 'prolabore', label: 'Pró-labore', icon: Coins },
            { id: 'distribuicao', label: 'Distribuição de Lucros', icon: TrendingUp },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="sociosTabsIndicator"
        />
      </div>

      {tab === 'prolabore'
        ? <ProLaboreTab socios={initialPartners} prolaboreMinimoRecomendado={prolaboreMinimoRecomendado} fatorRFavoravel={fatorRFavoravel} fatorRAplica={fatorRAplica} anexoApurado={anexoApurado} />
        : <DistribuicaoTab
            distribuicoes={initialDistribuicoes}
            yearlyProfit={yearlyProfit}
            partners={initialPartners}
            onConfirmed={() => router.refresh()}
          />}
    </div>
  );
}

