import 'server-only';
import { getDb, sql } from '@hexxa/db';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { chamar, registrar } from './agente-extrato';
import { consultarCnpj } from './cnpj';

/**
 * CONFERÊNCIA DO SERVIÇO NA EMISSÃO — a nota bate com o que a empresa pode fazer?
 *
 * Antes de emitir, a descrição e o item da LC 116 do serviço são lidos contra
 * as atividades (CNAE principal e secundários) registradas na Receita. Nota
 * de serviço fora do CNAE é problema na fiscalização e pode mudar o anexo.
 *
 * A regra de toda IA do sistema: duas leituras independentes. Se as duas
 * dizem que confere, confere. Se as duas dizem que não, é alerta — com o
 * motivo. Se discordam, vira pergunta para quem emite. Sem porcentagem.
 * Quem decide é quem emite: a conferência nunca bloqueia a nota.
 */

export interface ConferenciaDoServico {
  situacao: 'CONFERE' | 'NAO_CONFERE' | 'DUVIDA' | 'SEM_BASE';
  mensagem: string;
  /** Descrição mais clara, quando a primeira leitura sugeriu uma. */
  sugestao?: string;
}

const SISTEMA = `Você é um contador brasileiro conferindo uma nota fiscal de serviço (NFS-e) antes da emissão. Confira DUAS coisas, separadas:
1. CNAE: o serviço descrito está coberto por alguma das atividades (CNAE) registradas da empresa? Compatível quando é o objeto da atividade ou claramente parte dela.
2. ITEM: o item da LC 116/2003 escolhido corresponde ao serviço descrito? Se não, diga qual item seria o correto.
Se a descrição for vaga (e só nesse caso), sugira uma redação mais clara do MESMO serviço — uma frase, sem inventar fatos, valores nem datas.
Responda SOMENTE um objeto JSON:
{"cnae_ok":true|false,"cnae":"<código da atividade que cobre, ou null>","item_ok":true|false,"item_correto":"<ex.: 17.19 — Contabilidade, ou null>","motivo":"<uma frase curta>","descricao_sugerida":"<frase ou null>"}`;

const REVISOR = `Você é um contador brasileiro REVISANDO a conferência de outra pessoa sobre uma NFS-e: (1) o serviço está coberto pelos CNAE da empresa? (2) o item da LC 116 corresponde ao serviço?
Procure erros. Concorde SOMENTE se as duas conclusões propostas se sustentam sem dúvida razoável.
Responda SOMENTE um objeto JSON:
{"concorda":true|false,"motivo":"<uma frase curta>"}`;

export async function conferirServico(companyId: string, p: { descricao: string; perfilId?: string | null }): Promise<ConferenciaDoServico> {
  const descricao = p.descricao.trim();
  if (descricao.length < 5) return { situacao: 'SEM_BASE', mensagem: 'Descreva o serviço para conferir com o CNAE.' };

  const db = getDb();
  const [e] = (await db.execute(sql`
    SELECT cnpj, main_activity_code AS cnae, main_activity_text AS atividade FROM company WHERE id = ${companyId}
  `)) as unknown as { cnpj: string | null; cnae: string | null; atividade: string | null }[];
  const [perfil] = (await db.execute(sql`
    SELECT nome, item_lista_servico AS item FROM nfse_service_profile
     WHERE company_id = ${companyId} AND (${p.perfilId ?? null}::uuid IS NULL OR id = ${p.perfilId ?? null}::uuid)
     ORDER BY padrao DESC, nome LIMIT 1
  `)) as unknown as { nome: string; item: string }[];

  const receita = e?.cnpj ? await consultarCnpj(e.cnpj).catch(() => null) : null;
  const atividades = receita?.atividades.length ? receita.atividades : e?.cnae ? [{ codigo: e.cnae, descricao: e.atividade ?? '', principal: true }] : [];
  if (!atividades.length) return { situacao: 'SEM_BASE', mensagem: 'A empresa não tem CNAE cadastrado para conferir.' };

  const creds = await resolveCredentials();
  if (!creds) return { situacao: 'SEM_BASE', mensagem: 'A conferência com o CNAE precisa da IA configurada.' };
  const motor = await resolverMotor(creds, 'conciliacao');

  const caso = [
    'ATIVIDADES DA EMPRESA (Receita Federal):',
    ...atividades.map((a) => `- ${a.codigo} ${a.descricao}${a.principal ? ' (principal)' : ''}`),
    '',
    `SERVIÇO DA NOTA: ${descricao}`,
    perfil ? `ITEM LC 116: ${perfil.item} — ${perfil.nome}` : '',
  ].join('\n');

  type R1 = { cnae_ok: boolean; cnae?: string | null; item_ok: boolean; item_correto?: string | null; motivo?: string; descricao_sugerida?: string | null };
  const r1 = await chamar<R1>(motor, SISTEMA, caso, 'objeto');
  if (!r1.ok || !r1.dados || typeof r1.dados.cnae_ok !== 'boolean' || typeof r1.dados.item_ok !== 'boolean') {
    return { situacao: 'SEM_BASE', mensagem: 'Não consegui conferir o serviço agora — a nota pode seguir.' };
  }
  const p1 = r1.dados;
  const proposta = [
    p1.cnae_ok ? `CNAE: coberto${p1.cnae ? ` por ${p1.cnae}` : ''}` : 'CNAE: não coberto',
    p1.item_ok ? 'ITEM: corresponde' : `ITEM: não corresponde${p1.item_correto ? ` (seria ${p1.item_correto})` : ''}`,
    `Motivo: ${p1.motivo ?? ''}`,
  ].join('\n');
  const r2 = await chamar<{ concorda: boolean; motivo?: string }>(motor, REVISOR, `${caso}\n\nCONCLUSÃO PROPOSTA:\n${proposta}`, 'objeto');
  const concorda = r2.ok && r2.dados?.concorda === true;
  await registrar(companyId, 'CONFERENCIA_SERVICO_CNAE', motor.model, { caso }, { proposta: p1, revisao: r2.ok ? r2.dados : null }, { concorda }, r1, r2);

  // Sugestão de redação só quando o serviço está certo — nunca para "encaixar" a descrição num item errado.
  const sugestao =
    concorda && p1.cnae_ok && p1.item_ok && p1.descricao_sugerida && p1.descricao_sugerida.trim() !== descricao ? p1.descricao_sugerida.trim() : undefined;
  const atividade = atividades.find((a) => a.codigo.replace(/\D/g, '') === String(p1.cnae ?? '').replace(/\D/g, ''));
  const doCnae = atividade ? `${atividade.codigo} — ${atividade.descricao}` : 'registrada da empresa';

  if (!concorda) {
    return {
      situacao: 'DUVIDA',
      mensagem: 'Não deu para confirmar que o serviço e o item da LC 116 batem com o CNAE da empresa. Confira o serviço escolhido antes de emitir.',
    };
  }
  if (!p1.cnae_ok) {
    return { situacao: 'NAO_CONFERE', mensagem: `Este serviço não aparece entre as atividades (CNAE) da empresa. ${p1.motivo ?? ''}`.trim() };
  }
  if (!p1.item_ok) {
    return {
      situacao: 'NAO_CONFERE',
      mensagem: `O serviço confere com a atividade ${doCnae}, mas o item da LC 116 escolhido não corresponde${p1.item_correto ? ` — o certo seria ${p1.item_correto}` : ''}. Troque o serviço (perfil) antes de emitir.`,
    };
  }
  return { situacao: 'CONFERE', mensagem: `Confere com a atividade ${doCnae}, e o item da LC 116 corresponde.`, sugestao };
}
