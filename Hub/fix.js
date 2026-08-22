const fs = require('fs');

const filesToFixIntegration = [
  'apps/web/src/app/(portal)/configuracoes/integracoes/omie/page.tsx',
  'apps/web/src/app/(portal)/configuracoes/integracoes/nibo/page.tsx',
  'apps/web/src/app/(portal)/configuracoes/integracoes/asaas/actions.ts',
  'apps/web/src/app/(portal)/configuracoes/integracoes/asaas/billing.ts',
  'apps/web/src/app/(portal)/configuracoes/integracoes/asaas/page.tsx',
  'apps/web/src/app/(portal)/configuracoes/integracoes/bling/page.tsx',
  'apps/web/src/app/(portal)/configuracoes/integracoes/page.tsx',
  'apps/web/src/app/(portal)/configuracoes/integracoes/contaazul/page.tsx',
  'apps/web/src/app/api/integrations/omie/setup/route.ts',
  'apps/web/src/app/api/integrations/nibo/setup/route.ts',
  'apps/web/src/app/api/integrations/bling/setup/route.ts',
  'apps/web/src/app/api/integrations/bling/authorize/route.ts',
  'apps/web/src/app/api/integrations/bling/callback/route.ts',
  'apps/web/src/app/api/integrations/contaazul/setup/route.ts',
  'apps/web/src/app/api/integrations/contaazul/authorize/route.ts',
  'apps/web/src/app/api/integrations/contaazul/callback/route.ts'
];

for (const file of filesToFixIntegration) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      "import { getDb, integrationCredential, eq, and } from '@hexxa/db';",
      "import { getDb, eq, and } from '@hexxa/db';\nimport { integrationCredential } from '@hexxa/db/schema';"
    );
    fs.writeFileSync(file, content, 'utf8');
  }
}

// Fix monthlyClosure
const monthly1 = 'apps/web/src/app/(portal)/meu-negocio/relatorios/fechamento/page.tsx';
if (fs.existsSync(monthly1)) {
  let content = fs.readFileSync(monthly1, 'utf8');
  content = content.replace(
    "import { getDb, monthlyClosure, eq, desc } from '@hexxa/db';",
    "import { getDb, eq, desc } from '@hexxa/db';\nimport { monthlyClosure } from '@hexxa/db/schema';"
  );
  fs.writeFileSync(monthly1, content, 'utf8');
}

const monthly2 = 'apps/web/src/app/(admin)/admin/fechamentos/page.tsx';
if (fs.existsSync(monthly2)) {
  let content = fs.readFileSync(monthly2, 'utf8');
  content = content.replace(
    "import { getDb, monthlyClosure, company, desc, eq } from '@hexxa/db';",
    "import { getDb, desc, eq } from '@hexxa/db';\nimport { monthlyClosure, company } from '@hexxa/db/schema';"
  );
  // also fix company.name
  content = content.replace(/company\.name/g, 'company.legalName'); // we will check legalName vs brandName later
  fs.writeFileSync(monthly2, content, 'utf8');
}

// Fix meu-plano
const plano = 'apps/web/src/app/(portal)/meu-plano/page.tsx';
if (fs.existsSync(plano)) {
  let content = fs.readFileSync(plano, 'utf8');
  content = content.replace(/plan\.monthly_value/g, 'plan.monthlyValue');
  fs.writeFileSync(plano, content, 'utf8');
}

console.log('Fixed imports');
