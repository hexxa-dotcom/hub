'use server';

import { getDb, withTenant, sql } from '@hexxa/db';
import {
  importarExtrato,
  conciliarExtrato,
  saldoDaTransitoria,
  movimentosNaTransitoria,
  MESES_DE_HISTORICO,
} from '@hexxa/db';
// Nada de constante exportada daqui: um arquivo 'use server' só pode exportar
// funções assíncronas, e o build quebra sem explicar bem o porquê.
import { ExtratoIlegivelError } from '@hexxa/core';
import { getTenantContext } from '@/lib/server/tenant';
import { identificarMovimentos } from '@/lib/server/agente-extrato';
import { revalidatePath } from 'next/cache';

/**
 * Upload e processamento do extrato bancário.
 *
 * A ordem das três etapas é a mesma do módulo do razão, e pelo mesmo motivo:
 * importar é só guardar o fato; conciliar é casar com o que já existe;
 * identificar é interpretar o que sobrou. Misturá-las faria um erro de
 * interpretação obrigar a reimportar o arquivo.
 */

export interface EstadoUpload {
  ok: boolean;
  mensagem: string;
  detalhe?: {
    lidas: number;
    novas: number;
    repetidas: number;
    foraDaJanela: number;
    periodo: string | null;
    casadas: number;
    identificadasPorHistorico: number;
    identificadasPorIA: number;
    paraRevisao: number;
    semIdentificacao: number;
    transitoria: number;
  };
}

export async function subirExtratoAction(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  const ctx = await getTenantContext();
  const arquivo = formData.get('arquivo');
  const bankAccountId = String(formData.get('bankAccountId') ?? '');

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: 'Escolha um arquivo de extrato.' };
  }
  if (!bankAccountId) {
    return { ok: false, mensagem: 'Escolha a conta bancária deste extrato.' };
  }
  // 8 MB cobre extrato de ano inteiro em OFX; acima disso é outra coisa.
  if (arquivo.size > 8 * 1024 * 1024) {
    return { ok: false, mensagem: 'Arquivo muito grande (máximo 8 MB).' };
  }

  const conteudo = await arquivo.text();
  const db = getDb();

  try {
    const imp = await importarExtrato(db, ctx.companyId, bankAccountId, conteudo);
    const conc = await conciliarExtrato(db, ctx.companyId);

    // A IA só entra depois que o fato e o histórico já fizeram o que podiam.
    const ia = await identificarMovimentos(ctx.companyId);
    const t = await saldoDaTransitoria(db, ctx.companyId, '2999-12-01');

    revalidatePath('/meu-negocio/conciliacao');
    revalidatePath('/meu-negocio/hub-financeiro');

    const periodo = imp.de && imp.ate
      ? `${imp.de.split('-').reverse().join('/')} a ${imp.ate.split('-').reverse().join('/')}`
      : null;

    return {
      ok: true,
      mensagem:
        imp.novas === 0
          ? 'Este extrato já tinha sido importado — nada foi duplicado.'
          : `${imp.novas} movimento(s) importado(s).`,
      detalhe: {
        lidas: imp.lidas,
        novas: imp.novas,
        repetidas: imp.repetidas,
        foraDaJanela: imp.foraDaJanela,
        periodo,
        casadas: conc.casadas,
        identificadasPorHistorico: conc.classificadas,
        identificadasPorIA: ia.identificados,
        paraRevisao: ia.paraRevisao + conc.ambiguas,
        semIdentificacao: (await movimentosNaTransitoria(db, ctx.companyId, 500)).length,
        transitoria: t.saldo,
      },
    };
  } catch (err) {
    if (err instanceof ExtratoIlegivelError) {
      return {
        ok: false,
        mensagem:
          `${err.message} Dica: baixe o extrato em OFX no seu banco — é o formato ` +
          'que o sistema lê com exatidão, sem precisar interpretar o desenho da página.',
      };
    }
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

/** Janela de histórico aceita, para a tela poder dizer o número certo. */
export async function janelaDeHistorico(): Promise<number> {
  return MESES_DE_HISTORICO;
}

/** Contas bancárias da empresa, para o seletor do upload. */
export async function contasDaEmpresa(): Promise<{ id: string; nome: string }[]> {
  const ctx = await getTenantContext();
  return withTenant(ctx.companyId, async (tx) => {
    const r = await tx.execute(sql`
      SELECT id::text, bank_name, number FROM bank_account
       WHERE company_id = ${ctx.companyId} ORDER BY bank_name
    `);
    return (r as unknown as { id: string; bank_name: string; number: string | null }[]).map((c) => ({
      id: c.id,
      nome: c.number ? `${c.bank_name} · ${c.number}` : c.bank_name,
    }));
  });
}
