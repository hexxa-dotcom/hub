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
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';
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

// ── Cada área num relance ───────────────────────────────────────────────────

export interface AreasDaEmpresa {
  financeiro: { receber: number; pagar: number; recebido: number; pago: number };
  notas: { quantidade: number; valor: number; ultima: string | null };
  impostos: { aliquota: number; apurada: boolean; proximaGuia: { nome: string; valor: number; vencimento: string } | null };
  clientes: { recorrentes: number; avulsos: number; inativos: number };
  contratos: { ativos: number; porMes: number; terminando: number };
  propostas: { enviadas: number; vistas: number; aceitas: number; emNegociacao: number };
  pessoas: { socios: number; equipe: number; custoMensal: number };
  documentos: { nome: string; situacao: 'EM_DIA' | 'VENCE_EM_BREVE' | 'VENCIDO' | 'FALTA' }[];
  /** Cada nota do mês: o dia e o valor (as bolhas). */
  notasPontos: { dia: number; valor: number }[];
  /** Contratos ativos que terminam nos próximos 12 meses: quando (0 a 1) e o nome. */
  contratosFim: { fracao: number; titulo: string; logo: boolean }[];
  iniciais: string[];
}

export async function areasDaEmpresa(ctx: TenantContext): Promise<AreasDaEmpresa> {
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const em60 = somaDias(hoje, 60);
  const [fin, notas, clientes, contratos, propostas, pessoas, docs, taxa, guia] = await Promise.all([
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(sum(amount) FILTER (WHERE type = 'RECEIVABLE' AND status IN ('PENDING', 'OVERDUE')), 0) AS receber,
                 coalesce(sum(amount) FILTER (WHERE type = 'PAYABLE' AND status IN ('PENDING', 'OVERDUE')), 0) AS pagar,
                 coalesce(sum(amount) FILTER (WHERE type = 'RECEIVABLE' AND status = 'PAID'), 0) AS recebido,
                 coalesce(sum(amount) FILTER (WHERE type = 'PAYABLE' AND status = 'PAID'), 0) AS pago
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND status <> 'CANCELED' AND to_char(due_date, 'YYYY-MM') = ${mes}
             AND NOT (type = 'PAYABLE' AND description ILIKE 'Provisão de Imposto%')
        `),
      ) as unknown as Promise<{ receber: string; pagar: string; recebido: string; pago: string }[]>,
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
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT tax_name, amount, to_char(due_date, 'YYYY-MM-DD') AS venc FROM tax_guide
           WHERE company_id = ${ctx.companyId} AND status <> 'PAID' AND NOT provisional
           ORDER BY due_date LIMIT 1
        `),
      ) as unknown as Promise<{ tax_name: string; amount: string; venc: string }[]>,
      [],
    ),
  ]);

  const emitidas = notas?.emitidas.filter((n) => !n.cancelada) ?? [];
  const nomes = (await seguro(
    withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`
        SELECT name FROM partner WHERE company_id = ${ctx.companyId}
        UNION ALL SELECT name FROM employee WHERE company_id = ${ctx.companyId} AND status <> 'TERMINATED'
      `),
    ) as unknown as Promise<{ name: string }[]>,
    [],
  )).map((r) => r.name);
  const iniciaisDasPessoas = nomes.map((n) => iniciais(nomeDeExibicao(n)));
  const rel = clientes.map((c) => relacaoDoCliente(c));
  const ativos = contratos.filter((c) => c.status === 'ATIVO' && c.type === 'ENTRADA' && c.endDate >= hoje);
  const f = fin[0];
  const pe = pessoas[0];
  const g = guia[0];

  return {
    financeiro: { receber: Number(f?.receber ?? 0), pagar: Number(f?.pagar ?? 0), recebido: Number(f?.recebido ?? 0), pago: Number(f?.pago ?? 0) },
    notas: {
      quantidade: emitidas.length,
      valor: emitidas.reduce((s, n) => s + n.valor, 0),
      ultima: emitidas.map((n) => n.data).filter(Boolean).sort().at(-1) ?? null,
    },
    impostos: { aliquota: taxa.aliquota, apurada: taxa.apurada, proximaGuia: g ? { nome: g.tax_name, valor: Number(g.amount), vencimento: g.venc } : null },
    clientes: {
      recorrentes: rel.filter((r) => r === 'RECORRENTE').length,
      avulsos: rel.filter((r) => r === 'AVULSO').length,
      inativos: rel.filter((r) => r === 'INATIVO').length,
    },
    contratos: {
      ativos: ativos.length,
      porMes: ativos.reduce((s, c) => s + c.value, 0),
      terminando: ativos.filter((c) => c.endDate <= em60).length,
    },
    propostas: {
      enviadas: propostas.filter((x) => x.status === 'enviada').length,
      vistas: propostas.filter((x) => x.status === 'vista').length,
      aceitas: propostas.filter((x) => x.status === 'aprovada').length,
      emNegociacao: propostas.filter((x) => x.status === 'enviada' || x.status === 'vista').reduce((s, x) => s + x.total, 0),
    },
    pessoas: {
      socios: Number(pe?.socios ?? 0),
      equipe: Number(pe?.equipe ?? 0),
      custoMensal: Number(pe?.prolabore ?? 0) + Number(pe?.folha ?? 0),
    },
    documentos: checklist(docs).map((i) => ({ nome: i.nome, situacao: i.situacao })),
    notasPontos: emitidas
      .filter((n) => n.data)
      .map((n) => ({ dia: Number(new Date(n.data!).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(8, 10)), valor: n.valor })),
    contratosFim: ativos
      .filter((c) => c.endDate <= somaDias(hoje, 365))
      .map((c) => ({ fracao: diasAte(c.endDate) / 365, titulo: `${c.title} · termina em ${br(c.endDate)}`, logo: c.endDate <= em60 })),
    iniciais: iniciaisDasPessoas,
  };
}

