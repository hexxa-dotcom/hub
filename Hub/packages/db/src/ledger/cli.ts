import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * CLI da escrituração — aplica a migration do razão e escritura o histórico.
 *
 *   npx tsx packages/db/src/ledger/cli.ts migrate
 *   npx tsx packages/db/src/ledger/cli.ts backfill <companyId|--todas>
 *   npx tsx packages/db/src/ledger/cli.ts balancete <companyId> [YYYY-MM]
 *
 * Lê `apps/web/.env.local` como os demais scripts deste pacote — o `.env` da
 * raiz do repositório está desatualizado e não deve ser usado.
 */

const envPath = path.resolve(process.cwd(), 'apps/web/.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#\s][^=]*)="?(.*?)"?$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { getDb } = await import('../client');
const {
  backfillCompany, companiesComMovimento, ensureChartOfAccounts,
  trialBalance, assertLedgerBalances, reapurarResultado, conferirBalanco,
} = await import('./index');

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

async function migrate() {
  const db = getDb();
  for (const nome of [
    '0049_ledger.sql',
    '0050_agent_trail.sql',
    // 0051 saiu daqui de propósito: a 0052 a substituiu, e reexecutá-la falha
    // contra o modelo novo. Ver o cabeçalho do próprio arquivo.
    '0052_estorno_nao_despublica.sql',
    '0053_operation_setting.sql',
    '0054_fechamento_dois_estagios.sql',
    '0055_oneflow_token.sql',
    '0056_nfse_para_oneflow.sql',
    '0057_oneflow_cota.sql',
    '0058_tax_history_origem.sql',
    '0059_envio_autorizado.sql',
  ]) {
    const sqlText = fs.readFileSync(path.resolve(process.cwd(), 'packages/db/migrations', nome), 'utf-8');
    // A migration inteira numa execução só: os triggers dependem das tabelas e
    // das funções criadas antes deles, então partir em statements avulsos
    // exigiria ordenar à mão o que o Postgres já ordena sozinho.
    await db.execute(sqlText as never);
    console.log(`✓ ${nome} aplicada.`);
  }
}

async function backfill(alvo: string) {
  const db = getDb();
  const ids =
    alvo === '--todas' ? await companiesComMovimento(db) : [alvo];

  console.log(`Escriturando ${ids.length} empresa(s)…\n`);

  for (const companyId of ids) {
    const r = await backfillCompany(db, companyId);
    console.log(`── ${companyId}`);
    console.log(`   plano de contas: ${r.planoDeContas.criadas} criadas de ${r.planoDeContas.total}`);
    for (const [doc, s] of Object.entries(r.porDocumento)) {
      console.log(
        `   ${doc.padEnd(22)} ${String(s.gravadas).padStart(5)} gravadas  ` +
          `${String(s.jaExistiam).padStart(5)} já existiam  ` +
          `${String(s.ignorados).padStart(4)} ignorados  ${String(s.erros).padStart(4)} erros`,
      );
    }

    // A conferência é o ponto do exercício: escriturar sem conferir seria
    // trocar uma soma não verificada por outra.
    const eq = await assertLedgerBalances(db, companyId, '2999-12-01');
    console.log(
      `   razão: débito ${BRL.format(eq.debit)} / crédito ${BRL.format(eq.credit)} → ` +
        (eq.ok ? '✓ fecha' : `✗ DIFERENÇA ${BRL.format(eq.diff)}`),
    );

    if (r.ignorados.length) {
      console.log(`   ${r.ignorados.length} documento(s) ignorado(s) por dado inválido na origem:`);
      for (const i of r.ignorados.slice(0, 5)) console.log(`     · ${i.documento}: ${i.motivo}`);
      if (r.ignorados.length > 5) console.log(`     … e mais ${r.ignorados.length - 5}`);
    }

    if (r.erros.length) {
      console.log(`   ${r.erros.length} documento(s) não escriturado(s):`);
      for (const e of r.erros.slice(0, 15)) console.log(`     · ${e.documento}: ${e.motivo}`);
      if (r.erros.length > 15) console.log(`     … e mais ${r.erros.length - 15}`);
    }
    console.log();
  }
}

async function balancete(companyId: string, mes?: string) {
  const db = getDb();
  await ensureChartOfAccounts(db, companyId);
  const ate = mes ? `${mes}-01` : '2999-12-01';
  const linhas = await trialBalance(db, companyId, ate);

  if (!linhas.length) {
    console.log('Nenhum lançamento escriturado para esta empresa.');
    return;
  }

  console.log('CÓDIGO          CONTA                                    DÉBITO        CRÉDITO         SALDO');
  for (const l of linhas) {
    console.log(
      l.code.padEnd(15) +
        l.name.slice(0, 38).padEnd(40) +
        BRL.format(l.debit).padStart(14) +
        BRL.format(l.credit).padStart(15) +
        BRL.format(l.balance).padStart(14),
    );
  }

  const eq = await assertLedgerBalances(db, companyId, ate);
  console.log(
    `\n${eq.ok ? '✓' : '✗'} débito ${BRL.format(eq.debit)} vs crédito ${BRL.format(eq.credit)}` +
      (eq.ok ? '' : ` — diferença ${BRL.format(eq.diff)}`),
  );
}

async function apurar(companyId: string, mes?: string) {
  const db = getDb();
  const ate = mes ? `${mes}-01` : new Date().toISOString().slice(0, 8) + '01';

  const antes = await conferirBalanco(db, companyId, ate);
  console.log('ANTES  ativo', BRL.format(antes.ativo), '| passivo', BRL.format(antes.passivo),
    '| PL', BRL.format(antes.pl), '| resultado ainda fora do PL', BRL.format(antes.resultado));

  const r = await reapurarResultado(db, companyId, ate, 'reapuração via CLI');
  if (r.jaApurado) console.log('Já havia apuração para o período.');
  else if (!r.journalEntryId) console.log('Nada a apurar: sem saldo em conta de resultado.');
  else {
    console.log(`\n${r.contasZeradas} conta(s) de resultado zeradas.`);
    console.log('Receita', BRL.format(r.receitaTotal), '| Despesa', BRL.format(r.despesaTotal),
      '|', r.resultado >= 0 ? 'Lucro' : 'Prejuízo', BRL.format(Math.abs(r.resultado)));
  }

  const dep = await conferirBalanco(db, companyId, ate);
  console.log('\nDEPOIS ativo', BRL.format(dep.ativo), '| passivo', BRL.format(dep.passivo),
    '| PL', BRL.format(dep.pl), '| resultado', BRL.format(dep.resultado));
  console.log(dep.fecha ? '✓ Ativo = Passivo + PL' : `✗ balanço não fecha: diferença ${BRL.format(dep.diff)}`);
}

/** Mão de volta: traz guias e folha do OneFlow e escritura o que chegou. */
async function retorno(companyId: string, competencia: string) {
  const db = getDb();
  const { importarDoOneflow, appHashPorCnpj } = await import('./index');

  const [emp] = (await db.execute(
    `SELECT cnpj, legal_name FROM company WHERE id = '${companyId}'` as never,
  )) as unknown as { cnpj: string; legal_name: string }[];
  if (!emp) { console.log('Empresa não encontrada.'); return; }

  const appHash = process.argv[5] ?? (await appHashPorCnpj(db, emp.cnpj, companyId));
  if (!appHash) {
    console.log(`${emp.legal_name} não está cadastrada no OneFlow (CNPJ ${emp.cnpj}).`);
    return;
  }

  const r = await importarDoOneflow(db, companyId, appHash, competencia);

  console.log(`── ${emp.legal_name} · competência ${competencia}\n`);
  console.log('GUIAS');
  if (!r.guias.length) console.log('   nenhuma apuração devolvida.');
  for (const g of r.guias) {
    const extra = g.valorAnterior !== undefined ? ` (era ${BRL.format(g.valorAnterior)})` : '';
    console.log(`   ${g.taxName.padEnd(12)} ${BRL.format(g.valor).padStart(14)}  ${g.acao}${extra}`);
  }

  console.log('\nFOLHA');
  if (!r.folha.length) console.log('   nenhuma folha nesta competência.');
  for (const f of r.folha) {
    console.log(`   ${f.tipoFolha.padEnd(20)} ${String(f.recibos).padStart(3)} recibo(s)  ${BRL.format(f.valorTotal).padStart(14)}`);
  }

  if (r.fatorR) {
    console.log('\nFATOR R');
    console.log('   ' + (r.fatorR.valor !== null ? String(r.fatorR.valor) : r.fatorR.mensagem ?? '—'));
  }

  console.log(`\n${r.escrituradas} partida(s) gravada(s) no razão.`);
  if (r.avisos.length) {
    console.log('\nAVISOS');
    for (const a of r.avisos) console.log('   · ' + a);
  }

  const eq = await assertLedgerBalances(db, companyId, '2999-12-01');
  console.log(
    `\nrazão: débito ${BRL.format(eq.debit)} / crédito ${BRL.format(eq.credit)} → ` +
      (eq.ok ? '✓ fecha' : `✗ DIFERENÇA ${BRL.format(eq.diff)}`),
  );
}

/**
 * Manda as notas da competência ao módulo fiscal do OneFlow.
 *
 * Sem argumento `--enviar`, só ENSAIA: mostra o que iria e o que está
 * bloqueado, sem falar com o OneFlow. É o modo que não gasta cota.
 */
async function notas(companyId: string, competencia: string, enviar: boolean) {
  const db = getDb();
  const { ensaiarEnvioNfse, enviarNfseParaOneflow, appHashPorCnpj } = await import('./index');

  const [emp] = (await db.execute(
    `SELECT cnpj, legal_name FROM company WHERE id = '${companyId}'` as never,
  )) as unknown as { cnpj: string; legal_name: string }[];
  if (!emp) { console.log('Empresa não encontrada.'); return; }

  const r = enviar
    ? await (async () => {
        const appHash = process.argv[6] ?? (await appHashPorCnpj(db, emp.cnpj, companyId));
        if (!appHash) throw new Error(`${emp.legal_name} não está no OneFlow.`);
        return enviarNfseParaOneflow(db, companyId, appHash, competencia);
      })()
    : await ensaiarEnvioNfse(db, companyId, competencia);

  console.log(`── ${emp.legal_name} · notas de ${competencia}${enviar ? '' : ' (ENSAIO — nada foi enviado)'}\n`);
  console.log(`prontas para enviar: ${r.prontas.length}`);
  for (const p of r.prontas) {
    console.log(`   nº ${p.nota.numeroDocumento} · ${BRL.format(p.nota.valorUnitario)} · ` +
      `LC116 ${p.nota.codigoLC116} · ${p.nota.razaoSocialParticipante}`);
  }
  console.log(`já enviadas antes: ${r.jaEnviadas}`);

  if (r.jaNoOneflow.length) {
    console.log(`já no OneFlow (busca automática dele): ${r.jaNoOneflow.length}`);
    for (const j of r.jaNoOneflow) console.log(`   · nº ${j.numero}`);
  } else if (!enviar) {
    console.log('(ensaio sem conferência: não perguntei ao OneFlow o que já está lá)');
  }

  if (r.bloqueadas.length) {
    console.log(`\nbloqueadas: ${r.bloqueadas.length}`);
    for (const b of r.bloqueadas) console.log(`   · nº ${b.numero ?? '—'}: ${b.motivo}`);
  }

  if (enviar) {
    const res = r as Awaited<ReturnType<typeof enviarNfseParaOneflow>>;
    console.log(`\nenviadas agora: ${res.enviadas}`);
    if (res.erros.length) {
      console.log(`erros: ${res.erros.length}`);
      for (const e of res.erros.slice(0, 5)) console.log(`   · ${e.motivo}`);
    }
  }
}

const [cmd, arg1, arg2] = process.argv.slice(2);

try {
  if (cmd === 'migrate') await migrate();
  else if (cmd === 'backfill' && arg1) await backfill(arg1);
  else if (cmd === 'balancete' && arg1) await balancete(arg1, arg2);
  else if (cmd === 'apurar' && arg1) await apurar(arg1, arg2);
  else if (cmd === 'retorno' && arg1 && arg2) await retorno(arg1, arg2);
  else if (cmd === 'notas' && arg1 && arg2) await notas(arg1, arg2, process.argv.includes('--enviar'));
  else {
    console.log('Uso:');
    console.log('  npx tsx packages/db/src/ledger/cli.ts migrate');
    console.log('  npx tsx packages/db/src/ledger/cli.ts backfill <companyId|--todas>');
    console.log('  npx tsx packages/db/src/ledger/cli.ts balancete <companyId> [YYYY-MM]');
    console.log('  npx tsx packages/db/src/ledger/cli.ts apurar    <companyId> [YYYY-MM]');
    console.log('  npx tsx packages/db/src/ledger/cli.ts retorno   <companyId> <AAAAMM>');
    console.log('  npx tsx packages/db/src/ledger/cli.ts notas     <companyId> <AAAAMM> [--enviar]');
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.error('Falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
}
