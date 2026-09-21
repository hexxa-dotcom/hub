import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { getNfseConfig, isFiscalComplete } from './fiscal';

/**
 * OS PRIMEIROS PASSOS, MEDIDOS — NÃO MARCADOS.
 *
 * ── Por que o progresso é derivado do dado ─────────────────────────────
 *
 * Um checklist com "concluído" gravado numa coluna mente na primeira vez que
 * alguém apaga o que tinha preenchido: o passo continua verde e o sistema
 * continua sem funcionar. Aqui cada passo pergunta ao banco se a coisa existe.
 * Some o dado, o passo reabre sozinho.
 *
 * Isso também torna o assistente RETOMÁVEL. A pessoa fecha o navegador no
 * meio, volta amanhã e cai onde parou, sem nenhum estado de sessão guardado.
 *
 * ── Por que só três ────────────────────────────────────────────────────
 *
 * Porque o sistema fica utilizável com três, e a pessoa que acabou de pagar
 * precisa ver isso funcionando em cinco minutos. Certificado digital, perfis
 * de serviço, contas bancárias e o resto são ajustes — importantes, e nenhum
 * deles impede de usar o Hub hoje.
 */

export type EstadoDoPasso = 'FEITO' | 'PENDENTE';

export interface Passo {
  id: 'empresa' | 'fiscal' | 'ponto-de-partida';
  titulo: string;
  /** O que a pessoa ganha ao terminar — não o que ela precisa digitar. */
  porque: string;
  href: string;
  estado: EstadoDoPasso;
}

export interface PrimeirosPassos {
  passos: Passo[];
  concluidos: number;
  total: number;
  /** `true` quando os três estão feitos. */
  completo: boolean;
  /** O próximo a fazer, ou `null` quando acabou. */
  proximo: Passo | null;
}

export async function getPrimeirosPassos(ctx: TenantContext): Promise<PrimeirosPassos> {
  const [cfg, medidas] = await Promise.all([
    getNfseConfig(ctx).catch(() => null),
    withTenant(ctx.companyId, async (tx) => {
      const [linhas] = (await tx.execute(sql`
        SELECT
          -- Empresa: CNPJ real (não o placeholder legado) e responsável com CPF.
          (SELECT count(*) FROM company c
            WHERE c.id = ${ctx.companyId} AND c.cnpj NOT LIKE 'PENDENTE-%')::int AS empresa,
          (SELECT count(*) FROM app_user u
             JOIN membership m ON m.user_id = u.id AND m.company_id = ${ctx.companyId}
            WHERE m.role = 'OWNER' AND u.cpf IS NOT NULL)::int AS responsavel,
          -- Ponto de partida: qualquer saldo de abertura já lançado.
          (SELECT count(*) FROM journal_entry j
            WHERE j.company_id = ${ctx.companyId} AND j.source = 'OPENING')::int AS abertura
      `)) as unknown as { empresa: number; responsavel: number; abertura: number }[];
      return linhas;
    }),
  ]);

  /**
   * O passo fiscal exige mais do que `isFiscalComplete`.
   *
   * Aquela função responde "dá para montar o DPS?" — CNPJ e município, que o
   * próprio passo 1 já preenche a partir da Receita. Se o passo 2 usasse só
   * ela, nasceria verde sem ninguém ter feito nada, e a pessoa nunca revisaria
   * a alíquota do ISS nem diria o que vende. Por isso pede também o serviço.
   */
  const fiscalPronto = Boolean(
    isFiscalComplete(cfg) && cfg?.itemListaServico && cfg?.aliquotaIss !== null,
  );

  const passos: Passo[] = [
    {
      id: 'empresa',
      titulo: 'Sua empresa e você',
      porque: 'É o que identifica a empresa em tudo que o Hub emite e declara.',
      href: '/onboarding',
      estado: medidas?.empresa && medidas?.responsavel ? 'FEITO' : 'PENDENTE',
    },
    {
      id: 'fiscal',
      titulo: 'Sua nota fiscal',
      porque: 'Sem isto o Hub não emite nota — e é da nota que nasce seu faturamento.',
      href: '/onboarding/fiscal',
      estado: fiscalPronto ? 'FEITO' : 'PENDENTE',
    },
    {
      id: 'ponto-de-partida',
      titulo: 'De onde você está partindo',
      porque: 'Dois números que ligam o saldo livre, o termômetro de imposto e a previsão.',
      href: '/onboarding/ponto-de-partida',
      estado: medidas?.abertura ? 'FEITO' : 'PENDENTE',
    },
  ];

  const concluidos = passos.filter((p) => p.estado === 'FEITO').length;
  return {
    passos,
    concluidos,
    total: passos.length,
    completo: concluidos === passos.length,
    proximo: passos.find((p) => p.estado === 'PENDENTE') ?? null,
  };
}
