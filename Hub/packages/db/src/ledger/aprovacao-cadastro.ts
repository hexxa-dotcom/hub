import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import type { CadastroEmpresaOneflow } from '@hexxa/integrations';
import { clienteOneflow } from './oneflow-client';
import { cadastrarDoOneflow, type ResultadoCadastro } from './cadastro-oneflow';

/**
 * APROVAÇÃO DO CADASTRO — O CLIENTE NASCE AQUI E VAI PARA O ONEFLOW.
 *
 * O ciclo, como o escritório definiu:
 *
 *   1. O cliente se cadastra no Hub com o básico: CNPJ (a Receita preenche
 *      o resto da empresa) e quem responde por ela — nome, CPF, celular.
 *   2. O portal mostra "cadastro em validação" até o contador aprovar.
 *   3. O contador revisa na ficha e aprova. A aprovação cria a empresa no
 *      OneFlow, com os módulos, e libera o acesso.
 *   4. As regras tributárias o contador define LÁ. O Hub traz de volta
 *      (`cadastrarDoOneflow`): regime, sócios, cadastro. O OneFlow prevalece.
 *
 * Um cadastro só, feito aqui — sem digitar a mesma empresa duas vezes.
 *
 * ── Por que só na aprovação ─────────────────────────────────────────────
 *
 * A API do OneFlow cria empresa mas não exclui. Cadastro de teste, ou de quem
 * desistiu no meio, viraria empresa lá que só sai à mão. A aprovação é o
 * ponto em que alguém do escritório olhou e disse que é cliente.
 *
 * ── Por que o regime vai na criação ─────────────────────────────────────
 *
 * O OneFlow exige `regimeTributario` para criar. O Hub sugere pelo que a
 * Receita diz (optante do Simples) e o contador confirma; o que ele ajustar
 * depois no OneFlow é o que vale, e volta para cá.
 */

export type RegimeOneflow = CadastroEmpresaOneflow['regimeTributario'];
export type AtividadeOneflow = CadastroEmpresaOneflow['tipoAtividade'];

export interface EscolhasDaAprovacao {
  regime: RegimeOneflow;
  atividade: AtividadeOneflow;
  /** Competência inicial dos módulos, 'AAAAMM'. */
  competencia: string;
  modulos: ('FIS' | 'CTL' | 'FPG')[];
}

export interface CadastroMontado {
  cadastro: CadastroEmpresaOneflow;
  /** Campos obrigatórios que faltam — com eles vazios o OneFlow recusa. */
  faltando: string[];
  /** Sugestões para a tela, a partir do que já se sabe da empresa. */
  sugestao: { regime: RegimeOneflow | null; atividade: AtividadeOneflow };
  jaEnviadaEm: string | null;
  responsavel: { nome: string; email: string; cpf: string | null; celular: string | null } | null;
}

