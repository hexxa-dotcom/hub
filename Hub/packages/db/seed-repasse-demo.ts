import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});

import { getDb } from './src/index';
import { businessContract } from './src/schema/service-ops';
import { financialEntry } from './src/schema/finance';
import { integrationCredential } from './src/schema/platform';
import { eq, and, like } from 'drizzle-orm';

/**
 * Injeta dados de demonstração pro fluxo de repasse via integração SaaS
 * (webhook-repasse) — 3 médicos com contrato ATIVO + lançamentos do mês
 * corrente simulando eventos já processados pelo webhook, pra visualizar a
 * aba "Repasses" em Meu Negócio > Contratos sem precisar de um SaaS real.
 * Rodar com: npx tsx packages/db/seed-repasse-demo.ts
 */

const COMPANY_ID = 'ad35fdf7-3e07-4ad1-9d5d-ffe1c0356109'; // Vortex Studio (mesma empresa do seed-fictitious-company.ts)

const hoje = new Date();
const refMonth = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
const dia = (d: number) => `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const MEDICOS = [
  { nome: 'Dra. Camila Ferraz', externalId: 'medico-demo-001', repasse: 70, eventos: [4200, 3800, 5100] },
  { nome: 'Dr. Henrique Nogueira', externalId: 'medico-demo-002', repasse: 65, eventos: [6300, 2900] },
  { nome: 'Dra. Beatriz Lemos', externalId: 'medico-demo-003', repasse: 75, eventos: [1800, 2200, 1500, 3000] },
];

async function main() {
  const db = getDb();
  console.log('🚀 Seed de demonstração — repasse via integração SaaS\n');

  // Credencial fake da integração (só pra sourceId da receita da empresa fazer sentido).
  let [cred] = await db.select().from(integrationCredential).where(and(eq(integrationCredential.companyId, COMPANY_ID), eq(integrationCredential.provider, 'webhook-repasse')));
  if (!cred) {
    [cred] = await db.insert(integrationCredential).values({
      companyId: COMPANY_ID,
      provider: 'webhook-repasse',
      kind: 'REVENUE_SAAS',
      secretRef: { demo: true },
      active: true,
    }).returning();
    console.log('✓ Credencial de integração criada (demo)');
  }

  // Idempotência: limpa lançamentos e contratos de uma rodada anterior deste seed antes de recriar.
  await db.delete(financialEntry).where(and(eq(financialEntry.companyId, COMPANY_ID), eq(financialEntry.source, 'INTEGRATION_SAAS'), like(financialEntry.externalId, 'demo-evt-%')));

  let eventCounter = 1;
  for (const medico of MEDICOS) {
    await db.delete(businessContract).where(and(eq(businessContract.companyId, COMPANY_ID), eq(businessContract.externalProviderId, medico.externalId)));

    const [contrato] = await db.insert(businessContract).values({
      companyId: COMPANY_ID,
      type: 'SAIDA',
      title: `Prestação de Serviço Médico — ${medico.nome}`,
      partyName: medico.nome,
      partyCnpj: null,
      value: '0',
      dueDay: 10,
      startDate: dia(1),
      endDate: `${hoje.getFullYear() + 1}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
      signingDate: dia(1),
      status: 'ATIVO',
      externalProviderId: medico.externalId,
      repassePercent: String(medico.repasse),
    }).returning();
    console.log(`✓ Contrato criado: ${medico.nome} (${medico.repasse}% de repasse)`);

    for (const valorBruto of medico.eventos) {
      const valorRepasse = valorBruto * (medico.repasse / 100);
      const diaEvento = 3 + eventCounter * 2;
      const externalId = `demo-evt-${eventCounter}`;

      await db.insert(financialEntry).values({
        companyId: COMPANY_ID,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: `Faturamento via integração — ${medico.nome}`,
        amount: String(valorBruto),
        dueDate: dia(diaEvento),
        referenceMonth: refMonth,
        source: 'INTEGRATION_SAAS',
        sourceId: cred!.id,
        externalId,
        paidAt: dia(diaEvento),
      });

      await db.insert(financialEntry).values({
        companyId: COMPANY_ID,
        type: 'PAYABLE',
        status: eventCounter % 3 === 0 ? 'PAID' : 'PENDING',
        description: `Repasse — ${medico.nome} (${medico.repasse}%)`,
        amount: String(valorRepasse.toFixed(2)),
        dueDate: dia(diaEvento),
        referenceMonth: refMonth,
        source: 'INTEGRATION_SAAS',
        sourceId: contrato!.id,
        externalId: `${externalId}:repasse`,
        paidAt: eventCounter % 3 === 0 ? dia(diaEvento) : null,
      });

      eventCounter++;
    }
  }

  console.log('\n✅ Seed concluído — abra Meu Negócio > Contratos > aba "Repasses (Integração SaaS)"');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
