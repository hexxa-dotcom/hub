import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});

import { getDb } from './index';
import { company } from './schema/tenancy';
import {
  category,
  financialEntry,
  recurringExpense,
  bankAccount,
  bankTransaction,
  businessPartner,
} from './schema/finance';
import { customer, serviceInvoice, nfseConfig } from './schema/service-ops';
import { taxGuide, monthlyClosure, employee } from './schema/accounting';
import { eq, sql } from 'drizzle-orm';

async function seedFictitiousCompany() {
  const db = getDb();
  console.log('🚀 Iniciando injeção de dados para a empresa fictícia...');

  const companyId = 'ad35fdf7-3e07-4ad1-9d5d-ffe1c0356109';

  // 1. Atualiza Perfil da Empresa
  console.log('1. Atualizando dados da empresa...');
  await db
    .update(company)
    .set({
      legalName: 'Vortex Studio Design & Tecnologia Ltda',
      tradeName: 'Vortex Studio',
      useTradeName: true,
      cnpj: '42.189.321/0001-85',
      type: 'SERVICE',
      taxRegime: 'SIMPLES_NACIONAL',
      revenueCeiling: '4800000.00',
      profitDistributionFrequency: 'MENSAL',
      city: 'Florianópolis',
      state: 'SC',
      addressLine1: 'Rodovia José Carlos Daux, 5500 - Saco Grande',
      addressNumber: '5500',
      neighborhood: 'Saco Grande',
      zipcode: '88032005',
    })
    .where(eq(company.id, companyId));

  // 1.1 Configuração Fiscal NFSe
  await db
    .insert(nfseConfig)
    .values({
      companyId,
      ambiente: 'homologacao',
      cnpj: '42.189.321/0001-85',
      razaoSocial: 'Vortex Studio Design & Tecnologia Ltda',
      nomeFantasia: 'Vortex Studio',
      optanteSimples: true,
      cnae: '6201-5/01',
      itemListaServico: '01.01',
      aliquotaIss: '3.00',
      serieDps: '00001',
      proxNumeroDps: 15,
      uf: 'SC',
      codigoMunicipio: '4205407', // Florianópolis
    })
    .onConflictDoUpdate({
      target: [nfseConfig.companyId],
      set: {
        razaoSocial: 'Vortex Studio Design & Tecnologia Ltda',
        nomeFantasia: 'Vortex Studio',
        cnae: '6201-5/01',
        itemListaServico: '01.01',
      },
    });

  // 2. Categorias Financeiras
  console.log('2. Criando categorias de receitas e despesas...');
  const catList = [
    { name: 'Desenvolvimento de Software', kind: 'INCOME' as const },
    { name: 'Design & UI/UX', kind: 'INCOME' as const },
    { name: 'Consultoria Estratégica', kind: 'INCOME' as const },
    { name: 'Licenciamento de Software', kind: 'INCOME' as const },
    { name: 'Infraestrutura Cloud & Servidores', kind: 'EXPENSE' as const },
    { name: 'Softwares & SaaS', kind: 'EXPENSE' as const },
    { name: 'Pró-Labore & Sócios', kind: 'EXPENSE' as const },
    { name: 'Espaço Corporativo', kind: 'EXPENSE' as const },
    { name: 'Assessoria Contábil & Jurídica', kind: 'EXPENSE' as const },
  ];

  const catMap = new Map<string, string>();
  for (const c of catList) {
    const [existing] = await db
      .select({ id: category.id })
      .from(category)
      .where(sql`company_id = ${companyId} AND name = ${c.name}`);
    if (existing) {
      catMap.set(c.name, existing.id);
    } else {
      const [inserted] = await db
        .insert(category)
        .values({
          companyId,
          name: c.name,
          kind: c.kind,
        })
        .returning({ id: category.id });
      if (inserted) catMap.set(c.name, inserted.id);
    }
  }

  // 3. Clientes & Parceiros
  console.log('3. Criando clientes de destaque...');
  const clientesData = [
    { name: 'Nubank Parcerias S.A.', document: '30.680.829/0001-43', email: 'contasapagar@nubank.com.br' },
    { name: 'Stone Pagamentos S.A.', document: '16.501.555/0001-57', email: 'nfe@stone.com.br' },
    { name: 'Loft Tecnologia Imobiliária', document: '31.428.567/0001-90', email: 'financeiro@loft.com.br' },
    { name: 'Stripe Brasil Operações', document: '22.121.214/0001-10', email: 'pay-br@stripe.com' },
    { name: 'Banco Safra Inovação', document: '58.160.789/0001-28', email: 'financeiro@safrainovacao.com.br' },
  ];

  const customerMap = new Map<string, string>();
  for (const c of clientesData) {
    const [existing] = await db
      .select({ id: customer.id })
      .from(customer)
      .where(sql`company_id = ${companyId} AND document = ${c.document}`);
    if (existing) {
      customerMap.set(c.name, existing.id);
    } else {
      const [inserted] = await db
        .insert(customer)
        .values({
          companyId,
          name: c.name,
          document: c.document,
          email: c.email,
          type: 'PJ',
        })
        .returning({ id: customer.id });
      if (inserted) customerMap.set(c.name, inserted.id);

      // Também em businessPartner
      await db
        .insert(businessPartner)
        .values({
          companyId,
          name: c.name,
          document: c.document,
          type: 'CLIENT',
        })
        .onConflictDoNothing();
    }
  }

  // 4. Limpeza de lançamentos antigos de teste (apenas registros de teste pequenos)
  console.log('4. Higienizando lançamentos antigos de teste...');
  await db.execute(sql`
    DELETE FROM financial_entry 
    WHERE company_id = ${companyId} 
      AND (description LIKE '%teste%' OR description LIKE '%jjjj%' OR description LIKE '%kkkk%')
  `);

  // 5. Histórico de Faturamento (Últimos 8 meses pagos para gráfico de faturamento)
  console.log('5. Populando faturamento histórico dos últimos 8 meses...');
  const mesesHistorico = [
    { mes: '2026-01-01', valor: '39000.00', desc: 'Faturamento Mensal - Contratos de Software' },
    { mes: '2026-02-01', valor: '44000.00', desc: 'Faturamento Mensal - Contratos de Software' },
    { mes: '2026-03-01', valor: '41000.00', desc: 'Faturamento Mensal - Contratos de Software' },
    { mes: '2026-04-01', valor: '52000.00', desc: 'Faturamento Mensal - Contratos & Consultorias' },
    { mes: '2026-05-01', valor: '48000.00', desc: 'Faturamento Mensal - Contratos & Consultorias' },
    { mes: '2026-06-01', valor: '58000.00', desc: 'Faturamento Mensal - Contratos & Consultorias' },
    { mes: '2026-07-01', valor: '54000.00', desc: 'Faturamento Mensal - Contratos & Consultorias' },
  ];

  for (const h of mesesHistorico) {
    const [existing] = await db
      .select({ id: financialEntry.id })
      .from(financialEntry)
      .where(sql`company_id = ${companyId} AND reference_month = ${h.mes} AND type = 'RECEIVABLE'`);
    if (!existing) {
      await db.insert(financialEntry).values({
        companyId,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: h.desc,
        amount: h.valor,
        dueDate: `${h.mes.slice(0, 7)}-10`,
        referenceMonth: h.mes,
        source: 'MANUAL',
        categoryId: catMap.get('Desenvolvimento de Software'),
      });
    }
  }

  // 6. Mês Atual (2026-08) - Entradas e Saídas Estruturadas
  console.log('6. Injetando entradas e saídas do mês corrente (2026-08)...');
  const curMonthStr = '2026-08-01';

  // Remove entradas de 2026-08 antes de reinserir para idempotência
  await db.execute(sql`
    DELETE FROM financial_entry 
    WHERE company_id = ${companyId} AND reference_month = ${curMonthStr}
  `);

  const lancamentosAgosto = [
    // RECEBÍVEIS (Total R$ 59.000)
    {
      type: 'RECEIVABLE' as const,
      status: 'PAID' as const,
      description: 'Desenvolvimento Mobile Sprint #4 - Nubank',
      amount: '18500.00',
      dueDate: '2026-08-10',
      cat: 'Desenvolvimento de Software',
      partner: 'Nubank Parcerias S.A.',
    },
    {
      type: 'RECEIVABLE' as const,
      status: 'PAID' as const,
      description: 'Arquitetura Cloud & Microserviços - Stone',
      amount: '14000.00',
      dueDate: '2026-08-15',
      cat: 'Consultoria Estratégica',
      partner: 'Stone Pagamentos S.A.',
    },
    {
      type: 'RECEIVABLE' as const,
      status: 'PENDING' as const,
      description: 'Design System & UI Components - Loft',
      amount: '12800.00',
      dueDate: '2026-08-30',
      cat: 'Design & UI/UX',
      partner: 'Loft Tecnologia Imobiliária',
    },
    {
      type: 'RECEIVABLE' as const,
      status: 'PENDING' as const,
      description: 'Retainer Mensal de Suporte API - Stripe',
      amount: '9500.00',
      dueDate: '2026-08-31',
      cat: 'Licenciamento de Software',
      partner: 'Stripe Brasil Operações',
    },
    {
      type: 'RECEIVABLE' as const,
      status: 'PENDING' as const,
      description: 'Integração Webhook Customizado - Banco Safra',
      amount: '4200.00',
      dueDate: '2026-08-25', // Vencido! 4 dias de atraso para acionar o Radar de Inadimplência
      cat: 'Desenvolvimento de Software',
      partner: 'Banco Safra Inovação',
    },

    // DESPESAS DO MÊS (Total R$ 25.380)
    {
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Pró-Labore Sócios (Agosto)',
      amount: '12500.00',
      dueDate: '2026-08-05',
      cat: 'Pró-Labore & Sócios',
    },
    {
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Infraestrutura AWS Cloud',
      amount: '3800.00',
      dueDate: '2026-08-12',
      cat: 'Infraestrutura Cloud & Servidores',
    },
    {
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Coworking & Espaço Físico',
      amount: '2450.00',
      dueDate: '2026-08-10',
      cat: 'Espaço Corporativo',
    },
    {
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Licenças SaaS (GitHub, Figma, Slack)',
      amount: '1890.00',
      dueDate: '2026-08-20',
      cat: 'Softwares & SaaS',
    },
    {
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Honorários Contábeis - Hexx Contabilidade',
      amount: '1200.00',
      dueDate: '2026-08-15',
      cat: 'Assessoria Contábil & Jurídica',
    },
    {
      type: 'PAYABLE' as const,
      status: 'PENDING' as const,
      description: 'Provisão de Imposto - NFSe (Simples Nacional 6%)',
      amount: '3540.00',
      dueDate: '2026-09-20', // Vence dia 20 do mês seguinte
      cat: 'Assessoria Contábil & Jurídica',
    },
  ];

  for (const l of lancamentosAgosto) {
    await db.insert(financialEntry).values({
      companyId,
      type: l.type,
      status: l.status,
      description: l.description,
      amount: l.amount,
      dueDate: l.dueDate,
      referenceMonth: curMonthStr,
      source: 'MANUAL',
      categoryId: l.cat ? catMap.get(l.cat) : null,
    });
  }

  // 7. Próximos 14 Dias (Para animar o gráfico diário de fluxo de caixa)
  console.log('7. Distribuindo fluxo de caixa nos próximos 14 dias...');
  const fluxo14Dias = [
    { type: 'RECEIVABLE' as const, amount: '3500.00', due: '2026-08-29', desc: 'Recebimento Pix Consultoria Avulsa' },
    { type: 'PAYABLE' as const, amount: '850.00', due: '2026-08-29', desc: 'Suprimentos & Cafeteria' },
    { type: 'PAYABLE' as const, amount: '1200.00', due: '2026-08-31', desc: 'Internet Fibra Dedicada' },
    { type: 'PAYABLE' as const, amount: '450.00', due: '2026-09-02', desc: 'Serviço de Backup Redundante' },
    { type: 'RECEIVABLE' as const, amount: '8000.00', due: '2026-09-05', desc: 'Adiantamento Novo Projeto FinTech' },
    { type: 'PAYABLE' as const, amount: '12500.00', due: '2026-09-05', desc: 'Pró-Labore Sócios (Setembro)' },
    { type: 'RECEIVABLE' as const, amount: '6500.00', due: '2026-09-08', desc: 'Consultoria Estratégica Sprint #2' },
    { type: 'PAYABLE' as const, amount: '980.00', due: '2026-09-08', desc: 'Google Workspace Enterprise' },
    { type: 'RECEIVABLE' as const, amount: '14000.00', due: '2026-09-10', desc: 'Mensalidade Contrato Stone' },
    { type: 'PAYABLE' as const, amount: '2450.00', due: '2026-09-10', desc: 'Aluguel Coworking (Setembro)' },
    { type: 'PAYABLE' as const, amount: '3800.00', due: '2026-09-12', desc: 'Fatura Mensal AWS Cloud' },
  ];

  for (const f of fluxo14Dias) {
    await db.insert(financialEntry).values({
      companyId,
      type: f.type,
      status: 'PENDING',
      description: f.desc,
      amount: f.amount,
      dueDate: f.due,
      referenceMonth: f.due.slice(0, 7) + '-01',
      source: 'MANUAL',
    });
  }

  // 8. Notas Fiscais Emitidas (`service_invoice`)
  console.log('8. Cadastrando Notas Fiscais (NFSe)...');
  await db.execute(sql`DELETE FROM service_invoice WHERE company_id = ${companyId}`);

  const notasFiscais = [
    {
      customer: 'Nubank Parcerias S.A.',
      num: '20260810',
      amount: '18500.00',
      desc: 'Desenvolvimento Mobile Sprint #4',
      status: 'ISSUED' as const,
      taxAmount: '1110.00',
      taxRate: '6.000',
      protocol: 'SP-NFSE-2026-0810-09823',
    },
    {
      customer: 'Stone Pagamentos S.A.',
      num: '20260811',
      amount: '14000.00',
      desc: 'Arquitetura Cloud & Microserviços',
      status: 'ISSUED' as const,
      taxAmount: '840.00',
      taxRate: '6.000',
      protocol: 'SP-NFSE-2026-0811-09824',
    },
    {
      customer: 'Loft Tecnologia Imobiliária',
      num: '20260812',
      amount: '12800.00',
      desc: 'Design System & UI Components',
      status: 'ISSUED' as const,
      taxAmount: '768.00',
      taxRate: '6.000',
      protocol: 'SP-NFSE-2026-0812-09825',
    },
    {
      customer: 'Stripe Brasil Operações',
      num: '20260813',
      amount: '9500.00',
      desc: 'Retainer Mensal de Suporte API',
      status: 'ISSUED' as const,
      taxAmount: '570.00',
      taxRate: '6.000',
      protocol: 'SP-NFSE-2026-0813-09826',
    },
    {
      customer: 'Banco Safra Inovação',
      num: null,
      amount: '4200.00',
      desc: 'Integração Webhook Customizado',
      status: 'ISSUING' as const,
      taxAmount: '252.00',
      taxRate: '6.000',
      protocol: 'PROT-20260829-994812',
    },
  ];

  for (const n of notasFiscais) {
    await db.insert(serviceInvoice).values({
      companyId,
      customerId: customerMap.get(n.customer),
      nfseNumber: n.num,
      amount: n.amount,
      serviceDescription: n.desc,
      referenceMonth: '2026-08-01',
      status: n.status,
      taxAmount: n.taxAmount,
      taxRate: n.taxRate,
      providerProtocol: n.protocol,
      providerMode: 'gov',
    });
  }

  // 9. Fechamento Mensal Pronto (`monthly_closure`)
  console.log('9. Gerando fechamento do mês anterior...');
  await db
    .insert(monthlyClosure)
    .values({
      companyId,
      referenceMonth: '2026-07-01',
      totalRevenue: '54000.00',
      totalExpenses: '22500.00',
      newContractsCount: 2,
      defaultsCount: 0,
      status: 'CLOSED',
    })
    .onConflictDoNothing();

  // 10. Guia DAS em Aberto (`tax_guide`)
  console.log('10. Gerando guia DAS do Simples Nacional...');
  await db
    .insert(taxGuide)
    .values({
      companyId,
      taxName: 'DAS - Simples Nacional',
      referenceMonth: '2026-07-01',
      amount: '3240.00',
      dueDate: '2026-08-20',
      status: 'OPEN',
      pixCode:
        '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654063240.005802BR5925VORTEX STUDIO DESIGN LTDA6013FLORIANOPOLIS62070503***6304ABCD',
    })
    .onConflictDoNothing();

  // 11. Colaboradores & Folha para Fator R
  console.log('11. Cadastrando equipe e pró-labore para consolidação do Fator R...');
  const colaboradores = [
    { name: 'Filipe Tiago Heck Silva', vinculo: 'Socio', salary: '12500.00', role: 'CEO & Diretor de Tecnologia' },
    { name: 'Mariana Carvalho', vinculo: 'CLT', salary: '6800.00', role: 'Senior Product Designer' },
    { name: 'Lucas Mendonça', vinculo: 'CLT', salary: '8200.00', role: 'Engenheiro de Software Fullstack' },
  ];

  for (const colab of colaboradores) {
    const [exist] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(sql`company_id = ${companyId} AND name = ${colab.name}`);
    if (!exist) {
      await db.insert(employee).values({
        companyId,
        name: colab.name,
        vinculo: colab.vinculo,
        salary: colab.salary,
        roleTitle: colab.role,
        status: 'ACTIVE',
        admissionDate: '2025-01-10',
      });
    }
  }

  // 12. Despesas Fixas Recorrentes (`recurring_expense`)
  console.log('12. Inserindo contratos de despesas fixas...');
  const despesasFixas = [
    { desc: 'Infraestrutura AWS Cloud', amount: '3800.00', dueDay: 12, cat: 'Infraestrutura Cloud & Servidores' },
    { desc: 'Coworking & Espaço Físico', amount: '2450.00', dueDay: 10, cat: 'Espaço Corporativo' },
    { desc: 'Figma Organization & GitHub Enterprise', amount: '1890.00', dueDay: 20, cat: 'Softwares & SaaS' },
    { desc: 'Honorários Contábeis - Hexx Contabilidade', amount: '1200.00', dueDay: 15, cat: 'Assessoria Contábil & Jurídica' },
  ];

  for (const df of despesasFixas) {
    const [exist] = await db
      .select({ id: recurringExpense.id })
      .from(recurringExpense)
      .where(sql`company_id = ${companyId} AND description = ${df.desc}`);
    if (!exist) {
      await db.insert(recurringExpense).values({
        companyId,
        description: df.desc,
        amount: df.amount,
        dueDay: df.dueDay,
        categoryName: df.cat,
        startMonth: '2026-01-01',
        active: true,
      });
    }
  }

  // 13. Conta Bancária & Transações
  console.log('13. Populando conta bancária e extrato...');
  const [existingConta] = await db
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .where(eq(bankAccount.companyId, companyId));

  let accountId = existingConta?.id;
  if (!accountId) {
    const [novaConta] = await db
      .insert(bankAccount)
      .values({
        companyId,
        bankName: 'Itaú Unibanco PJ',
        number: '48291-0',
        currentBalance: '48750.00',
      })
      .returning({ id: bankAccount.id });
    accountId = novaConta!.id;
  }

  // Insere transações de extrato
  await db.execute(sql`DELETE FROM bank_transaction WHERE company_id = ${companyId}`);
  const transacoes = [
    { desc: 'PIX RECEBIDO - NUBANK PARCERIAS S.A.', amount: '18500.00', date: '2026-08-10' },
    { desc: 'TED RECEBIDA - STONE PAGAMENTOS S.A.', amount: '14000.00', date: '2026-08-15' },
    { desc: 'PIX ENVIADO - PRO-LABORE FILIPE HECK', amount: '-12500.00', date: '2026-08-05' },
    { desc: 'DEBITO AUT - AWS CLOUD SERVICES', amount: '-3800.00', date: '2026-08-12' },
    { desc: 'PIX ENVIADO - COWORKING SACO GRANDE', amount: '-2450.00', date: '2026-08-10' },
  ];

  for (const t of transacoes) {
    await db.insert(bankTransaction).values({
      companyId,
      bankAccountId: accountId,
      postedAt: t.date,
      amount: t.amount,
      description: t.desc,
      reconciliationStatus: 'UNMATCHED',
    });
  }

  console.log('\n✨ Injeção concluída com sucesso!');
  console.log('A empresa "Vortex Studio Design & Tecnologia Ltda" está 100% pronta e populada.');
  process.exit(0);
}

seedFictitiousCompany().catch((err) => {
  console.error('❌ Erro durante o seed:', err);
  process.exit(1);
});
