import { TaxEngineService } from '../../../packages/core/src/services/tax-engine.service';
import type { TaxCalculationTrace } from '../../../packages/core/src/services/tax-engine.service';
import * as fs from 'fs';

async function run() {
  const envContent = fs.readFileSync('./apps/web/.env.local', 'utf-8');
  const geminiMatch = envContent.match(/GEMINI_API_KEY="([^"]+)"/);
  const apiKey = geminiMatch ? geminiMatch[1] : null;
  if (!apiKey) {
    throw new Error('Sem chave do Gemini no .env.local');
  }

  // 1. Simular um Trace Fictício de Fator R (Exemplo: 26%)
  const mockTrace: TaxCalculationTrace = {
    ruleId: 'simples_nacional_2024',
    regime: 'SIMPLES_NACIONAL',
    annex: 'V', // Porque o Fator R é 26% (menor que 28%)
    bracket: 2,
    inputs: {
      rba12: 250000,
      payroll12: 65000,
      currentRevenue: 20000
    },
    intermediateSteps: {
      fatorR: 0.26,
      nominalRateUsed: 18,
      deductionUsed: 4500
    },
    effectiveRate: 0.162, // 16.2%
    taxAmount: 3240,
    timestamp: new Date().toISOString()
  };

  // 2. Simular o Contexto da Nota
  const invoiceContext = {
    description: 'Serviços de desenvolvimento de software sob encomenda',
    expectedCnae: '6201-5/01 (Desenvolvimento de programas de computador sob encomenda)'
  };

  console.log('--- Iniciando Auditoria Cognitiva do Motor Tributário Hexx ---');
  console.log('Analisando Nota:', invoiceContext.description);
  console.log('Trace Matemático Acoplado:', mockTrace.effectiveRate * 100, '% no Anexo', mockTrace.annex);

  const result = await TaxEngineService.evaluateCognitiveRisk(apiKey, mockTrace, invoiceContext);
  
  console.log('\n--- RESULTADO DA AUDITORIA ---');
  console.log('Status Fiscal:', result.status === 'RISK_DETECTED' ? '🚨 RISCO DETECTADO' : '✅ APROVADO');
  console.log('Laudo da IA:', result.explanation);
}

run().catch(console.error);
