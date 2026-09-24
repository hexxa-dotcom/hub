'use client';

import { useState, useTransition } from 'react';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { aprovarCadastroAction, trazerDoOneflowAction } from './aprovacao-actions';

/**
 * Aprovar o cadastro do cliente — e criá-lo no OneFlow.
 *
 * Dois passos, porque a API do OneFlow cria empresa mas não exclui: o que
 * for criado errado sai à mão, lá. O primeiro passo mostra o que vai ser
 * enviado; o segundo cria.
 *
 * Depois de aprovado, o cartão vira o elo de volta: as regras tributárias
 * são definidas no OneFlow, e "Trazer do OneFlow" as espelha aqui.
 */

const REGIMES: { v: string; nome: string }[] = [
  { v: '1', nome: 'Simples Nacional' },
  { v: '8', nome: 'MEI' },
  { v: '2', nome: 'Simples — excesso de sublimite' },
  { v: '3', nome: 'Lucro Presumido' },
  { v: '4', nome: 'Lucro Real' },
  { v: '9', nome: 'Isento' },
  { v: '5', nome: 'Produtor rural' },
];

const ATIVIDADES: { v: string; nome: string }[] = [
  { v: '2', nome: 'Prestação de serviços' },
  { v: '1', nome: 'Comércio varejista' },
  { v: '4', nome: 'Comércio atacadista' },
  { v: '0', nome: 'Indústria' },
  { v: '3', nome: 'Construção civil' },
  { v: '5', nome: 'Comércio exportador' },
  { v: '6', nome: 'Importador (varejo)' },
  { v: '7', nome: 'Importador (atacado)' },
  { v: '8', nome: 'Associação' },
  { v: '9', nome: 'Órgão público' },
];

const MODULOS = [
  { v: 'FIS', nome: 'Fiscal' },
  { v: 'CTL', nome: 'Contábil' },
  { v: 'FPG', nome: 'Folha' },
] as const;

type Modulo = (typeof MODULOS)[number]['v'];

export interface ResumoDoCadastro {
  razao: string;
  cnpj: string;
  endereco: string;
  responsavel: { nome: string; email: string; cpf: string | null; celular: string | null } | null;
}

const rotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#6E6A61] dark:text-[#A8A49C]';
const campo =
  'w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#231F20] dark:border-white/15 dark:bg-[#0E1110] dark:text-[#F5F6F4]';

