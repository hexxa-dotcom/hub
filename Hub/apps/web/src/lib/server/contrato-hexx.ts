import 'server-only';
import { createHash } from 'node:crypto';
import { getDb, sql } from '@hexxa/db';
import { valorDosHonorarios } from '@hexxa/core';
import { completarEnderecoPeloCnpj } from './cnpj';
import { CONTRATO, TERMOS, VERSAO_CONTRATO, VERSAO_TERMOS, textoCorrido } from '@/lib/contratos/textos';

/**
 * CONTRATO DE SERVIÇOS DA HEXX COM O CLIENTE (Resolução CFC 1.590/2020).
 *
 * Contrato-padrão + Termo de Adesão gerado por empresa (partes, plano,
 * honorários, vencimento, início) + aceite dentro do Hub. O Termo sai dos
 * mesmos dados da fatura: o valor aceito é o valor cobrado.
 *
 * Mudou a versão do contrato, dos Termos ou o próprio Termo (ex.: honorários
 * novos)? O hash muda e a empresa aceita de novo.
 */

/** Responsável técnico: por enquanto o CRC de pessoa física do Filipe (o CRC da HEXX sai em out/2026). */
const RESPONSAVEL_TECNICO = { nome: 'Filipe Tiago Heck Silva', crc: 'CRC SC-047967/O-2', categoria: 'Contador' };
const DIA_DE_VENCIMENTO = 10;

