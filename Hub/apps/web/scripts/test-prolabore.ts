import { ProlaboreAutopilotService } from '../../../packages/core/src/services/prolabore-autopilot.service';

const autopilot = new ProlaboreAutopilotService();

console.log('--- Teste 1: Empresa sem faturamento ---');
console.log(autopilot.calculateIdealProlabore({ rbt12: 0, payrollLast11Months: 0 }));

console.log('\n--- Teste 2: Empresa estourando, precisa de folha alta ---');
// Faturamento R$ 120.000 (RBT12), Folha atual R$ 10.000. 
// Alvo: 120000 * 0.2801 = 33612. Falta 23612 de folha!
console.log(autopilot.calculateIdealProlabore({ rbt12: 120000, payrollLast11Months: 10000 }));

console.log('\n--- Teste 3: Folha acumulada já é suficiente ---');
// RBT12 120k. Folha atual 50k. Já bateu os 28% de boa.
console.log(autopilot.calculateIdealProlabore({ rbt12: 120000, payrollLast11Months: 50000 }));