// ── Os números do topo ──────────────────────────────────────────────────────

export interface NumerosDoTopo {
  mes: string; // YYYY-MM
  faturado: number;
  faturadoAnterior: number;
  notas: number;
  /** Faturamento dos 12 meses até o mês escolhido (só nota). */
  serie: { mes: string; valor: number }[];
  /** Ticket médio dos últimos 7 meses (faturado / notas). */
  ticketSerie: number[];
  resultado: number;
  temResultado: boolean;
  despesas: { pagas: number; abertas: number };
  atraso: { ate15: number; ate60: number; mais60: number; quantidade: number };
  proximos14: { entradas: number[]; saidas: number[] };
  paraDistribuir: number;
}

export async function numerosDoTopo(ctx: TenantContext, mes: string, paraDistribuir = 0): Promise<NumerosDoTopo> {
  const hoje = hojeSP();
  const em13 = somaDias(hoje, 13);
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const mesDe = (d: number) => {
    const x = new Date(y, m - 1 + d, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  };
  const inicio12 = `${mesDe(-11)}-01`;

  const [porMes, dre, despesas, atraso, dias] = await Promise.all([
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT to_char(data_emissao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes,
                 sum(coalesce(valor_servico, valor_liquido)) AS valor, count(*) AS n
            FROM nfse_distribuicao_doc
           WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND NOT cancelado
             AND data_emissao >= ${inicio12}::date
           GROUP BY 1
        `),
      ) as unknown as Promise<{ mes: string; valor: string; n: string }[]>,
      [],
    ),
    seguro(getBalancoDreData(ctx, { de: `${mes}-01`, ate: `${mes}-01` }), null),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(sum(amount) FILTER (WHERE status = 'PAID'), 0) AS pagas,
                 coalesce(sum(amount) FILTER (WHERE status IN ('PENDING', 'OVERDUE')), 0) AS abertas
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND type = 'PAYABLE' AND status <> 'CANCELED'
             AND to_char(reference_month, 'YYYY-MM') = ${mes}
             AND description NOT ILIKE 'Provisão de Imposto%'
        `),
      ) as unknown as Promise<{ pagas: string; abertas: string }[]>,
      [],
    ),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(sum(amount) FILTER (WHERE ${hoje}::date - due_date <= 15), 0) AS ate15,
                 coalesce(sum(amount) FILTER (WHERE ${hoje}::date - due_date BETWEEN 16 AND 60), 0) AS ate60,
                 coalesce(sum(amount) FILTER (WHERE ${hoje}::date - due_date > 60), 0) AS mais60,
                 count(*) AS n
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND type = 'RECEIVABLE' AND status IN ('PENDING', 'OVERDUE') AND due_date < ${hoje}
        `),
      ) as unknown as Promise<{ ate15: string; ate60: string; mais60: string; n: string }[]>,
      [],
    ),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT to_char(due_date, 'YYYY-MM-DD') AS dia,
                 coalesce(sum(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS entra,
                 coalesce(sum(amount) FILTER (WHERE type = 'PAYABLE'), 0) AS sai
            FROM financial_entry
           WHERE company_id = ${ctx.companyId} AND status IN ('PENDING', 'OVERDUE') AND due_date BETWEEN ${hoje} AND ${em13}
           GROUP BY 1
        `),
      ) as unknown as Promise<{ dia: string; entra: string; sai: string }[]>,
      [],
    ),
  ]);

  const mapa = new Map(porMes.map((r) => [r.mes, { valor: Number(r.valor), n: Number(r.n) }]));
  const serie = Array.from({ length: 12 }, (_, i) => {
    const k = mesDe(i - 11);
    return { mes: k, valor: mapa.get(k)?.valor ?? 0 };
  });
  const ticketSerie = Array.from({ length: 7 }, (_, i) => {
    const x = mapa.get(mesDe(i - 6));
    return x && x.n ? x.valor / x.n : 0;
  });
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const proximos = Array.from({ length: 14 }, (_, i) => porDia.get(somaDias(hoje, i)));
  const at = atraso[0];
  const dp = despesas[0];

  return {
    mes,
    faturado: mapa.get(mes)?.valor ?? 0,
    faturadoAnterior: mapa.get(mesDe(-1))?.valor ?? 0,
    notas: mapa.get(mes)?.n ?? 0,
    serie,
    ticketSerie,
    resultado: dre?.lucroLiquido ?? 0,
    temResultado: !!dre,
    despesas: { pagas: Number(dp?.pagas ?? 0), abertas: Number(dp?.abertas ?? 0) },
    atraso: { ate15: Number(at?.ate15 ?? 0), ate60: Number(at?.ate60 ?? 0), mais60: Number(at?.mais60 ?? 0), quantidade: Number(at?.n ?? 0) },
    proximos14: { entradas: proximos.map((d) => Number(d?.entra ?? 0)), saidas: proximos.map((d) => Number(d?.sai ?? 0)) },
    paraDistribuir,
  };
}