export interface DadosDaAdesao {
  contratada: { razao: string; cnpj: string; endereco: string; foro: string; email: string | null };
  responsavel: typeof RESPONSAVEL_TECNICO;
  contratante: { razao: string; cnpj: string; endereco: string; representante: string | null };
  plano: string;
  honorarios: number;
  vencimento: number;
  inicio: string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const endereco = (c: Record<string, string | null>) =>
  [
    [c.address_line1, c.address_number].filter(Boolean).join(', '),
    c.neighborhood,
    [c.city, c.state].filter(Boolean).join('/'),
    c.zipcode ? `CEP ${String(c.zipcode).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export async function dadosDaAdesao(companyId: string): Promise<DadosDaAdesao | null> {
  const db = getDb();
  // Contrato com endereço incompleto não identifica a parte (CFC 1.590, art. 2º, a).
  const [idHexx] = (await db.execute(sql`SELECT id::text FROM company WHERE numero = 0 LIMIT 1`)) as unknown as { id: string }[];
  await Promise.all([idHexx?.id, companyId].filter(Boolean).map((id) => completarEnderecoPeloCnpj(id!).catch(() => false)));
  const [hexx] = (await db.execute(sql`SELECT * FROM company WHERE numero = 0 LIMIT 1`)) as unknown as Record<string, string | null>[];
  const [c] = (await db.execute(sql`SELECT * FROM company WHERE id = ${companyId}`)) as unknown as Record<string, string | null>[];
  const [s] = (await db.execute(sql`
    SELECT s.custom_value, s.discount_value, s.current_period_start, s.status, p.name AS plano, p.monthly_value, p.features
      FROM subscription s JOIN plan p ON p.id = s.plan_id
     WHERE s.company_id = ${companyId} AND s.status <> 'CANCELED'
     ORDER BY s.current_period_start DESC NULLS LAST LIMIT 1
  `)) as unknown as { custom_value: string | null; discount_value: string; current_period_start: string | null; plano: string; monthly_value: string; features: { nomeComercial?: string } | null }[];
  if (!hexx || !c || !s) return null;
  const [socio] = (await db.execute(sql`SELECT name FROM partner WHERE company_id = ${companyId} ORDER BY name LIMIT 1`)) as unknown as { name: string }[];
  // Início = entrada da empresa no Hub. Fixo: data que muda (período da
  // assinatura, "hoje") mudaria o Termo e pediria aceite novo sem motivo.
  const inicio = new Date(String(c.created_at)).toISOString().slice(0, 10);
  return {
    contratada: {
      razao: String(hexx.legal_name ?? '').trim().toUpperCase(),
      cnpj: String(hexx.cnpj ?? ''),
      endereco: endereco(hexx),
      foro: [hexx.city, hexx.state].filter(Boolean).join('/'),
      email: hexx.email ?? null,
    },
    responsavel: RESPONSAVEL_TECNICO,
    contratante: {
      razao: String(c.legal_name ?? '').trim().toUpperCase(),
      cnpj: String(c.cnpj ?? ''),
      endereco: endereco(c),
      representante: socio?.name ?? null,
    },
    plano: s.features?.nomeComercial?.trim() || s.plano,
    honorarios: valorDosHonorarios({ valorDoPlano: s.monthly_value, desconto: s.discount_value, valorCombinado: s.custom_value } as never),
    vencimento: DIA_DE_VENCIMENTO,
    inicio,
  };
}

/** O Termo de Adesão como texto — é exatamente isto que fica guardado com o aceite. */
export function textoDaAdesao(d: DadosDaAdesao): string {
  return [
    'TERMO DE ADESÃO AO CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS',
    `CONTRATADA: ${d.contratada.razao}, CNPJ ${d.contratada.cnpj}, ${d.contratada.endereco}.`,
    `Responsável técnico: ${d.responsavel.nome}, ${d.responsavel.categoria}, ${d.responsavel.crc}.`,
    `CONTRATANTE: ${d.contratante.razao}, CNPJ ${d.contratante.cnpj}, ${d.contratante.endereco}${d.contratante.representante ? `, representada por ${d.contratante.representante}` : ''}.`,
    `Plano: ${d.plano}. Honorários mensais: ${brl(d.honorarios)}, com vencimento todo dia ${d.vencimento}.`,
    `Início: ${dataBr(d.inicio)}. Prazo indeterminado, com aviso prévio de 30 dias para rescisão.`,
    `Foro: comarca de ${d.contratada.foro}.`,
    `A CONTRATANTE adere ao Contrato de Prestação de Serviços Contábeis (${VERSAO_CONTRATO}) e aos Termos de Uso e Política de Privacidade (${VERSAO_TERMOS}), que declara ter lido.`,
  ].join('\n');
}

const hash = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
export const HASH_DO_CONTRATO = hash(textoCorrido(CONTRATO));
export const HASH_DOS_TERMOS = hash(textoCorrido(TERMOS));

export interface Aceite {
  id: string;
  versaoContrato: string;
  versaoTermos: string;
  textoDaAdesao: string;
  hashDaAdesao: string;
  aceitoPorNome: string | null;
  aceitoPorEmail: string | null;
  ip: string | null;
  aceitoEm: string;
}

export async function aceitesDaEmpresa(companyId: string): Promise<Aceite[]> {
  return (await getDb().execute(sql`
    SELECT id::text, versao_contrato AS "versaoContrato", versao_termos AS "versaoTermos", texto_da_adesao AS "textoDaAdesao",
           hash_da_adesao AS "hashDaAdesao", aceito_por_nome AS "aceitoPorNome", aceito_por_email AS "aceitoPorEmail", ip,
           to_char(aceito_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') AS "aceitoEm"
      FROM aceite_de_contrato WHERE company_id = ${companyId} ORDER BY aceito_em DESC
  `)) as unknown as Aceite[];
}

/**
 * Precisa aceitar? Só cliente com assinatura ativa (depois do cadastro aprovado
 * e do plano) — nunca a própria HEXX. E só se o último aceite não cobre o que
 * vale hoje: mesma versão do contrato, dos Termos e o mesmo Termo de Adesão.
 */
export async function precisaDeAceite(companyId: string): Promise<DadosDaAdesao | null> {
  const [c] = (await getDb().execute(sql`SELECT numero FROM company WHERE id = ${companyId}`)) as unknown as { numero: number | null }[];
  if (!c || c.numero === 0) return null;
  const d = await dadosDaAdesao(companyId);
  if (!d) return null;
  const [ultimo] = (await getDb().execute(sql`
    SELECT 1 AS ok FROM aceite_de_contrato
     WHERE company_id = ${companyId} AND versao_contrato = ${VERSAO_CONTRATO} AND versao_termos = ${VERSAO_TERMOS}
       AND hash_da_adesao = ${hash(textoDaAdesao(d))}
     LIMIT 1
  `)) as unknown as { ok: number }[];
  return ultimo ? null : d;
}

export async function registrarAceite(
  companyId: string,
  quem: { id: string | null; nome: string | null; email: string | null },
  origem: { ip: string | null; navegador: string | null },
): Promise<{ ok: boolean; mensagem: string }> {
  const d = await dadosDaAdesao(companyId);
  if (!d) return { ok: false, mensagem: 'Não encontramos o plano ativo desta empresa. Fale com o escritório.' };
  const texto = textoDaAdesao(d);
  await getDb().execute(sql`
    INSERT INTO aceite_de_contrato (company_id, versao_contrato, versao_termos, texto_da_adesao, hash_da_adesao, hash_do_contrato, hash_dos_termos,
                                    aceito_por_id, aceito_por_nome, aceito_por_email, ip, navegador)
    VALUES (${companyId}, ${VERSAO_CONTRATO}, ${VERSAO_TERMOS}, ${texto}, ${hash(texto)}, ${HASH_DO_CONTRATO}, ${HASH_DOS_TERMOS},
            ${quem.id}, ${quem.nome}, ${quem.email}, ${origem.ip}, ${origem.navegador})
  `);
  return { ok: true, mensagem: 'Contrato aceito.' };
}
