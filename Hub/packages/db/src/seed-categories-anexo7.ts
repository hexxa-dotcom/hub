import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
import { getDb } from './index';
import { garantirCategoriasPadrao, CATEGORIAS_PADRAO } from './ledger/categorias-padrao';

/**
 * Semeia as categorias do Anexo 7 da ITG 1000 numa empresa (a lista mora em
 * `ledger/categorias-padrao.ts`; a identificação do extrato já faz isso
 * sozinha quando falta).
 *
 * Executar: npx tsx packages/db/src/seed-categories-anexo7.ts <companyId>
 */
const companyId = process.argv[2];
if (!companyId) {
  console.error('Uso: npx tsx packages/db/src/seed-categories-anexo7.ts <companyId>');
  process.exit(1);
}
garantirCategoriasPadrao(getDb(), companyId).then((n) => {
  console.log(`Concluído: ${n} criada(s), ${CATEGORIAS_PADRAO.length - n} já existiam.`);
  process.exit(0);
});
