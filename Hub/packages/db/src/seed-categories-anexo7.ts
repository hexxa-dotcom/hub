import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
import { getDb } from './index';
import { category } from './schema/finance';
import { eq, and } from 'drizzle-orm';

/**
 * Categorias financeiras (fluxo de caixa/DRE) derivadas do Grupo 3
 * (Resultado) do "Plano de Contas Sugerido para Pequena Empresa" — ANEXO 7
 * da ITG 1000 (CFC, Resolução 1.418/2012, redação de 15/12/2022,
 * https://cfc.org.br/wp-content/uploads/2023/01/ITG-1000.pdf).
 *
 * `accountingCode`/`accountingGroup` seguem o código oficial do Anexo 7 —
 * é o "de-para" que vai alimentar o export contábil (Omie: Categorias x
 * Plano Contábil) quando essa integração for construída de verdade. Contas
 * duplicadas entre "Despesas com Vendas" e "Despesas Administrativas" no
 * Anexo 7 (ex: Salários, INSS, FGTS) foram desambiguadas no nome pra não
 * ter duas categorias com o mesmo rótulo na tela.
 *
 * Não inclui Ativo/Passivo/Patrimônio Líquido (grupos 1 e 2) — só contas de
 * Resultado fazem sentido como "categoria" de lançamento no Hub; o restante
 * do plano de contas contábil completo fica pra quando o Hub tiver
 * escrituração contábil de verdade, não só fluxo de caixa.
 *
 * Executar: npx tsx packages/db/src/seed-categories-anexo7.ts <companyId>
 */

type Kind = 'INCOME' | 'EXPENSE';
interface Cat {
  code: string;
  name: string;
  kind: Kind;
  group: string;
}