export function AprovacaoCard({
  companyId,
  noOneflowDesde,
  aprovado,
  regimeSugerido,
  competenciaPadrao,
  faltando,
  resumo,
}: {
  companyId: string;
  noOneflowDesde: string | null;
  aprovado: boolean;
  regimeSugerido: string | null;
  /** 'AAAAMM'. */
  competenciaPadrao: string;
  faltando: string[];
  resumo: ResumoDoCadastro;
}) {
  const [regime, setRegime] = useState(regimeSugerido ?? '');
  const [atividade, setAtividade] = useState('2');
  const [competencia, setCompetencia] = useState(
    `${competenciaPadrao.slice(0, 4)}-${competenciaPadrao.slice(4, 6)}`,
  );
  const [modulos, setModulos] = useState<Modulo[]>(['FIS', 'CTL', 'FPG']);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string; avisos?: string[] } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const moldura = 'rounded-3xl border border-black/5 p-6 shadow-sm surface-panel dark:border-white/10';

  const Mensagem = () =>
    msg ? (
      <div
        className={`mt-3 rounded-2xl p-3 text-xs ${
          msg.ok
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-500/10 text-red-700 dark:text-red-300'
        }`}
      >
        <p className="font-medium">{msg.texto}</p>
        {msg.avisos?.map((a) => (
          <p key={a} className="mt-1 opacity-80">
            {a}
          </p>
        ))}
      </div>
    ) : null;

  /* ── Já está no OneFlow: o elo de volta ─────────────────────────────── */
  if (noOneflowDesde) {
    return (
      <div className={moldura}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          <h2 className="font-serif text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Cadastro aprovado</h2>
        </div>
        <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          No OneFlow desde {noOneflowDesde}. As regras tributárias são definidas lá; traga-as para cá depois de
          configurar ou alterar.
        </p>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => iniciar(async () => setMsg(await trazerDoOneflowAction(companyId).then((r) => ({ ok: r.ok, texto: r.mensagem, avisos: r.avisos }))))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-1.5 text-xs font-bold text-[#231F20] disabled:opacity-40 dark:border-white/15 dark:text-[#F5F6F4]"
        >
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Trazer do OneFlow
        </button>
        <Mensagem />
      </div>
    );
  }

  /* ── Aguardando aprovação ───────────────────────────────────────────── */
  const aaaamm = competencia.replace('-', '');
  const podeAprovar = !faltando.length && !!regime && modulos.length > 0 && /^\d{6}$/.test(aaaamm);

  return (
    <div className={`${moldura} ${aprovado ? '' : 'ring-1 ring-amber-500/40'}`}>
      <h2 className="font-serif text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
        {aprovado ? 'Criar no OneFlow' : 'Cadastro aguardando aprovação'}
      </h2>
      <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Ao aprovar, a empresa é criada no OneFlow com os módulos abaixo e o cliente passa a acessar a Hexx.
      </p>

      <dl className="mt-4 space-y-1.5 text-xs">
        {[
          ['Empresa', `${resumo.razao} · ${resumo.cnpj}`],
          ['Endereço', resumo.endereco || '—'],
          ['Responsável', resumo.responsavel ? `${resumo.responsavel.nome} · ${resumo.responsavel.email}` : '—'],
          [
            'CPF / celular',
            resumo.responsavel ? `${resumo.responsavel.cpf ?? '—'} · ${resumo.responsavel.celular ?? '—'}` : '—',
          ],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-24 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]">{k}</dt>
            <dd className="text-[#231F20] dark:text-[#F5F6F4]">{v}</dd>
          </div>
        ))}
      </dl>

      {faltando.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-bold">O OneFlow exige, e ainda falta:</p>
          <p className="mt-1">{faltando.join(' · ')}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="ap-regime">
            Regime tributário
          </label>
          <select id="ap-regime" className={campo} value={regime} onChange={(e) => setRegime(e.target.value)}>
            <option value="">Escolha…</option>
            {REGIMES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.nome}
              </option>
            ))}
          </select>
          {regimeSugerido && regime === regimeSugerido && (
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Sugerido pela Receita (optante do Simples).</p>
          )}
        </div>
        <div>
          <label className={rotulo} htmlFor="ap-atividade">
            Atividade
          </label>
          <select id="ap-atividade" className={campo} value={atividade} onChange={(e) => setAtividade(e.target.value)}>
            {ATIVIDADES.map((a) => (
              <option key={a.v} value={a.v}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="ap-comp">
            Competência inicial
          </label>
          <input
            id="ap-comp"
            type="month"
            className={campo}
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          />
        </div>
        <div>
          <span className={rotulo}>Módulos</span>
          <div className="flex flex-wrap gap-3 pt-1.5">
            {MODULOS.map((m) => (
              <label key={m.v} className="flex items-center gap-1.5 text-xs text-[#231F20] dark:text-[#F5F6F4]">
                <input
                  type="checkbox"
                  checked={modulos.includes(m.v)}
                  onChange={(e) =>
                    setModulos((atual) => (e.target.checked ? [...atual, m.v] : atual.filter((x) => x !== m.v)))
                  }
                />
                {m.nome}
              </label>
            ))}
          </div>
        </div>
      </div>

      {!confirmando ? (
        <button
          type="button"
          disabled={!podeAprovar}
          onClick={() => {
            setMsg(null);
            setConfirmando(true);
          }}
          className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Aprovar cadastro
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-black/10 p-3 dark:border-white/15">
          <p className="text-xs text-[#231F20] dark:text-[#F5F6F4]">
            A empresa será criada no OneFlow como{' '}
            <strong>{REGIMES.find((r) => r.v === regime)?.nome}</strong>, a partir de{' '}
            <strong>{competencia.split('-').reverse().join('/')}</strong>, com{' '}
            {modulos.map((m) => MODULOS.find((x) => x.v === m)?.nome).join(', ')}. O OneFlow não permite excluir
            empresa pela API — se algo sair errado, a correção é manual, lá.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  const r = await aprovarCadastroAction(companyId, {
                    regime: regime as never,
                    atividade: atividade as never,
                    competencia: aaaamm,
                    modulos,
                  });
                  setMsg({ ok: r.ok, texto: r.mensagem, avisos: r.avisos });
                  setConfirmando(false);
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Criar no OneFlow e liberar acesso
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setConfirmando(false)}
              className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-bold text-[#231F20] dark:border-white/15 dark:text-[#F5F6F4]"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
      <Mensagem />
    </div>
  );
}
