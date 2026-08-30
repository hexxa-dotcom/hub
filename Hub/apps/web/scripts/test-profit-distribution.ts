
import * as fs from 'fs';
// Manual dotenv parsing to avoid module loading issues in scripts
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY ausente em apps/web/.env.local');
  process.exit(1);
}

import { AIOnboardingService } from '../src/lib/server/ai-onboarding';
import { ProfitDistributionService } from '../../../packages/core/src/services/profit-distribution.service';
import type { ProfitDistributionRequest } from '../../../packages/core/src/services/profit-distribution.service';

async function runTests() {
  console.log('--- Iniciando Teste do Módulo de Distribuição de Lucros & AI Onboarding ---\n');

  // ==========================================
  // FASE 1: AI Onboarding
  // ==========================================
  console.log('Fase 1: AI Onboarding Lendo PDFs (Texto)...');
  const onboardingService = new AIOnboardingService();

  const mockContratoSocial = `
    CONTRATO SOCIAL DA HEXX SERVIÇOS DE TECNOLOGIA LTDA
    CNPJ: 12.345.678/0001-90
    Sócio 1: João Silva (CPF: 111.222.333-44) - 90% das quotas
    Sócio 2: Maria Souza (CPF: 555.666.777-88) - 10% das quotas
    Capital Social Total: R$ 100.000,00
    Condição: Do capital social, R$ 80.000,00 já estão integralizados, e R$ 20.000,00 serão integralizados futuramente pela sócia Maria.
    Cláusula Nona: Fica expressamente autorizada a distribuição desproporcional de lucros, não precisando respeitar a proporção de quotas.
  `;

  const mockBalanco = `
    BALANÇO PATRIMONIAL - EXERCÍCIO 2025
    Ativo Circulante: R$ 500.000,00
    Direitos a Receber (Mútuos de Sócios): R$ 35.000,00
    Passivo Circulante: R$ 50.000,00
    Patrimônio Líquido:
      Capital Social: R$ 100.000,00
      Capital a Integralizar: (R$ 20.000,00)
      Prejuízos Acumulados: (R$ 15.000,00)
    Lucro do Exercício (DRE): R$ 120.000,00
  `;

  const extractedData = await onboardingService.extractCompanyData(mockContratoSocial, mockBalanco);
  console.log('✅ Dados Extraídos pela IA:');
  console.log(JSON.stringify(extractedData, null, 2));

  // ==========================================
  // FASE 2: Validação das Travas de Segurança
  // ==========================================
  console.log('\nFase 2: Motor de Lucros processando pedido de saque...');
  const profitService = new ProfitDistributionService();

  const partnerJoao = extractedData.partners.find(p => p.name.includes('João'));

  const request: ProfitDistributionRequest = {
    companyId: 'uuid-company',
    partnerId: 'uuid-joao',
    requestedAmount: 50000, // João quer sacar 50k
    companyContext: {
      hasOverdueTaxes: false, // Simula que está em dia
      unpaidShareCapital: extractedData.unpaidSocialCapital,
      allowsDisproportionateDistribution: extractedData.allowsDisproportionateDistribution,
    },
    partnerContext: {
      sharePercentage: partnerJoao?.sharePercentage || 50,
      activeMutualContractsBalance: extractedData.activeMutualContractsBalance,
    },
    accountingContext: {
      accumulatedProfit: 120000, // Lucro lido no balanço
      accumulatedLosses: extractedData.accumulatedLosses,
      totalProfitDistributedThisYearToPartner: 0,
      totalProfitDistributedThisYearGlobally: 0,
    }
  };

  const result = profitService.evaluateDistribution(request);
  
  console.log('\n--- LAUDO DE DISTRIBUIÇÃO ---');
  console.log(`Status Final: ${result.isApproved ? '✅ APROVADO' : '❌ BLOQUEADO / PARCIALMENTE BLOQUEADO'}`);
  console.log(`Valor Solicitado: R$ ${request.requestedAmount}`);
  console.log(`Valor Aprovado Isento: R$ ${result.approvedAmount}`);
  console.log(`Valor Retido/Bloqueado: R$ ${result.blockedAmount}\n`);

  console.log('Logs das Travas:');
  for (const [lockName, lockData] of Object.entries(result.locks)) {
    if (lockData.message) {
      console.log(`- [${lockName}] ${lockData.message}`);
    }
  }

}

runTests().catch(err => console.error(err));
