'use client';

import { useState, useTransition } from 'react';
import type { ConfiguracaoDaEmpresa } from '@hexxa/db';
import type { SettingsParcial, Camada } from '@hexxa/core';
import { salvarConfiguracao, restaurarPadrao } from './actions';

/**
 * Configuração de operação de uma empresa.
 *
 * A decisão de interface que carrega o desenho todo: **cada chave mostra de
 * onde o valor veio.** Sem isso o contador não distingue o que ele configurou
 * do que veio de graça — e passaria a reconfigurar tudo por desconfiança,
 * transformando a herança em trabalho manual, que é exatamente o que ela
 * existe para evitar.
 */

const AGENTES: { chave: keyof ConfiguracaoDaEmpresa['valores']['agentes']; nome: string; desc: string }[] = [
  {
    chave: 'escrituracao',
    nome: 'Escrituração',
    desc: 'Transforma lançamentos, guias e distribuições em partidas no razão. Desligar para o razão desta empresa.',
  },
  {
    chave: 'classificador',
    nome: 'Classificador',
    desc: 'Atribui categoria contábil aos lançamentos sem classificação.',
  },
  {
    chave: 'conciliador',
    nome: 'Conciliador',
    desc: 'Sugere o pareamento entre extrato bancário e lançamentos em aberto.',
  },
  {
    chave: 'fechamento',
    nome: 'Fechamento conferido',
    desc: 'Confere o mês contra oito verificações e propõe o fechamento. Nunca fecha sozinho.',
  },
  {
    chave: 'envioOneflow',
    nome: 'Enviar o razão ao OneFlow',
    desc: 'Manda as partidas do Hub para a contabilidade oficial, aos poucos ao longo do mês. Exige o plano de contas já criado lá.',
  },
  {
    chave: 'retornoOneflow',
    nome: 'Guias e folha do OneFlow',
    desc: 'Traz do OneFlow o imposto apurado e a folha do mês, e escritura os dois. Exige o módulo fiscal implantado lá.',
  },
  {
    chave: 'insights',
    nome: 'Dicas nas telas',
    desc: 'Comentário contextual da IA no portal do cliente.',
  },
];

const ROTULO_CAMADA: Record<Camada, string> = {
  sistema: 'Padrão do sistema',
  perfil: 'Perfil da empresa',
  empresa: 'Definido aqui',
};

