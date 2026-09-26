import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { faturamentoMensal, aliquotaDoFaturamento } from '@/lib/server/bussola';
import { getBalancoDreData } from '@/lib/server/reports';
import { notasDoMes } from '@/lib/server/notas';
import { listarClientes } from '@/lib/server/clientes';
import { listarDocumentos, checklist, extrasDosDocumentos } from '@/lib/server/documentos-da-empresa';
import { listarPedidos } from '@/lib/server/servicos';
import { listarPropostas } from '@/lib/server/propostas';
import { listarFilas } from '@/lib/server/fila-agente';
import { relacaoDoCliente } from '@/lib/relacao-cliente';
import { listContractsAction } from '@/app/(portal)/meu-negocio/contratos/actions';
import { listSupportTicketsAction } from '@/app/(portal)/suporte/actions';

/**
 * INÍCIO — a visão geral da empresa, todas as áreas.
 *
 * Três perguntas, nesta ordem: o que pede você hoje (pendências de todas as
 * áreas, cada uma com o caminho para resolver), como está o mês (os mesmos
 * números da Bússola e dos Relatórios — faturamento só de nota) e como está
 * cada área, num relance.
 *
 * Cada área é lida à parte: se uma falhar, as outras continuam aparecendo.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hojeSP()}T12:00:00Z`)) / 86400000);
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type Area = 'Impostos' | 'Financeiro' | 'Notas' | 'Contratos' | 'Propostas' | 'Clientes' | 'Documentos' | 'Atendimento' | 'Contabilidade' | 'Plano';

export interface Pendencia {
  id: string;
  area: Area;
  texto: string;
  detalhe?: string;
  /** alerta = já passou do prazo ou trava algo; atencao = vence logo. */
  tom: 'alerta' | 'atencao';
  href: string;
  acao: string;
}

async function seguro<T>(p: Promise<T>, padrao: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error('[inicio] uma área não carregou:', err);
    return padrao;
  }
}

// ── O que pede você hoje ────────────────────────────────────────────────────

