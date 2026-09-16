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
import { company } from './src/schema/tenancy';
import { eq, and, like } from 'drizzle-orm';

const COMPANY_ID = 'ad35fdf7-3e07-4ad1-9d5d-ffe1c0356109'; 

const hoje = new Date();
const refMonth = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
const dia = (d: number) => `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const MEDICOS = [
  { nome: 'Dra. Camila Ferraz', externalId: 'zap-med-001', repasse: 70, eventos: [4200, 3800, 5100, 2500] },
  { nome: 'Dr. Henrique Nogueira', externalId: 'zap-med-002', repasse: 65, eventos: [6300, 2900, 4100] },
  { nome: 'Dra. Beatriz Lemos', externalId: 'zap-med-003', repasse: 75, eventos: [1800, 2200, 1500, 3000, 4500] },
  { nome: 'Dr. Lucas Mendes', externalId: 'zap-med-004', repasse: 60, eventos: [5000, 7200] },
  { nome: 'Dra. Juliana Costa', externalId: 'zap-med-005', repasse: 70, eventos: [3300, 4000, 2800] },
  { nome: 'Dr. Thiago Silveira', externalId: 'zap-med-006', repasse: 80, eventos: [8000, 9500] },
];

const EMPRESAS = [
  { nome: 'Hospital São João', valor: 25000, dia: 5 },
  { nome: 'Clínica Santa Maria', valor: 12500, dia: 15 },
  { nome: 'Plano de Saúde Vida', valor: 45000, dia: 20 },
];

async function main() {
  const db = getDb();
  console.log('🚀 Seed Zap Vida — Contratos e Repasses\n');

  // 1. Atualizar nome da empresa
  await db.update(company)
    .set({ legalName: 'Zap Vida Telemedicina LTDA', tradeName: 'Zap Vida', useTradeName: true })
    .where(eq(company.id, COMPANY_ID));
  console.log('✓ Empresa atualizada para Zap Vida');

  // 2. Credencial fake da integração
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

  // 3. Limpar dados anteriores do zap-vida
  await db.delete(financialEntry).where(and(eq(financialEntry.companyId, COMPANY_ID), like(financialEntry.externalId, 'zap-%')));
  await db.delete(businessContract).where(and(eq(businessContract.companyId, COMPANY_ID), like(businessContract.externalProviderId, 'zap-%')));

  // 4. Inserir Contratos com Empresas (Entrada / Prestação de Serviço)
  let eventCounter = 1;
  for (const emp of EMPRESAS) {
    const externalId = `zap-emp-${eventCounter}`;
    const [contrato] = await db.insert(businessContract).values({
      companyId: COMPANY_ID,
      type: 'ENTRADA',
      title: `Prestação de Serviços — ${emp.nome}`,
      partyName: emp.nome,
      partyCnpj: null,
      value: String(emp.valor),
      dueDay: emp.dia,
      startDate: dia(1),
      endDate: `${hoje.getFullYear() + 2}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
      signingDate: dia(1),
      status: 'ATIVO',
      externalProviderId: externalId,
    }).returning();
    console.log(`✓ Contrato Empresa criado: ${emp.nome} (R$ ${emp.valor})`);

    await db.insert(financialEntry).values({
        companyId: COMPANY_ID,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: `Mensalidade — ${emp.nome}`,
        amount: String(emp.valor),
        dueDate: dia(emp.dia),
        referenceMonth: refMonth,
        source: 'CONTRACT',
        sourceId: contrato!.id,
        externalId: `${externalId}-fin-${eventCounter}`,
        paidAt: dia(emp.dia),
      });
      eventCounter++;
  }

  // 5. Inserir Contratos com Médicos (Saída / Repasse)
  for (const medico of MEDICOS) {
    const [contrato] = await db.insert(businessContract).values({
      companyId: COMPANY_ID,
      type: 'SAIDA',
      title: `Credenciamento Médico — ${medico.nome}`,
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
    console.log(`✓ Contrato Médico criado: ${medico.nome} (${medico.repasse}% de repasse)`);

    for (const valorBruto of medico.eventos) {
      const valorRepasse = valorBruto * (medico.repasse / 100);
      const diaEvento = (eventCounter % 28) + 1; 
      const externalId = `zap-evt-${eventCounter}`;

      await db.insert(financialEntry).values({
        companyId: COMPANY_ID,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: `Consulta/Procedimento — ${medico.nome}`,
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
        status: eventCounter % 2 === 0 ? 'PAID' : 'PENDING',
        description: `Repasse — ${medico.nome} (${medico.repasse}%)`,
        amount: String(valorRepasse.toFixed(2)),
        dueDate: dia(diaEvento + 2 > 28 ? 28 : diaEvento + 2),
        referenceMonth: refMonth,
        source: 'INTEGRATION_SAAS',
        sourceId: contrato!.id,
        externalId: `${externalId}:repasse`,
        paidAt: eventCounter % 2 === 0 ? dia(diaEvento + 2 > 28 ? 28 : diaEvento + 2) : null,
      });

      eventCounter++;
    }
  }

  console.log('\n✅ Dados do Zap Vida inseridos com sucesso!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