function Origem({ camada }: { camada: Camada }) {
  const proprio = camada === 'empresa';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        proprio
          ? 'bg-[#2F4A3C] text-[#F5F6F4] dark:bg-[#DFFFAE] dark:text-[#231F20]'
          : 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
      }`}
      title={proprio ? 'Esta empresa tem um valor próprio' : 'Herdado — muda junto com o padrão'}
    >
      {ROTULO_CAMADA[camada]}
    </span>
  );
}

export function OperacaoClient({ inicial }: { inicial: ConfiguracaoDaEmpresa }) {
  const [cfg, setCfg] = useState(inicial);
  const [pendente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  /**
   * Monta o conjunto COMPLETO de exceções a partir do estado atual.
   *
   * Só entra o que difere do herdado — é isso que mantém a empresa recebendo
   * melhorias do padrão naquilo que ela não decidiu por conta própria.
   */
  function montarExcecoes(valores: ConfiguracaoDaEmpresa['valores']): SettingsParcial {
    const agentes: Record<string, boolean> = {};
    for (const a of AGENTES) {
      if (cfg.origem.agentes[a.chave] === 'empresa') {
        agentes[a.chave] = valores.agentes[a.chave];
      }
    }

    const fechamento: Record<string, unknown> = {};
    for (const k of ['diaDoFechamento', 'envioAutomaticoAoLiberar'] as const) {
      if (cfg.origem.fechamento[k] === 'empresa') fechamento[k] = valores.fechamento[k];
    }

    const out: SettingsParcial = {};
    if (Object.keys(agentes).length) out.agentes = agentes as never;
    if (Object.keys(fechamento).length) out.fechamento = fechamento as never;
    if (cfg.origem.diretrizes === 'empresa') out.diretrizes = valores.diretrizes;
    return out;
  }

  function mudarFechamento<K extends keyof ConfiguracaoDaEmpresa['valores']['fechamento']>(
    chave: K,
    valor: ConfiguracaoDaEmpresa['valores']['fechamento'][K],
  ) {
    setCfg((c) => ({
      ...c,
      valores: { ...c.valores, fechamento: { ...c.valores.fechamento, [chave]: valor } },
      origem: { ...c.origem, fechamento: { ...c.origem.fechamento, [chave]: 'empresa' as Camada } },
    }));
  }

  function alternarAgente(chave: keyof ConfiguracaoDaEmpresa['valores']['agentes']) {
    setCfg((c) => ({
      ...c,
      valores: { ...c.valores, agentes: { ...c.valores.agentes, [chave]: !c.valores.agentes[chave] } },
      // Mexer numa chave a torna própria da empresa. É o que o contador espera:
      // ele acabou de decidir aquilo, então aquilo para de seguir o padrão.
      origem: { ...c.origem, agentes: { ...c.origem.agentes, [chave]: 'empresa' as Camada } },
    }));
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarConfiguracao(cfg.companyId, montarExcecoes(cfg.valores));
      setMsg(r.message);
    });
  }

  function restaurar() {
    startTransition(async () => {
      const r = await restaurarPadrao(cfg.companyId);
      setMsg(r.message);
      // Recarrega para mostrar os valores herdados de volta.
      window.location.reload();
    });
  }

  const proprias = Object.values(cfg.origem.agentes).filter((c) => c === 'empresa').length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Como esta empresa opera</h2>
            <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Perfil <strong>{cfg.perfil === 'HOLDING' ? 'Holding patrimonial' : 'Prestadora de serviço'}</strong>.{' '}
              {proprias === 0
                ? 'Tudo herdado do padrão — melhorias no padrão chegam aqui automaticamente.'
                : `${proprias} configuração(ões) própria(s); o resto continua herdando.`}
            </p>
          </div>
          {proprias > 0 && (
            <button
              type="button"
              onClick={restaurar}
              disabled={pendente}
              className="shrink-0 rounded-full border border-black/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] transition-colors hover:text-[#231F20] disabled:opacity-50 dark:border-white/15 dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]"
            >
              Voltar tudo ao padrão
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
        <div className="border-b border-black/5 px-5 py-4 dark:border-white/10">
          <h3 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Agentes</h3>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Desligar um agente vale para o cron também — ele para de rodar de madrugada para esta empresa.
          </p>
        </div>

        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {AGENTES.map((a) => {
            const ligado = cfg.valores.agentes[a.chave];
            return (
              <li key={a.chave} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{a.nome}</span>
                    <Origem camada={cfg.origem.agentes[a.chave]!} />
                  </div>
                  <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{a.desc}</p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={ligado}
                  aria-label={`${a.nome}: ${ligado ? 'ligado' : 'desligado'}`}
                  onClick={() => alternarAgente(a.chave)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    ligado ? 'bg-[#2F4A3C] dark:bg-[#DFFFAE]' : 'bg-black/15 dark:bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-[#231F20] ${
                      ligado ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <h3 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Fechamento do mês</h3>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Quando o mês tranca para o cliente, e o que acontece depois que você confere.
        </p>

        <div className="mt-4 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="diaFechamento"
                className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]"
              >
                Tranca para o cliente em
              </label>
              <Origem camada={cfg.origem.fechamento.diaDoFechamento!} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select
                id="diaFechamento"
                value={cfg.valores.fechamento.diaDoFechamento}
                onChange={(e) => mudarFechamento('diaDoFechamento', Number(e.target.value))}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
              >
                <option value={0}>último dia do próprio mês</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    dia {d} do mês seguinte
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              A partir desta data o cliente não lança mais no mês. O limite é o dia 20, porque
              é quando o DAS vence — um mês que ainda não fechou não tem guia apurada para pagar.
            </p>
          </div>

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
                  Enviar ao OneFlow assim que eu liberar
                </span>
                <Origem camada={cfg.origem.fechamento.envioAutomaticoAoLiberar!} />
              </div>
              <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Ligado, sua conferência já dispara a saída. Desligado, o mês fica pronto na sua
                área e o envio é um segundo comando — o padrão, porque lançamento que entra no
                OneFlow só sai de lá por exclusão manual.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.valores.fechamento.envioAutomaticoAoLiberar}
              aria-label={`Envio automático ao liberar: ${cfg.valores.fechamento.envioAutomaticoAoLiberar ? 'ligado' : 'desligado'}`}
              onClick={() =>
                mudarFechamento(
                  'envioAutomaticoAoLiberar',
                  !cfg.valores.fechamento.envioAutomaticoAoLiberar,
                )
              }
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                cfg.valores.fechamento.envioAutomaticoAoLiberar
                  ? 'bg-[#2F4A3C] dark:bg-[#DFFFAE]'
                  : 'bg-black/15 dark:bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-[#231F20] ${
                  cfg.valores.fechamento.envioAutomaticoAoLiberar
                    ? 'translate-x-[22px]'
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Diretrizes desta empresa</h3>
          <Origem camada={cfg.origem.diretrizes} />
        </div>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Instruções anexadas ao prompt dos agentes. Serve para o caso particular — &ldquo;Dr. Henrique é
          PJ, não cliente&rdquo;. Não substitui a régua de autonomia: regra que precisa valer sempre
          mora no sistema, não no texto.
        </p>
        <textarea
          value={cfg.valores.diretrizes}
          maxLength={2000}
          rows={4}
          onChange={(e) =>
            setCfg((c) => ({
              ...c,
              valores: { ...c.valores, diretrizes: e.target.value },
              origem: { ...c.origem, diretrizes: 'empresa' as Camada },
            }))
          }
          placeholder="Ex.: Pagamentos ao Dr. Henrique são de PJ contratado, categoria Serviços de Terceiros."
          className="mt-3 w-full rounded-xl border border-black/10 bg-transparent p-3 text-sm text-[#231F20] outline-none focus:border-[#2F4A3C] dark:border-white/15 dark:text-[#F5F6F4] dark:focus:border-[#DFFFAE]"
        />
        <p className="mt-1 text-right text-[10px] text-[#6E6A61] dark:text-[#A8A49C]">
          {cfg.valores.diretrizes.length}/2000
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg && <span className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{msg}</span>}
        <button
          type="button"
          onClick={salvar}
          disabled={pendente}
          className="rounded-full bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#F5F6F4] transition-colors hover:bg-[#3D5F4C] disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}
