import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { operationSetting } from '../schema/operation';
import { company } from '../schema/tenancy';
import {
  resolverConfiguracao,
  excecoes,
  type ConfiguracaoResolvida,
  type PerfilEmpresa,
  type SettingsParcial,
} from '@hexxa/core';

/**
 * Leitura e escrita da configuração de operação.
 *
 * Duas consultas no máximo: a linha do sistema e a da empresa. O perfil não
 * vem do banco — está no código (`PADRAO_PERFIL`), versionado e testado, e é
 * o que garante que uma holding nasça com a trava certa sem depender de alguém
 * ter cadastrado uma linha.
 */

export interface ConfiguracaoDaEmpresa extends ConfiguracaoResolvida {
  companyId: string;
  perfil: PerfilEmpresa;
  /** Chaves que esta empresa tem diferentes do padrão. */
  excecoes: string[];
}

/** Sobrescrita gravada num escopo, ou `undefined` se não houver. */
async function lerEscopo(
  tx: DbHandle,
  scope: 'SYSTEM' | 'COMPANY',
  scopeKey: string | null,
): Promise<SettingsParcial | undefined> {
  const [row] = await tx
    .select({ settings: operationSetting.settings })
    .from(operationSetting)
    .where(
      and(
        eq(operationSetting.scope, scope),
        scopeKey === null
          ? isNull(operationSetting.scopeKey)
          : eq(operationSetting.scopeKey, scopeKey),
      ),
    );
  return (row?.settings as SettingsParcial | undefined) ?? undefined;
}

/**
 * Configuração efetiva de uma empresa.
 *
 * Empresa que nunca foi configurada devolve o padrão inteiro, sem erro e sem
 * linha no banco — é o que faz uma empresa recém-cadastrada já nascer
 * operando.
 */
export async function configuracaoDaEmpresa(
  tx: DbHandle,
  companyId: string,
): Promise<ConfiguracaoDaEmpresa> {
  const [emp] = await tx
    .select({ type: company.type })
    .from(company)
    .where(eq(company.id, companyId));

  if (!emp) throw new Error(`Empresa ${companyId} não encontrada.`);
  const perfil = emp.type as PerfilEmpresa;

  const [sistema, daEmpresa] = await Promise.all([
    lerEscopo(tx, 'SYSTEM', null),
    lerEscopo(tx, 'COMPANY', companyId),
  ]);

  const resolvida = resolverConfiguracao(perfil, sistema, daEmpresa);
  return {
    ...resolvida,
    companyId,
    perfil,
    excecoes: excecoes(resolvida.origem),
  };
}

/**
 * Grava a sobrescrita de uma empresa.
 *
 * Substitui a linha inteira em vez de mesclar com o que estava lá: a tela
 * manda o conjunto completo de exceções que a empresa deve ter, e mesclar
 * tornaria impossível REMOVER uma exceção — voltar ao padrão viraria uma
 * operação que não existe.
 */
export async function salvarExcecoesDaEmpresa(
  tx: DbHandle,
  companyId: string,
  parcial: SettingsParcial,
  userId?: string | null,
): Promise<void> {
  await tx
    .insert(operationSetting)
    .values({
      scope: 'COMPANY',
      scopeKey: companyId,
      settings: parcial as never,
      updatedByUserId: userId ?? null,
    })
    .onConflictDoUpdate({
      target: [operationSetting.scope, operationSetting.scopeKey],
      set: {
        settings: parcial as never,
        updatedByUserId: userId ?? null,
        updatedAt: new Date(),
      },
    });
}

/** Devolve a empresa ao padrão, apagando a linha de exceções. */
export async function voltarAoPadrao(tx: DbHandle, companyId: string): Promise<void> {
  await tx
    .delete(operationSetting)
    .where(and(eq(operationSetting.scope, 'COMPANY'), eq(operationSetting.scopeKey, companyId)));
}

/** Grava o padrão do sistema — vale para toda empresa que não sobrescrever. */
export async function salvarPadraoDoSistema(
  tx: DbHandle,
  parcial: SettingsParcial,
  userId?: string | null,
): Promise<void> {
  const existente = await lerEscopo(tx, 'SYSTEM', null);

  if (existente === undefined) {
    await tx.insert(operationSetting).values({
      scope: 'SYSTEM',
      scopeKey: null,
      settings: parcial as never,
      updatedByUserId: userId ?? null,
    });
    return;
  }

  await tx
    .update(operationSetting)
    .set({ settings: parcial as never, updatedByUserId: userId ?? null, updatedAt: new Date() })
    .where(and(eq(operationSetting.scope, 'SYSTEM'), isNull(operationSetting.scopeKey)));
}

/**
 * Um agente está ligado para esta empresa?
 *
 * Todo agente consulta isto antes de agir. É o interruptor que o contador
 * mexe na ficha do cliente, e ele precisa valer para o cron também — senão o
 * agente desligado continua rodando de madrugada.
 */
export type NomeDeAgente = keyof ConfiguracaoDaEmpresa['valores']['agentes'];

export async function agenteLigado(
  tx: DbHandle,
  companyId: string,
  agente: NomeDeAgente,
): Promise<boolean> {
  const cfg = await configuracaoDaEmpresa(tx, companyId);
  return cfg.valores.agentes[agente];
}

/** Empresas com o agente ligado — para o cron varrer só quem deve. */
export async function empresasComAgenteLigado(
  tx: DbHandle,
  agente: NomeDeAgente,
): Promise<{ id: string; nome: string }[]> {
  const empresas = await tx
    .select({ id: company.id, nome: company.legalName, type: company.type })
    .from(company);

  const [sistema] = await Promise.all([lerEscopo(tx, 'SYSTEM', null)]);

  const excecoesPorEmpresa = await tx
    .select({ scopeKey: operationSetting.scopeKey, settings: operationSetting.settings })
    .from(operationSetting)
    .where(eq(operationSetting.scope, 'COMPANY'));

  const porId = new Map(
    excecoesPorEmpresa.map((r) => [String(r.scopeKey), r.settings as SettingsParcial]),
  );

  return empresas
    .filter((e) => {
      const cfg = resolverConfiguracao(e.type as PerfilEmpresa, sistema, porId.get(e.id));
      return cfg.valores.agentes[agente] === true;
    })
    .map((e) => ({ id: e.id, nome: e.nome }));
}