const CATEGORIES: Cat[] = [
  // 3.1.1 — Receita Bruta Operacional
  { code: '3.1.1.01.01', name: 'Serviços Prestados', kind: 'INCOME', group: 'Receita Bruta Operacional' },
  { code: '3.1.1.01.02', name: 'Mercadorias Vendidas', kind: 'INCOME', group: 'Receita Bruta Operacional' },
  { code: '3.1.1.01.03', name: 'Produtos Vendidos', kind: 'INCOME', group: 'Receita Bruta Operacional' },

  // 3.1.2 — Deduções da Receita Bruta (impostos sobre faturamento)
  { code: '3.1.2.01.01', name: 'PIS s/ Faturamento', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.01.02', name: 'COFINS s/ Faturamento', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.01.03', name: 'ISS', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.01.04', name: 'ICMS', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.01.05', name: 'Simples Nacional (DAS)', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  // Reforma tributária (IBS/CBS substituem PIS/COFINS/ISS/ICMS na transição 2026-2033) —
  // ver memória hexx_reforma_tributaria: sistema precisa já considerar isso nos módulos fiscais.
  { code: '3.1.2.01.06', name: 'CBS (Reforma Tributária)', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.01.07', name: 'IBS (Reforma Tributária)', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Impostos s/ Faturamento' },
  { code: '3.1.2.02.01', name: 'Descontos e Abatimentos', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Outras Deduções' },
  { code: '3.1.2.02.02', name: 'Devoluções', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Outras Deduções' },
  { code: '3.1.2.02.03', name: 'Juros de AVP', kind: 'EXPENSE', group: 'Deduções da Receita Bruta — Outras Deduções' },

  // 3.2 — Custos
  { code: '3.2.1.01.01', name: 'Custo dos Produtos Vendidos', kind: 'EXPENSE', group: 'Custos dos Bens e Serviços Vendidos' },
  { code: '3.2.1.01.02', name: 'Custo das Mercadorias Vendidas', kind: 'EXPENSE', group: 'Custos dos Bens e Serviços Vendidos' },
  { code: '3.2.1.01.03', name: 'Custo dos Serviços Prestados', kind: 'EXPENSE', group: 'Custos dos Bens e Serviços Vendidos' },

  // 3.3.1.01 — Despesas com Pessoal (Vendas)
  { code: '3.3.1.01.01', name: 'Salários (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.02', name: 'Gratificações (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.03', name: 'Férias (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.04', name: '13º Salário (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.05', name: 'INSS (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.06', name: 'FGTS (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.07', name: 'Vale Refeição/Refeitório (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.08', name: 'Vale Transporte (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.09', name: 'Assistência Médica (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.10', name: 'Seguro de Vida (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.01.11', name: 'Treinamento (Vendas)', kind: 'EXPENSE', group: 'Despesas com Vendas — Despesas com Pessoal' },
  { code: '3.3.1.02.01', name: 'Comissões sobre Vendas', kind: 'EXPENSE', group: 'Despesas com Vendas — Outras Despesas com Vendas' },
  { code: '3.3.1.02.02', name: 'Propaganda e Publicidade', kind: 'EXPENSE', group: 'Despesas com Vendas — Outras Despesas com Vendas' },
  { code: '3.3.1.02.03', name: 'Brindes e Material Promocional', kind: 'EXPENSE', group: 'Despesas com Vendas — Outras Despesas com Vendas' },

  // 3.3.2.01 — Despesas com Pessoal (Administrativo)
  { code: '3.3.2.01.01', name: 'Salários', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.02', name: 'Gratificações', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.03', name: 'Férias', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.04', name: '13º Salário', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.05', name: 'INSS', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.06', name: 'FGTS', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.07', name: 'Vale Refeição/Refeitório', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.08', name: 'Vale Transporte', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.09', name: 'Assistência Médica', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.10', name: 'Seguro de Vida', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.11', name: 'Treinamento', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },
  { code: '3.3.2.01.12', name: 'Pró-labore', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas com Pessoal' },

  // 3.3.2.02 — Despesas Gerais
  { code: '3.3.2.02.01', name: 'Aluguéis e Arrendamentos', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.02', name: 'Condomínios e Estacionamentos', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.03', name: 'Despesas com Veículos', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.04', name: 'Depreciação', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.05', name: 'Amortização', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.06', name: 'Serviços Profissionais Contratados', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.07', name: 'Energia', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.08', name: 'Água e Esgoto', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.09', name: 'Telefone e Internet', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.10', name: 'Correios e Malotes', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.11', name: 'Seguros', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.12', name: 'Multas', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.13', name: 'Bens de Pequeno Valor', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  { code: '3.3.2.02.14', name: 'Material de Escritório', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },
  // Assinaturas/software não constava no Anexo 7 original (norma de 2012/2022,
  // pré-SaaS) — adicionado porque é um custo real e recorrente do Hub e de
  // qualquer empresa de serviços digital hoje.
  { code: '3.3.2.02.15', name: 'Softwares e Assinaturas (SaaS)', kind: 'EXPENSE', group: 'Despesas Administrativas — Despesas Gerais' },

  // 3.3.2.03 — Tributos e Contribuições
  { code: '3.3.2.03.01', name: 'Taxas e Tributos Municipais', kind: 'EXPENSE', group: 'Despesas Administrativas — Tributos e Contribuições' },
  { code: '3.3.2.03.02', name: 'PIS s/ Outras Receitas', kind: 'EXPENSE', group: 'Despesas Administrativas — Tributos e Contribuições' },
  { code: '3.3.2.03.03', name: 'COFINS s/ Outras Receitas', kind: 'EXPENSE', group: 'Despesas Administrativas — Tributos e Contribuições' },

  // 3.3.9 — Outros Resultados Operacionais
  { code: '3.3.9.01.01', name: 'Receita na Venda de Imobilizado', kind: 'INCOME', group: 'Outros Resultados Operacionais — Ganhos e Perdas de Capital' },
  { code: '3.3.9.01.02', name: 'Custo do Imobilizado Baixado', kind: 'EXPENSE', group: 'Outros Resultados Operacionais — Ganhos e Perdas de Capital' },
  { code: '3.3.9.02.01', name: 'PECLD (Perdas com Clientes)', kind: 'EXPENSE', group: 'Outros Resultados Operacionais — Perdas' },
  { code: '3.3.9.02.02', name: 'Perda de Recuperabilidade (Impairment)', kind: 'EXPENSE', group: 'Outros Resultados Operacionais — Perdas' },
  { code: '3.3.9.03.01', name: 'Resultado Positivo de Equivalência Patrimonial', kind: 'INCOME', group: 'Outros Resultados Operacionais — Participação em Outras Sociedades' },
  { code: '3.3.9.03.02', name: 'Resultado Negativo de Equivalência Patrimonial', kind: 'EXPENSE', group: 'Outros Resultados Operacionais — Participação em Outras Sociedades' },

  // 3.4 — Resultado Financeiro
  { code: '3.4.1.01.01', name: 'Juros Passivos', kind: 'EXPENSE', group: 'Resultado Financeiro — Despesas Financeiras' },
  { code: '3.4.1.01.02', name: 'Despesas Bancárias', kind: 'EXPENSE', group: 'Resultado Financeiro — Despesas Financeiras' },
  { code: '3.4.1.01.03', name: 'IOF', kind: 'EXPENSE', group: 'Resultado Financeiro — Despesas Financeiras' },
  { code: '3.4.1.01.04', name: 'Descontos Concedidos', kind: 'EXPENSE', group: 'Resultado Financeiro — Despesas Financeiras' },
  { code: '3.4.1.01.05', name: 'Variação Cambial Passiva', kind: 'EXPENSE', group: 'Resultado Financeiro — Despesas Financeiras' },
  { code: '3.4.1.02.01', name: 'Rendimentos de Aplicação Financeira', kind: 'INCOME', group: 'Resultado Financeiro — Receitas Financeiras' },
  { code: '3.4.1.02.02', name: 'Juros Ativos', kind: 'INCOME', group: 'Resultado Financeiro — Receitas Financeiras' },
  { code: '3.4.1.02.03', name: 'Descontos Obtidos', kind: 'INCOME', group: 'Resultado Financeiro — Receitas Financeiras' },
  { code: '3.4.1.02.04', name: 'Variação Cambial Ativa', kind: 'INCOME', group: 'Resultado Financeiro — Receitas Financeiras' },

  // 3.8 — Provisão de Impostos sobre o Lucro
  { code: '3.8.1.01.01', name: 'IRPJ Corrente', kind: 'EXPENSE', group: 'Provisão de Impostos — Tributos sobre o Lucro' },
  { code: '3.8.1.01.02', name: 'CSLL Corrente', kind: 'EXPENSE', group: 'Provisão de Impostos — Tributos sobre o Lucro' },
  { code: '3.8.1.01.03', name: 'IRPJ Diferido', kind: 'EXPENSE', group: 'Provisão de Impostos — Tributos sobre o Lucro' },
  { code: '3.8.1.01.04', name: 'CSLL Diferido', kind: 'EXPENSE', group: 'Provisão de Impostos — Tributos sobre o Lucro' },
];

async function seedCategories(companyId: string) {
  const db = getDb();
  console.log(`Semeando ${CATEGORIES.length} categorias (Anexo 7 ITG 1000) pra empresa ${companyId}...`);

  let created = 0;
  let skipped = 0;
  for (const c of CATEGORIES) {
    const [existing] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.companyId, companyId), eq(category.accountingCode, c.code)));
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(category).values({
      companyId,
      name: c.name,
      kind: c.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
      accountingCode: c.code,
      accountingGroup: c.group,
    });
    created++;
  }
  console.log(`Concluído: ${created} categoria(s) criada(s), ${skipped} já existiam.`);
}

const companyId = process.argv[2];
if (!companyId) {
  console.error('Uso: npx tsx packages/db/src/seed-categories-anexo7.ts <companyId>');
  process.exit(1);
}
seedCategories(companyId).then(() => process.exit(0));
