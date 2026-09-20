import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { clienteOneflow, appHashPorCnpj } from './oneflow-client';
import { ensureChartOfAccounts } from './repository';

/**
 * CADASTRO DE CLIENTE A PARTIR DO ONEFLOW.
 *
 * ── Por que o cadastro começa do lado de lá ─────────────────────────────
 *
 * Hoje o fluxo é invertido: o cliente se cadastra sozinho e o contador
 * autoriza depois — a mensagem de erro do sistema chega a dizer "peça para o
 * cliente fazer o cadastro inicial primeiro". Isso põe no cliente, que é
 * leigo, o trabalho de digitar razão social, endereço, inscrição municipal e
 * quadro societário; e põe no contador a espera.
 *
 * Mas esses dados já existem, conferidos, no OneFlow: `dadosbasicos` traz
 * cadastro e endereço, `quadrosocietario` traz sócio, CPF e percentual. O
 * cadastro mais intuitivo, então, não é um formulário melhor — é não ter
 * formulário: o contador escolhe a empresa numa lista e o resto se preenche.
 *
 * Ao cliente sobra o que só ele sabe, que é quase nada.
 */

export interface EmpresaDisponivel {
  appHash: string;
  cnpj: string;
  razaoSocial: string;
  /** Já existe no Hub? A lista mostra as duas coisas, para o contador se situar. */
  jaCadastrada: boolean;
}

/**
 * Empresas do escritório no OneFlow, marcando quais já vieram para o Hub.
 *
 * Custa uma chamada por página de listagem — barato, e é a tela inteira.
 */