export async function pendenciasDoDia(ctx: TenantContext): Promise<Pendencia[]> {
  const hoje = hojeSP();
  const em7 = somaDias(hoje, 7);
  const em30 = somaDias(hoje, 30);
  const mes = hoje.slice(0, 7);

  const [financeiro, guias, contratos, propostas, tarefas, docs, extras, pedidos, conversas, notas, fila, honorarios] = await Promise.all([
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT type,
                 count(*) FILTER (WHERE due_date < ${hoje}) AS vencidos,
                 coalesce(sum(amount) FILTER (WHERE due_date < ${hoje}), 0) AS valor_vencido,
                 count(*) FILTER (WHERE due_date >= ${hoje} AND due_date <= ${em7}) AS semana,
                 coalesce(sum(amount) FILTER (WHERE due_date >= ${hoje} AND due_date <= ${em7}), 0) AS valor_semana
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND status IN ('PENDING', 'OVERDUE') AND due_date IS NOT NULL
             AND NOT (type = 'PAYABLE' AND description ILIKE 'Provisão de Imposto%')
           GROUP BY type
        `),
      ) as unknown as Promise<{ type: string; vencidos: string; valor_vencido: string; semana: string; valor_semana: string }[]>,
      [],
    ),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT id, tax_name, amount, to_char(due_date, 'YYYY-MM-DD') AS venc FROM tax_guide
           WHERE company_id = ${ctx.companyId} AND status <> 'PAID' AND NOT provisional AND due_date <= ${em7}
           ORDER BY due_date
        `),
      ) as unknown as Promise<{ id: string; tax_name: string; amount: string; venc: string }[]>,
      [],
    ),
    seguro(listContractsAction(), []),
    seguro(listarPropostas(ctx, ''), []),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT count(*) FILTER (WHERE prazo < ${hoje}) AS atrasadas, count(*) FILTER (WHERE prazo = ${hoje}) AS hoje
            FROM crm_task WHERE company_id = ${ctx.companyId} AND status <> 'concluida'
        `),
      ) as unknown as Promise<{ atrasadas: string; hoje: string }[]>,
      [],
    ),
    seguro(listarDocumentos(ctx), []),
    seguro(extrasDosDocumentos(ctx), null),
    seguro(listarPedidos(ctx), []),
    seguro(listSupportTicketsAction(), []),
    seguro(notasDoMes(ctx, mes), null),
    seguro(listarFilas(['FECHAR_MES']), null),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT count(*) AS n, coalesce(sum(value), 0) AS valor FROM accounting_invoice
           WHERE company_id = ${ctx.companyId} AND status <> 'PAID' AND due_date < ${hoje}
        `),
      ) as unknown as Promise<{ n: string; valor: string }[]>,
      [],
    ),
  ]);

  const p: Pendencia[] = [];

  // Impostos: guia vencida ou vencendo na semana.
  for (const g of guias) {
    const d = diasAte(g.venc);
    p.push({
      id: `guia-${g.id}`,
      area: 'Impostos',
      texto: d < 0 ? `${g.tax_name} venceu em ${br(g.venc)}` : d === 0 ? `${g.tax_name} vence hoje` : `${g.tax_name} vence em ${br(g.venc)}`,
      detalhe: BRL.format(Number(g.amount)),
      tom: d < 0 ? 'alerta' : 'atencao',
      href: '/minha-contabilidade/guias',
      acao: 'Ver guia',
    });
  }

  // Contabilidade: fechamento esperando aprovação.
  if (fila && fila.aprovacao.length > 0) {
    p.push({
      id: 'fechamento',
      area: 'Contabilidade',
      texto: 'Fechamento do mês esperando a sua aprovação',
      tom: 'atencao',
      href: '/meu-negocio/relatorios/fechamento',
      acao: 'Revisar',
    });
  }

  // Financeiro.
  const pagar = financeiro.find((f) => f.type === 'PAYABLE');
  const receber = financeiro.find((f) => f.type === 'RECEIVABLE');
  if (pagar && Number(pagar.vencidos) > 0)
    p.push({ id: 'pagar-vencido', area: 'Financeiro', texto: `${plural(Number(pagar.vencidos), 'conta a pagar vencida', 'contas a pagar vencidas')}`, detalhe: BRL.format(Number(pagar.valor_vencido)), tom: 'alerta', href: '/meu-negocio/hub-financeiro?aba=pagar', acao: 'Ver contas' });
  if (pagar && Number(pagar.semana) > 0)
    p.push({ id: 'pagar-semana', area: 'Financeiro', texto: `${plural(Number(pagar.semana), 'conta vence', 'contas vencem')} nos próximos 7 dias`, detalhe: BRL.format(Number(pagar.valor_semana)), tom: 'atencao', href: '/meu-negocio/hub-financeiro?aba=pagar', acao: 'Ver contas' });
  if (receber && Number(receber.vencidos) > 0)
    p.push({ id: 'receber-atrasado', area: 'Financeiro', texto: `${plural(Number(receber.vencidos), 'recebimento atrasado', 'recebimentos atrasados')}`, detalhe: BRL.format(Number(receber.valor_vencido)), tom: 'alerta', href: '/meu-negocio/hub-financeiro?aba=receber', acao: 'Cobrar' });

  // Contratos.
  const assinar = contratos.filter((c) => c.meFaltaAssinar);
  if (assinar.length)
    p.push({ id: 'contrato-assinar', area: 'Contratos', texto: assinar.length === 1 ? `Contrato esperando a sua assinatura: ${assinar[0]!.title}` : `${assinar.length} contratos esperando a sua assinatura`, tom: 'alerta', href: '/meu-negocio/contratos', acao: 'Assinar' });
  const terminando = contratos.filter((c) => c.status === 'ATIVO' && c.endDate >= hoje && c.endDate <= em30);
  if (terminando.length)
    p.push({ id: 'contrato-fim', area: 'Contratos', texto: `${plural(terminando.length, 'contrato termina', 'contratos terminam')} nos próximos 30 dias`, detalhe: terminando.length === 1 ? terminando[0]!.title : undefined, tom: 'atencao', href: '/meu-negocio/contratos', acao: 'Ver' });
  const reajuste = contratos.filter((c) => c.status === 'ATIVO' && c.adjustmentIndex !== 'NENHUM' && c.nextAdjustmentDate && c.nextAdjustmentDate <= em30);
  if (reajuste.length)
    p.push({ id: 'contrato-reajuste', area: 'Contratos', texto: `${plural(reajuste.length, 'contrato tem', 'contratos têm')} reajuste para aplicar`, tom: 'atencao', href: '/meu-negocio/contratos', acao: 'Reajustar' });

  // Propostas.
  const aceitasSemContrato = propostas.filter((x) => x.status === 'aprovada' && !x.contratoId);
  if (aceitasSemContrato.length)
    p.push({ id: 'proposta-aceita', area: 'Propostas', texto: `${plural(aceitasSemContrato.length, 'proposta aceita', 'propostas aceitas')} sem contrato`, tom: 'atencao', href: '/meu-negocio/propostas', acao: 'Fazer contrato' });
  const vistas = propostas.filter((x) => x.status === 'vista');
  if (vistas.length)
    p.push({ id: 'proposta-vista', area: 'Propostas', texto: `${plural(vistas.length, 'proposta foi vista', 'propostas foram vistas')} pelo cliente, sem resposta`, detalhe: 'Bom momento para um contato', tom: 'atencao', href: '/meu-negocio/propostas', acao: 'Ver' });

  // Clientes: tarefas.
  const t = tarefas[0];
  if (t && Number(t.atrasadas) > 0)
    p.push({ id: 'tarefa-atrasada', area: 'Clientes', texto: `${plural(Number(t.atrasadas), 'tarefa atrasada', 'tarefas atrasadas')}`, tom: 'alerta', href: '/relacionamento', acao: 'Ver tarefas' });
  if (t && Number(t.hoje) > 0)
    p.push({ id: 'tarefa-hoje', area: 'Clientes', texto: `${plural(Number(t.hoje), 'tarefa para hoje', 'tarefas para hoje')}`, tom: 'atencao', href: '/relacionamento', acao: 'Ver tarefas' });

  // Documentos: o essencial vencido ou vencendo, e o certificado.
  for (const i of checklist(docs)) {
    if (i.situacao === 'VENCIDO' || i.situacao === 'VENCE_EM_BREVE')
      p.push({
        id: `doc-${i.categoria}`,
        area: 'Documentos',
        texto: i.situacao === 'VENCIDO' ? `${i.nome} vencida` : `${i.nome} vence em ${plural(i.diasParaVencer ?? 0, 'dia', 'dias')}`,
        tom: i.situacao === 'VENCIDO' ? 'alerta' : 'atencao',
        href: i.servico ? `/mais/servicos?pedir=${encodeURIComponent(i.servico)}` : '/minha-contabilidade/arquivos',
        acao: i.servico ? 'Pedir' : 'Ver',
      });
  }
  if (extras && ['VENCIDO', 'INVALIDO'].includes(extras.certificado.nivel))
    p.push({ id: 'certificado', area: 'Documentos', texto: 'Certificado digital vencido ou inválido', detalhe: 'Sem ele, a nota não é emitida', tom: 'alerta', href: '/configuracoes/fiscal', acao: 'Enviar' });
  else if (extras?.certificado.validoAte && diasAte(extras.certificado.validoAte) <= 30)
    p.push({ id: 'certificado', area: 'Documentos', texto: `Certificado digital vence em ${plural(diasAte(extras.certificado.validoAte), 'dia', 'dias')}`, tom: 'atencao', href: '/configuracoes/fiscal', acao: 'Renovar' });

  // Atendimento e serviços: o que espera resposta sua.
  const comVoce = pedidos.filter((x) => x.situacao === 'AGUARDANDO_VOCE').length;
  if (comVoce) p.push({ id: 'pedido', area: 'Atendimento', texto: `A contabilidade precisa de algo seu em ${plural(comVoce, 'pedido', 'pedidos')} de serviço`, tom: 'alerta', href: '/mais/servicos', acao: 'Responder' });
  const respondidas = conversas.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED' && (c.respondido || c.status === 'WAITING_CLIENT')).length;
  if (respondidas) p.push({ id: 'conversa', area: 'Atendimento', texto: `${plural(respondidas, 'resposta nova', 'respostas novas')} da contabilidade`, tom: 'atencao', href: '/suporte', acao: 'Ler' });

  // Notas com erro.
  if (notas && notas.comErro.length)
    p.push({ id: 'nota-erro', area: 'Notas', texto: `${plural(notas.comErro.length, 'tentativa', 'tentativas')} de nota com erro`, detalhe: 'Não viraram nota', tom: 'alerta', href: '/meu-negocio/notas', acao: 'Ver' });

  // Honorários atrasados.
  const h = honorarios[0];
  if (h && Number(h.n) > 0)
    p.push({ id: 'honorario', area: 'Plano', texto: `${plural(Number(h.n), 'fatura de honorários atrasada', 'faturas de honorários atrasadas')}`, detalhe: BRL.format(Number(h.valor)), tom: 'alerta', href: '/meu-plano', acao: 'Ver fatura' });

  // O que já passou do prazo vem antes.
  return p.sort((a, b) => (a.tom === b.tom ? 0 : a.tom === 'alerta' ? -1 : 1));
}

