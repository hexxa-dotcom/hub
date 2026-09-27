import 'server-only';
import { getDb, sql } from '@hexxa/db';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { chamar, registrar } from './agente-extrato';

/**
 * SUGESTÃO DE ENQUADRAMENTO NO SIMPLES — pela atividade da empresa.
 *
 * Serve para a empresa que ainda não tem apuração do OneFlow: o contador marca
 * o anexo (III, IV ou V) e se a atividade se sujeita ao Fator R, e a IA ajuda
 * lendo o CNAE e a descrição da atividade.
 *
 * Mesma regra da conciliação: a sugestão só aparece como "conferida" quando
 * uma segunda leitura independente chega à mesma resposta. Quem decide é o
 * contador — nada é gravado sem ele clicar em salvar.
 */

const REGRAS = `Regras do Simples Nacional para SERVIÇOS (LC 123/2006, art. 18, §§ 5º-B a 5º-I, com a LC 155/2016):
- Anexo III: serviços em geral sem Fator R (ex.: academias, agências de viagem, escritórios de contabilidade, manutenção, transporte municipal).
- Anexo IV: construção civil e obras, serviços de vigilância, limpeza e conservação, e serviços advocatícios. A CPP (INSS patronal) é paga fora do DAS. Não há Fator R.
- Anexo V com Fator R: atividades do § 5º-I (medicina, odontologia, fisioterapia, psicologia, engenharia, arquitetura, publicidade, tecnologia/software, consultoria, auditoria, jornalismo, entre outras). Ficam no Anexo III se o Fator R (folha ÷ receita em 12 meses) for de 28% ou mais; no V se for menor.
- Algumas atividades do § 5º-B/5º-C/5º-D estão no Anexo III por natureza e NÃO dependem do Fator R.`;

const SISTEMA = `Você é um contador brasileiro especialista em Simples Nacional. Diga em qual anexo a atividade da empresa se enquadra e se ela se sujeita ao Fator R.

${REGRAS}

Se a atividade não permitir decidir com segurança, responda anexo null.
Responda SOMENTE um objeto JSON:
{"anexo":"III"|"IV"|"V"|null,"fator_r":"SUJEITO"|"NAO_SUJEITO"|null,"motivo":"<uma frase citando a regra>"}`;

const REVISOR = `Você é um contador brasileiro REVISANDO o enquadramento no Simples Nacional feito por outra pessoa. Procure erros.

${REGRAS}

Concorde SOMENTE se a atividade sustenta o anexo e a sujeição ao Fator R propostos sem dúvida razoável.
Responda SOMENTE um objeto JSON:
{"concorda":true|false,"anexo":"III"|"IV"|"V"|null,"fator_r":"SUJEITO"|"NAO_SUJEITO"|null,"motivo":"<uma frase>"}`;

export interface SugestaoDeEnquadramento {
  ok: boolean;
  mensagem?: string;
  anexo?: 'III' | 'IV' | 'V';
  fatorR?: 'SUJEITO' | 'NAO_SUJEITO';
  motivo?: string;
  /** As duas leituras concordaram. */
  conferida?: boolean;
}

export async function sugerirEnquadramento(companyId: string): Promise<SugestaoDeEnquadramento> {
  const [e] = (await getDb().execute(sql`
    SELECT coalesce(trade_name, legal_name) AS nome, main_activity_code AS cnae, main_activity_text AS atividade, activity_description AS descricao
      FROM company WHERE id = ${companyId}
  `)) as unknown as { nome: string; cnae: string | null; atividade: string | null; descricao: string | null }[];
  if (!e?.cnae && !e?.atividade) return { ok: false, mensagem: 'A empresa não tem CNAE nem atividade cadastrados.' };

  const creds = await resolveCredentials();
  if (!creds) return { ok: false, mensagem: 'A IA não está configurada.' };
  const motor = await resolverMotor(creds, 'conciliacao');
  const empresa = `EMPRESA: ${e.nome}\nCNAE principal: ${e.cnae ?? '—'} — ${e.atividade ?? '—'}${e.descricao ? `\nDescrição da atividade: ${e.descricao}` : ''}`;

  type R = { anexo: string | null; fator_r: string | null; motivo?: string };
  const r1 = await chamar<R>(motor, SISTEMA, empresa, 'objeto');
  const valido = (a: unknown): a is 'III' | 'IV' | 'V' => a === 'III' || a === 'IV' || a === 'V';
  if (!r1.ok || !r1.dados || !valido(r1.dados.anexo)) {
    return { ok: false, mensagem: 'A IA não teve base para sugerir. Marque pelo que você sabe da empresa.' };
  }
  const p = r1.dados;
  const anexo = p.anexo as 'III' | 'IV' | 'V';
  const fatorR = p.anexo === 'V' ? 'SUJEITO' : p.anexo === 'IV' ? 'NAO_SUJEITO' : p.fator_r === 'SUJEITO' ? 'SUJEITO' : 'NAO_SUJEITO';

  const r2 = await chamar<R & { concorda: boolean }>(motor, REVISOR, `${empresa}\n\nPROPOSTA: Anexo ${p.anexo} · Fator R: ${fatorR} · motivo: ${p.motivo ?? '—'}`, 'objeto');
  const conferida = r2.ok && r2.dados?.concorda === true;
  await registrar(companyId, 'ENQUADRAMENTO_SIMPLES', motor.model, { empresa }, { proposta: p, revisao: r2.ok ? r2.dados : null }, { conferida }, r1, r2);

  return {
    ok: true,
    anexo,
    fatorR,
    motivo: conferida ? p.motivo : `${p.motivo ?? ''} A conferência não confirmou${r2.ok && r2.dados?.motivo ? `: ${r2.dados.motivo}` : ''}.`.trim(),
    conferida,
  };
}