/** Celular/telefone em DDD + número. Aceita com ou sem +55. */
export function separarTelefone(bruto: string | null | undefined): { ddd: string; numero: string } | null {
  let d = String(bruto ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return { ddd: d.slice(0, 2), numero: d.slice(2) };
}

/**
 * Competência inicial padrão: janeiro do ano corrente — a mesma regra da
 * janela do extrato (só se lança o ano vigente). Empresa aberta neste ano
 * começa no mês em que abriu, que é quando existe algo a escriturar.
 */
export function competenciaInicialPadrao(hoje: string, aberturaAAAAMM?: string | null): string {
  const janeiro = `${hoje.slice(0, 4)}01`;
  return aberturaAAAAMM && aberturaAAAAMM > janeiro ? aberturaAAAAMM : janeiro;
}

/**
 * Monta o corpo da criação a partir do que o Hub tem, e diz o que falta.
 *
 * Nada é inventado: campo obrigatório vazio entra em `faltando` e a
 * aprovação não segue. Mandar um CEP ou um celular de enfeite criaria no
 * OneFlow um cadastro que parece completo e não é.
 */
export async function montarCadastroOneflow(
  tx: DbHandle,
  companyId: string,
  escolhas: EscolhasDaAprovacao,
): Promise<CadastroMontado> {
  const [c] = (await tx.execute(sql`
    SELECT c.legal_name, c.trade_name, c.cnpj, c.municipal_registration,
           c.address_line1, c.address_number, c.neighborhood, c.city, c.state, c.zipcode,
           to_char(c.oneflow_created_at, 'DD/MM/YYYY') AS enviada_em,
           n.cnae, n.optante_simples, n.telefone, n.email_contato,
           n.inscricao_municipal AS im_fiscal, n.logradouro, n.numero AS numero_fiscal,
           n.bairro AS bairro_fiscal, n.cep AS cep_fiscal, n.complemento
      FROM company c
      LEFT JOIN nfse_config n ON n.company_id = c.id
     WHERE c.id = ${companyId}
  `)) as unknown as Record<string, string | boolean | null>[];
  if (!c) throw new Error('Empresa não encontrada.');

  const [dono] = (await tx.execute(sql`
    SELECT u.name, u.email, u.cpf, u.phone
      FROM membership m JOIN app_user u ON u.id = m.user_id
     WHERE m.company_id = ${companyId} AND m.role = 'OWNER'
     ORDER BY m.created_at LIMIT 1
  `)) as unknown as { name: string; email: string; cpf: string | null; phone: string | null }[];

  const t = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const faltando: string[] = [];
  const exigir = (valor: string, nome: string) => {
    if (!valor) faltando.push(nome);
    return valor;
  };

  const cel = separarTelefone(dono?.phone);
  const fixo = separarTelefone(t(c.telefone)) ?? cel;

  if (!dono) faltando.push('responsável pela empresa (ninguém se cadastrou como dono)');
  else if (!cel) faltando.push('celular do responsável');

  const cadastro: CadastroEmpresaOneflow = {
    razao: exigir(t(c.legal_name), 'razão social'),
    nomeFantasia: t(c.trade_name) || t(c.legal_name),
    cnpj: exigir(t(c.cnpj).replace(/[^0-9A-Za-z]/g, '').toUpperCase(), 'CNPJ'),
    ...(t(c.municipal_registration) || t(c.im_fiscal)
      ? { inscricaoMunicipal: t(c.municipal_registration) || t(c.im_fiscal) }
      : {}),
    ...(t(c.cnae) ? { CNAEPrincipal: t(c.cnae).replace(/\D/g, '') } : {}),
    regimeTributario: escolhas.regime,
    tipoAtividade: escolhas.atividade,
    ...(process.env.ONEFLOW_CPF_CONTADOR
      ? { contador: process.env.ONEFLOW_CPF_CONTADOR.replace(/\D/g, '') }
      : {}),
    contato: {
      nomeContato: t(dono?.name),
      email: t(dono?.email) || t(c.email_contato),
      dddCelular: cel?.ddd ?? '',
      numCelular: cel?.numero ?? '',
      dddTelefone: fixo?.ddd ?? '',
      numTelefone: fixo?.numero ?? '',
    },
    endereco: {
      cep: exigir((t(c.zipcode) || t(c.cep_fiscal)).replace(/\D/g, ''), 'CEP'),
      rua: exigir(t(c.logradouro) || t(c.address_line1), 'logradouro'),
      numero: exigir(t(c.address_number) || t(c.numero_fiscal) || 'S/N', 'número'),
      ...(t(c.complemento) ? { complemento: t(c.complemento) } : {}),
      bairro: exigir(t(c.neighborhood) || t(c.bairro_fiscal), 'bairro'),
      cidade: exigir(t(c.city), 'cidade'),
      uf: exigir(t(c.state).toUpperCase(), 'UF'),
    },
    appOwner: {
      nome: t(dono?.name),
      email: t(dono?.email),
      dddCelular: cel?.ddd ?? '',
      numCelular: cel?.numero ?? '',
    },
    usuarios: dono ? [{ nome: t(dono.name), email: t(dono.email) }] : [],
    modulos: escolhas.modulos.map((modulo) => ({ modulo, competencia: escolhas.competencia })),
  };

  if (!/^\d{6}$/.test(escolhas.competencia)) faltando.push('competência inicial (AAAAMM)');
  if (!escolhas.modulos.length) faltando.push('ao menos um módulo');

  return {
    cadastro,
    faltando,
    sugestao: {
      // Optante do Simples pela Receita → Simples. Fora dele, não há palpite
      // seguro entre Presumido e Real: o contador escolhe.
      regime: c.optante_simples === true ? '1' : null,
      atividade: '2',
    },
    jaEnviadaEm: (c.enviada_em as string | null) ?? null,
    responsavel: dono
      ? { nome: dono.name, email: dono.email, cpf: dono.cpf, celular: dono.phone }
      : null,
  };
}

export interface ResultadoAprovacao {
  /** 'CRIADA' = o Hub criou lá; 'JA_EXISTIA' = já estava no OneFlow, só vinculou. */
  noOneflow: 'CRIADA' | 'JA_EXISTIA';
  /** O que voltou do OneFlow logo depois — pode faltar se ele ainda não refletiu. */
  sincronizacao: ResultadoCadastro | null;
  avisos: string[];
}

/**
 * Aprova: cria no OneFlow (se ainda não existir), libera o acesso e traz de
 * volta o que o OneFlow tem.
 *
 * A ordem importa. O acesso só é liberado DEPOIS de a empresa existir lá: se
 * a criação falhar, o cliente continua em validação e o contador vê o erro —
 * em vez de um cliente operando no Hub sem contabilidade do outro lado.
 */
export async function aprovarCadastro(
  tx: DbHandle,
  companyId: string,
  escolhas: EscolhasDaAprovacao,
): Promise<ResultadoAprovacao> {
  const montado = await montarCadastroOneflow(tx, companyId, escolhas);
  if (montado.faltando.length) {
    throw new Error(`Falta preencher: ${montado.faltando.join(', ')}.`);
  }

  const of = clienteOneflow(tx);
  const avisos: string[] = [];

  // Já existe lá? Criar de novo daria erro ou, pior, uma duplicata.
  let existente = await of.empresaPorCnpj(montado.cadastro.cnpj);
  const noOneflow: ResultadoAprovacao['noOneflow'] = existente ? 'JA_EXISTIA' : 'CRIADA';
  if (!existente) {
    await of.criarEmpresa(montado.cadastro);
    existente = await of.empresaPorCnpj(montado.cadastro.cnpj);
  } else {
    avisos.push(
      'A empresa já existia no OneFlow — nada foi criado lá. O regime e os módulos de lá foram mantidos.',
    );
  }

  await tx.execute(sql`
    UPDATE company SET oneflow_created_at = COALESCE(oneflow_created_at, NOW()) WHERE id = ${companyId}
  `);
  await tx.execute(sql`UPDATE membership SET authorized = true WHERE company_id = ${companyId}`);

  /**
   * A volta, na mesma passada: vincula o app da empresa e lê regime,
   * cadastro e sócios. Falhar aqui não desfaz a aprovação — a empresa já
   * existe lá —, só fica para o botão "Trazer do OneFlow".
   */
  let sincronizacao: ResultadoCadastro | null = null;
  if (existente?.appHash) {
    try {
      sincronizacao = await cadastrarDoOneflow(tx, existente.appHash, montado.cadastro.cnpj);
    } catch (err) {
      avisos.push(
        `Criada no OneFlow, mas a leitura de volta falhou (${err instanceof Error ? err.message : String(err)}). ` +
          'Use "Trazer do OneFlow" depois de configurar a empresa lá.',
      );
    }
  } else {
    avisos.push('O OneFlow ainda não listou a empresa criada. Use "Trazer do OneFlow" em alguns minutos.');
  }

  return { noOneflow, sincronizacao, avisos };
}

/**
 * Traz do OneFlow o que o contador definiu lá — regime, cadastro, sócios.
 * É o `cadastrarDoOneflow`, achando o app pelo CNPJ.
 */
export async function trazerDoOneflow(tx: DbHandle, companyId: string): Promise<ResultadoCadastro> {
  const [c] = (await tx.execute(sql`SELECT cnpj FROM company WHERE id = ${companyId}`)) as unknown as {
    cnpj: string;
  }[];
  if (!c) throw new Error('Empresa não encontrada.');
  const la = await clienteOneflow(tx).empresaPorCnpj(c.cnpj);
  if (!la) throw new Error('Esta empresa não está no OneFlow. Aprove o cadastro para criá-la lá.');
  return cadastrarDoOneflow(tx, la.appHash, c.cnpj);
}