// ── O mês em números ────────────────────────────────────────────────────────

export interface MesEmNumeros {
  mes: string; // YYYY-MM
  faturado: number;
  faturadoAnterior: number;
  notas: number;
  imposto: number;
  aliquota: number;
  resultado: number;
  despesas: number;
  caixa14: { entra: number; sai: number };
}

export async function mesEmNumeros(ctx: TenantContext, mes: string): Promise<MesEmNumeros> {
  const hoje = hojeSP();
  const em14 = somaDias(hoje, 14);
  const [serie, taxa, dre, notas, caixa] = await Promise.all([
    seguro(faturamentoMensal(ctx), []),
    seguro(aliquotaDoFaturamento(ctx), { aliquota: 0, apurada: false }),
    seguro(getBalancoDreData(ctx, { de: `${mes}-01`, ate: `${mes}-01` }), null),
    seguro(notasDoMes(ctx, mes), null),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(sum(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS entra,
                 coalesce(sum(amount) FILTER (WHERE type = 'PAYABLE'), 0) AS sai
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND status IN ('PENDING', 'OVERDUE') AND due_date >= ${hoje} AND due_date <= ${em14}
        `),
      ) as unknown as Promise<{ entra: string; sai: string }[]>,
      [],
    ),
  ]);
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const ant = new Date(y, m - 2, 1);
  const mesAnterior = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, '0')}`;
  const faturado = serie.find((s) => s.mes === mes)?.valor ?? dre?.receita ?? 0;
  return {
    mes,
    faturado,
    faturadoAnterior: serie.find((s) => s.mes === mesAnterior)?.valor ?? 0,
    notas: notas?.emitidas.filter((n) => !n.cancelada).length ?? 0,
    imposto: (faturado * taxa.aliquota) / 100,
    aliquota: taxa.aliquota,
    resultado: dre?.lucroLiquido ?? 0,
    despesas: dre ? dre.despesasOperacionais + dre.prolabore : 0,
    caixa14: { entra: Number(caixa[0]?.entra ?? 0), sai: Number(caixa[0]?.sai ?? 0) },
  };
}

// ── Cada área num relance ───────────────────────────────────────────────────

export interface QuadroDaArea {
  area: string;
  href: string;
  numero: string;
  linha: string;
  /** Uma segunda informação, menor. */
  extra?: string;
}

export async function areasNumRelance(ctx: TenantContext): Promise<QuadroDaArea[]> {
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const [fin, notas, clientes, contratos, propostas, pessoas, docs, taxa] = await Promise.all([
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(sum(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS receber,
                 coalesce(sum(amount) FILTER (WHERE type = 'PAYABLE' AND description NOT ILIKE 'Provisão de Imposto%'), 0) AS pagar
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND status IN ('PENDING', 'OVERDUE')
             AND to_char(due_date, 'YYYY-MM') = ${mes}
        `),
      ) as unknown as Promise<{ receber: string; pagar: string }[]>,
      [],
    ),
    seguro(notasDoMes(ctx, mes), null),
    seguro(listarClientes(ctx), []),
    seguro(listContractsAction(), []),
    seguro(listarPropostas(ctx, ''), []),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT (SELECT count(*) FROM partner WHERE company_id = ${ctx.companyId}) AS socios,
                 (SELECT count(*) FROM employee WHERE company_id = ${ctx.companyId} AND status <> 'TERMINATED') AS equipe,
                 (SELECT coalesce(sum(salary), 0) FROM employee WHERE company_id = ${ctx.companyId} AND status <> 'TERMINATED') AS folha,
                 (SELECT coalesce(sum(pro_labore), 0) FROM partner WHERE company_id = ${ctx.companyId}) AS prolabore
        `),
      ) as unknown as Promise<{ socios: string; equipe: string; folha: string; prolabore: string }[]>,
      [],
    ),
    seguro(listarDocumentos(ctx), []),
    seguro(aliquotaDoFaturamento(ctx), { aliquota: 0, apurada: false }),
  ]);

  const emitidas = notas?.emitidas.filter((n) => !n.cancelada) ?? [];
  const recorrentes = clientes.filter((c) => relacaoDoCliente(c) === 'RECORRENTE').length;
  const ativosC = clientes.filter((c) => relacaoDoCliente(c) !== 'INATIVO').length;
  const contratosAtivos = contratos.filter((c) => c.status === 'ATIVO' && c.type === 'ENTRADA' && c.endDate >= hoje);
  const negociando = propostas.filter((x) => x.status === 'enviada' || x.status === 'vista');
  const essencial = checklist(docs);
  const emDia = essencial.filter((i) => i.situacao === 'EM_DIA').length;
  const pe = pessoas[0];
  const f = fin[0];

  return [
    { area: 'Financeiro', href: '/meu-negocio/hub-financeiro', numero: BRL.format(Number(f?.receber ?? 0)), linha: 'a receber este mês', extra: `${BRL.format(Number(f?.pagar ?? 0))} a pagar` },
    { area: 'Notas', href: '/meu-negocio/notas', numero: String(emitidas.length), linha: emitidas.length === 1 ? 'nota emitida no mês' : 'notas emitidas no mês', extra: BRL.format(emitidas.reduce((s, n) => s + n.valor, 0)) },
    { area: 'Impostos', href: '/minha-contabilidade/termometro-tributario', numero: `${taxa.aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`, linha: taxa.apurada ? 'alíquota apurada' : 'alíquota estimada', extra: 'Ver a Bússola' },
    { area: 'Clientes', href: '/relacionamento', numero: String(ativosC), linha: ativosC === 1 ? 'cliente ativo' : 'clientes ativos', extra: `${recorrentes} ${recorrentes === 1 ? 'recorrente' : 'recorrentes'}` },
    { area: 'Contratos', href: '/meu-negocio/contratos', numero: String(contratosAtivos.length), linha: contratosAtivos.length === 1 ? 'contrato ativo' : 'contratos ativos', extra: `${BRL.format(contratosAtivos.reduce((s, c) => s + c.value, 0))}/mês` },
    { area: 'Propostas', href: '/meu-negocio/propostas', numero: BRL.format(negociando.reduce((s, x) => s + x.total, 0)), linha: 'em negociação', extra: plural(negociando.length, 'proposta aberta', 'propostas abertas') },
    { area: 'Pessoas', href: '/minha-contabilidade/socios', numero: String(Number(pe?.socios ?? 0) + Number(pe?.equipe ?? 0)), linha: `${plural(Number(pe?.socios ?? 0), 'sócio', 'sócios')} e ${plural(Number(pe?.equipe ?? 0), 'colaborador', 'colaboradores')}`, extra: `${BRL.format(Number(pe?.prolabore ?? 0) + Number(pe?.folha ?? 0))}/mês` },
    { area: 'Documentos', href: '/minha-contabilidade/arquivos', numero: `${emDia} de ${essencial.length}`, linha: 'essenciais em dia', extra: emDia < essencial.length ? `${essencial.length - emDia} para resolver` : 'Tudo em dia' },
  ];
}

/** Faturamento dos últimos 12 meses — só nota fiscal, a mesma série da Bússola. */
export async function faturamento12Meses(ctx: TenantContext) {
  const serie = await seguro(faturamentoMensal(ctx), []);
  return serie.slice(-12);
}