export async function empresasDoEscritorio(tx: DbHandle): Promise<EmpresaDisponivel[]> {
  const of = clienteOneflow(tx);
  const so = (v: string) => v.replace(/\D/g, '');

  const existentes = (await tx.execute(sql`
    SELECT regexp_replace(cnpj, '\\D', '', 'g') AS cnpj FROM company
  `)) as unknown as { cnpj: string }[];
  const jaTem = new Set(existentes.map((e) => e.cnpj));

  const out: EmpresaDisponivel[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const lote = await of.listarEmpresas(pagina);
    if (!lote.length) break;
    for (const e of lote) {
      // Filiais têm cadastro próprio lá, mas contabilidade da matriz. Trazer
      // as duas criaria duas empresas no Hub para um CNPJ raiz só.
      if (/^\[?filial/i.test(e.razaoSocial)) continue;
      out.push({
        appHash: e.appHash,
        cnpj: e.cnpj,
        razaoSocial: e.razaoSocial.replace(/^\[MATRIZ\]\s*/i, '').trim(),
        jaCadastrada: jaTem.has(so(e.cnpj)),
      });
    }
  }
  return out.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
}

export interface ResultadoCadastro {
  companyId: string;
  criada: boolean;
  razaoSocial: string;
  socios: number;
  contasDoPlano: number;
  /** Módulos ativos lá, que decidem o que ligar aqui. */
  modulos: string[];
  avisos: string[];
}

/**
 * Cria (ou completa) a empresa no Hub com os dados do OneFlow.
 *
 * Idempotente: rodar de novo atualiza o cadastro e não duplica sócio nem
 * conta do plano. É o que permite usar a mesma tela para corrigir um cadastro
 * desatualizado, em vez de precisar de uma segunda tela para isso.
 */
export async function cadastrarDoOneflow(
  tx: DbHandle,
  appHash: string,
  cnpjDaLista: string,
): Promise<ResultadoCadastro> {
  const of = clienteOneflow(tx);
  const avisos: string[] = [];

  const so = (v: string) => v.replace(/\D/g, '');
  const cnpjNu = so(cnpjDaLista);

  // A empresa pode já existir (cadastro do cliente, ou execução anterior).
  const [existente] = (await tx.execute(sql`
    SELECT id::text FROM company WHERE regexp_replace(cnpj, '\\D', '', 'g') = ${cnpjNu}
  `)) as unknown as { id: string }[];

  /**
   * O token é pedido pela chave do Hub, mas a empresa pode não ter id ainda.
   * Usar o appHash como chave provisória e renomear depois evita uma ordem
   * impossível — precisar do id para buscar os dados que criam o id.
   */
  const chave = existente?.id ?? appHash;
  const dados = (await of.dadosBasicosDaEmpresa(chave, appHash)) as Record<string, unknown>;

  const texto = (k: string) => String(dados[k] ?? '').trim();
  /**
   * `razao` da listagem traz o NOME FANTASIA — foi assim que a primeira
   * empresa entrou com o nome errado. A razão social de verdade vem do
   * cadastro; o fantasia, do campo `fantasia`.
   */
  const razao = texto('razaoSocial') || texto('razao') || cnpjDaLista;
  const fantasia = texto('fantasia');

  /**
   * Regime tributário: o de lá prevalece.
   *
   * Era gravado fixo como Simples Nacional para todo cliente — um Lucro
   * Presumido entraria no Hub com a régua de imposto errada, e nada acusaria.
   * O `dadosbasicos` traz `regimeTributario` por extenso; MEI é Simples.
   * Regime que não reconhecemos não vira palpite: a empresa entra, e o aviso
   * manda conferir.
   */
  const regimeLa = texto('regimeTributario');
  const regime = regimeDoOneflow(regimeLa);
  if (!regime) {
    avisos.push(
      regimeLa
        ? `Regime "${regimeLa}" do OneFlow não reconhecido — confira o regime na ficha do cliente.`
        : 'O OneFlow não informou o regime tributário — confira na ficha do cliente.',
    );
  }

  const cnpjFormatado = texto('cnpj') || cnpjDaLista;
  const campos = {
    legal_name: razao,
    trade_name: fantasia || null,
    cnpj: cnpjFormatado,
    address_line1: texto('endereco') || null,
    address_number: texto('numero') || null,
    neighborhood: texto('bairro') || null,
    city: texto('cidade') || null,
    state: texto('estado') || null,
    zipcode: texto('cep') || null,
    municipal_registration: texto('inscricaoMunicipal') || null,
  };

  let companyId: string;
  let criada = false;

  if (existente) {
    companyId = existente.id;
    await tx.execute(sql`
      UPDATE company SET
        legal_name = ${campos.legal_name},
        trade_name = COALESCE(${campos.trade_name}, trade_name),
        address_line1 = COALESCE(${campos.address_line1}, address_line1),
        address_number = COALESCE(${campos.address_number}, address_number),
        neighborhood = COALESCE(${campos.neighborhood}, neighborhood),
        city = COALESCE(${campos.city}, city),
        state = COALESCE(${campos.state}, state),
        zipcode = COALESCE(${campos.zipcode}, zipcode),
        municipal_registration = COALESCE(${campos.municipal_registration}, municipal_registration),
        tax_regime = COALESCE(${regime}::tax_regime, tax_regime)
      WHERE id = ${companyId}
    `);
  } else {
    const [nova] = (await tx.execute(sql`
      INSERT INTO company (legal_name, trade_name, cnpj, type, tax_regime,
                           address_line1, address_number, neighborhood, city, state,
                           zipcode, municipal_registration)
      VALUES (${campos.legal_name}, ${campos.trade_name}, ${campos.cnpj}, 'SERVICE',
              ${regime ?? 'SIMPLES_NACIONAL'}::tax_regime, ${campos.address_line1}, ${campos.address_number},
              ${campos.neighborhood}, ${campos.city}, ${campos.state},
              ${campos.zipcode}, ${campos.municipal_registration})
      RETURNING id::text
    `)) as unknown as { id: string }[];
    companyId = nova!.id;
    criada = true;
  }

  // Veio do OneFlow, então está lá: a ficha não deve oferecer "criar no
  // OneFlow" para ela. Ver 0066.
  await tx.execute(sql`
    UPDATE company SET oneflow_created_at = COALESCE(oneflow_created_at, NOW()) WHERE id = ${companyId}
  `);

  // Passa a chave do token do appHash provisório para o id definitivo.
  await tx.execute(sql`
    DELETE FROM oneflow_token WHERE scope = 'COMPANY' AND scope_key = ${companyId}
  `);
  await tx.execute(sql`
    UPDATE oneflow_token SET scope_key = ${companyId}
     WHERE scope = 'COMPANY' AND scope_key = ${appHash}
  `);

  /* ── Sócios ─────────────────────────────────────────────────────────── */

  let socios = 0;
  try {
    const q = (await of.quadroSocietario(companyId, appHash)) as Record<string, unknown>;
    const lista = Array.isArray((q.result as Record<string, unknown>)?.socios)
      ? ((q.result as Record<string, unknown>).socios as Record<string, unknown>[])
      : [];

    for (const s of lista) {
      const nome = String(s.nomeSocio ?? '').trim();
      const cpf = String(s.documento ?? '').trim();
      const pct = Number(s.perCapitalTotal ?? 0);
      if (!nome) continue;

      // Casa por CPF: o nome muda de grafia entre sistemas, o CPF não.
      const [ja] = (await tx.execute(sql`
        SELECT id::text FROM partner
         WHERE company_id = ${companyId}
           AND regexp_replace(COALESCE(cpf,''), '\\D', '', 'g') = ${so(cpf)}
         LIMIT 1
      `)) as unknown as { id: string }[];

      if (ja) {
        await tx.execute(sql`
          UPDATE partner SET name = ${nome}, ownership_pct = ${pct.toFixed(3)} WHERE id = ${ja.id}
        `);
      } else {
        await tx.execute(sql`
          INSERT INTO partner (company_id, name, cpf, ownership_pct)
          VALUES (${companyId}, ${nome}, ${cpf || null}, ${pct.toFixed(3)})
        `);
      }
      socios++;
    }
  } catch (err) {
    avisos.push(`Quadro societário não veio: ${err instanceof Error ? err.message : String(err)}`);
  }

  /* ── Plano de contas e interruptores ────────────────────────────────── */

  const plano = await ensureChartOfAccounts(tx, companyId);

  const modulos = Array.isArray(dados.modulos)
    ? (dados.modulos as Record<string, unknown>[])
        .filter((m) => String(m.status ?? '').toLowerCase().startsWith('habilit'))
        .map((m) => String(m.modulo ?? ''))
    : [];

  /**
   * O que ligar vem do que está implantado LÁ.
   *
   * Fiscal habilitado significa que há apuração para trazer. O contábil não
   * liga o envio sozinho: ter o módulo não quer dizer ter plano de contas
   * criado, e ligar sem ele marcaria centenas de partidas como erro. Essa
   * continua sendo uma decisão do contador, na tela de operação.
   */
  const temFiscal = modulos.some((m) => /fiscal/i.test(m));
  if (temFiscal) {
    /**
     * MESCLA, não substitui.
     *
     * A primeira versão apagava a linha e gravava só este interruptor. Na
     * primeira execução não fazia diferença; na segunda — e o cadastro foi
     * feito para ser rodado de novo, para atualizar — apagava o dia de
     * fechamento, o envio e as diretrizes que o contador tinha configurado.
     */
    const atualizadas = (await tx.execute(sql`
      UPDATE operation_setting
         SET settings = settings || jsonb_build_object(
               'agentes', COALESCE(settings->'agentes', '{}'::jsonb) || '{"retornoOneflow":true}'::jsonb)
       WHERE scope = 'COMPANY' AND scope_key = ${companyId}
      RETURNING 1
    `)) as unknown as unknown[];
    if (!atualizadas.length) {
      await tx.execute(sql`
        INSERT INTO operation_setting (scope, scope_key, settings)
        VALUES ('COMPANY', ${companyId}, '{"agentes":{"retornoOneflow":true}}'::jsonb)
      `);
    }
  } else {
    avisos.push('Módulo fiscal não implantado no OneFlow — a busca de guias fica desligada.');
  }

  return {
    companyId,
    criada,
    razaoSocial: razao,
    socios,
    contasDoPlano: plano.criadas,
    modulos,
    avisos,
  };
}

/** `regimeTributario` do OneFlow, por extenso → enum do Hub. `null` = não reconhecido. */
export function regimeDoOneflow(
  texto: string,
): 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | null {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/simples|\bmei\b|microempreendedor/.test(t)) return 'SIMPLES_NACIONAL';
  if (/presumido/.test(t)) return 'LUCRO_PRESUMIDO';
  if (/\breal\b/.test(t)) return 'LUCRO_REAL';
  return null;
}

/** Reexportado para a tela poder oferecer a busca por CNPJ avulso. */
export { appHashPorCnpj };
