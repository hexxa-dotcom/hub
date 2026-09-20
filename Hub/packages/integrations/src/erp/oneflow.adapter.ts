/**
 * ADAPTADOR DO ONEFLOW (Omie) — contabilidade oficial.
 *
 * O OneFlow é quem transmite DEFIS, ECD, EFD-Reinf e DCTF. A missão do Hub não
 * é transmitir: é juntar informação fidedigna e entregar a quem transmite.
 * Isso define o escopo deste adaptador — ele leva o razão para lá e traz de
 * volta folha e guias. Nada mais.
 *
 * A integração é de mão dupla, e isso a distingue do adaptador do Nibo, que é
 * importação de uma via só, feita como ponte temporária.
 *
 * ── Autenticação ────────────────────────────────────────────────────────
 *
 * Três níveis, cada um com validade de 24 horas:
 *
 *   token do usuário  →  token do app (escritório)  →  token da empresa
 *
 * O token da empresa é o que assina as chamadas. Os dois de cima existem para
 * obtê-lo e renová-lo. Quem chama este adaptador não precisa saber disso: pede
 * um cliente para uma empresa e recebe um que se mantém autenticado sozinho.
 */

const PORTAL = 'https://app.omie.com.br/api/portal';
const API = 'https://rest.oneflow.com.br/api';

/** Renova quando falta menos que isto — não se espera o 401. */
const MARGEM_RENOVACAO_MS = 10 * 60 * 1000;

export interface TokenDuplo {
  token: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/**
 * Onde a cadeia de tokens é guardada. O adaptador não conhece banco: recebe
 * como dependência, que é o que permite testá-lo sem Postgres.
 */
export interface OneflowTokenStore {
  ler(scope: 'USER' | 'APP' | 'COMPANY', scopeKey: string | null): Promise<TokenDuplo | null>;
  gravar(
    scope: 'USER' | 'APP' | 'COMPANY',
    scopeKey: string | null,
    appHash: string | null,
    t: TokenDuplo,
  ): Promise<void>;
}

export class OneflowError extends Error {
  /** Cota de 500/dia estourada — só reinicia à meia-noite, retry não ajuda. */
  cotaDiariaEsgotada = false;

  constructor(
    public readonly status: number | null,
    public readonly endpoint: string,
    message: string,
  ) {
    super(`[oneflow ${status ?? '—'}] ${endpoint}: ${message}`);
    this.name = 'OneflowError';
  }
}

/** Token sem validade conhecida é tratado como expirado — renovar é barato. */
function expirado(t: TokenDuplo): boolean {
  if (!t.expiresAt) return true;
  return t.expiresAt.getTime() - Date.now() < MARGEM_RENOVACAO_MS;
}

/** A doc diz 24h; guardamos 23 para não depender do relógio deles. */
function validadePadrao(): Date {
  return new Date(Date.now() + 23 * 60 * 60 * 1000);
}

interface RespostaToken {
  token?: string;
  refresh_token?: string;
  [k: string]: unknown;
}

export interface EmpresaOneflow {
  appHash: string;
  cnpj: string;
  razaoSocial: string;
  [k: string]: unknown;
}

export interface ContaContabilOneflow {
  classificacao: string;
  codigoReduzido: string | null;
  descricao: string;
}

export interface PartidaOneflow {
  valor: number;
  /** 'D' ou 'C'. */
  d_c: 'D' | 'C';
  historico: string;
  classificacao?: string;
  codigoReduzido?: string;
  cnpjCli?: string;
  cnpjForn?: string;
  razaoSocial?: string;
  rateios?: { idCentroCusto?: number; CodCentroCusto?: string; valor?: number }[];
}

export interface LancamentoOneflow {
  /** DD/MM/AAAA — formato do OneFlow, não ISO. */
  data: string;
  valor: number;
  documento?: string;
  partidas: PartidaOneflow[];
}

/**
 * Nota de serviço no layout do OneFlow.
 *
 * Os campos obrigatórios são os da especificação deles; `codigoLC116` é
 * obrigatório na prática, porque sem ele o OneFlow exige `codigoServico`
 * (o código interno de lá), que o Hub não conhece.
 */
export interface NotaFiscalOneflow {
  /** 'P' = prestado (o que a empresa emitiu), 'T' = tomado. */
  tipoServico: 'P' | 'T';
  numeroDocumento: string;
  cpfCnpjParticipante: string;
  razaoSocialParticipante: string;
  /** AAAAMM. */
  competencia: string;
  /** AAAA-MM-DD. */
  dataEmissao: string;
  quantidade: number;
  valorUnitario: number;
  /** Item da LC 116/2003, ex.: "17.19". */
  codigoLC116?: string;
  aliquotaISS?: number;
  cidadePrestacao?: string;
  /** '05' = tributado no município — o caso comum. */
  tributacaoServico?: '01' | '02' | '03' | '04' | '05';
  reterISS?: 'S' | 'N';
  desconto?: number;
}

/**
 * Espaçamento mínimo entre chamadas.
 *
 * A cota é de 60 por minuto, então 1000ms bastaria na teoria. 1100ms dá folga
 * para a variação de latência — estourar a cota não devolve 429 honesto, e sim
 * HTTP 200 com erro no corpo, que é o modo de falha mais caro desta API.
 */
const INTERVALO_ENTRE_CHAMADAS_MS = 1100;

/**
 * Corpo do `escritorio/empresas/criar` — só os campos que o Hub preenche.
 * Códigos conforme a documentação da API (swaggerhub oneflowoficial 2.0.0).
 */
export interface CadastroEmpresaOneflow {
  razao: string;
  nomeFantasia: string;
  /** Sem máscara. */
  cnpj: string;
  inscricaoMunicipal?: string;
  CNAEPrincipal?: string;
  /** 1 Simples · 2 Simples com excesso de sublimite · 3 Presumido · 4 Real · 5 Produtor rural · 8 MEI · 9 Isento. */
  regimeTributario: '1' | '2' | '3' | '4' | '5' | '8' | '9';
  /** 0 Industrial · 1 Comércio varejista · 2 Serviços · 3 Construção civil · 4 Atacado · 5 Exportadora · 6/7 Importador · 8 Associação · 9 Órgão público. */
  tipoAtividade: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  /** CPF do contador a vincular. */
  contador?: string;
  contato: {
    nomeContato: string;
    email: string;
    dddCelular: string;
    numCelular: string;
    dddTelefone: string;
    numTelefone: string;
  };
  endereco: {
    cep: string;
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  appOwner: { nome: string; email: string; dddCelular: string; numCelular: string };
  usuarios: { nome: string; email: string }[];
  /** FIS Fiscal · CTL Contábil · FPG Folha · CLI Portal. Competência AAAAMM. */
  modulos: { modulo: 'FIS' | 'CTL' | 'FPG' | 'CLI'; competencia: string }[];
}

export class OneflowAdapter {
  /**
   * Chamado ANTES de cada requisição, para contar a cota.
   *
   * Fica aqui, e não em quem chama, porque a cota de 500/dia é do escritório
   * inteiro: todo caminho que fala com o OneFlow precisa ser contado, e um
   * caminho esquecido é uma cota estourada sem explicação.
   */
  constructor(
    private readonly store: OneflowTokenStore,
    private readonly aoChamar?: () => void | Promise<void>,
  ) {}

  /** Momento em que a última chamada saiu — a régua do espaçamento. */
  private ultimaChamada = 0;

  /**
   * Segura a chamada até completar o intervalo desde a anterior.
   *
   * Fica no adaptador, e não em quem chama, porque a cota é do cliente
   * inteiro: um lote de escrituração e uma busca de guia rodando juntos
   * somam na mesma conta. Espalhar essa responsabilidade garantiria que
   * algum caminho de código a esquecesse.
   */
  private async aguardarVez(): Promise<void> {
    const desde = Date.now() - this.ultimaChamada;
    if (desde < INTERVALO_ENTRE_CHAMADAS_MS) {
      await new Promise((r) => setTimeout(r, INTERVALO_ENTRE_CHAMADAS_MS - desde));
    }
    this.ultimaChamada = Date.now();
  }

  /* ── Cadeia de autenticação ──────────────────────────────────────────── */

  private async pedir<T>(
    url: string,
    opts: { token?: string; method?: string; body?: unknown } = {},
  ): Promise<T> {
    await this.aguardarVez();
    if (this.aoChamar) await this.aoChamar();

    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });

    if (!res.ok) {
      throw new OneflowError(res.status, url, (await res.text()).slice(0, 400));
    }

    // Alguns endpoints respondem 201 com corpo vazio.
    const texto = await res.text();
    const json = (texto ? JSON.parse(texto) : {}) as Record<string, unknown>;

    /**
     * O OneFlow devolve **HTTP 200 com erro no corpo** — inclusive no estouro
     * de cota ("Limite de 60 requisições por minuto"). Confiar no status HTTP
     * faria o chamador registrar como sucesso um lançamento que nunca existiu,
     * e a contabilidade ficaria com buraco que ninguém sabe de onde veio.
     */
    const envelope = json.response as Record<string, unknown> | undefined;
    if (envelope?.status === 'error') {
      const cota = String(envelope.faultcode ?? '').includes('RATE_LIMIT');
      throw new OneflowError(cota ? 429 : 400, url, String(envelope.result ?? 'erro sem descrição'));
    }
    if (json.code && String(json.code) !== '200' && String(json.code) !== '201') {
      const texto = String(json.error ?? 'erro');
      /**
       * São DUAS cotas, e elas se comportam de formas opostas:
       *
       *   60 por minuto — passa sozinha, esperar resolve.
       *   500 por dia   — só reinicia à meia-noite.
       *
       * Distingui-las importa porque um retry contra a cota diária não é
       * inútil: é ativamente nocivo, já que cada tentativa consome uma
       * requisição do dia seguinte assim que ele vira. Quem chama precisa
       * poder parar o lote inteiro, e por isso o erro é marcado.
       */
      const err = new OneflowError(Number(json.code) || 400, url, texto);
      if (/limite de \d+ requisi..es por dia/i.test(texto)) err.cotaDiariaEsgotada = true;
      throw err;
    }

    return json as T;
  }

  /**
   * Token do usuário. É o único que NÃO dá para obter por API sem navegador:
   * nasce de um login, e só se renova por refresh. Se ele morrer sem refresh
   * válido, alguém precisa fazer login de novo — e o erro precisa dizer isso,
   * em vez de falhar como "não autorizado" genérico.
   */
  private async tokenDoUsuario(forcarRenovacao = false): Promise<string> {
    const atual = await this.store.ler('USER', null);
    if (!atual) {
      throw new OneflowError(
        null,
        'token do usuário',
        'Nenhum token de usuário cadastrado. Faça login em app.omie.com.br e ' +
          'abra /api/portal/users/me/token/ para obter o par token + refresh_token.',
      );
    }
    if (!forcarRenovacao && !expirado(atual)) return atual.token;

    if (!atual.refreshToken) {
      throw new OneflowError(
        null,
        'token do usuário',
        'Token do usuário expirado e sem refresh_token. É preciso refazer o login no portal.',
      );
    }

    const r = await this.pedir<RespostaToken>(`${PORTAL}/users/refresh-token/`, {
      method: 'POST',
      body: { token: atual.token, refresh_token: atual.refreshToken },
    });
    if (!r.token) throw new OneflowError(null, 'refresh do usuário', 'resposta sem token');

    const novo: TokenDuplo = {
      token: r.token,
      refreshToken: r.refresh_token ?? atual.refreshToken,
      expiresAt: validadePadrao(),
    };
    await this.store.gravar('USER', null, null, novo);
    return novo.token;
  }

  /**
   * Executa algo que depende do token do usuário, renovando se o portal
   * recusar.
   *
   * ── Por que a validade guardada não basta ───────────────────────────────
   *
   * Nós não sabemos quando o token do usuário expira: a documentação diz 24h,
   * e guardamos 23 para ter margem. Mas é um PALPITE — e um palpite sobre o
   * relógio de outro sistema.
   *
   * Observado em 18/09/2026: o token estava marcado como válido por mais onze
   * horas e o portal já respondia 403. Como o adaptador confiava na validade
   * guardada, ele não renovava; e como não renovava, TODA chamada que precisa
   * do portal falhava — durante as onze horas inteiras, sem nada no sistema
   * indicando o motivo. É exatamente o modo de falha silenciosa que a cadeia
   * de tokens existe para evitar.
   *
   * Então a renovação passa a ter dois gatilhos: a validade (barata, evita o
   * erro) e a RECUSA (correta, não depende de adivinhar o relógio deles).
   */
  private async comRenovacao<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const auth = err instanceof OneflowError && (err.status === 401 || err.status === 403);
      if (!auth) throw err;

      await this.tokenDoUsuario(true);
      // Os tokens de app derivam do token do usuário: se ele era inválido,
      // os que nasceram dele também são.
      this.appHashEscritorio = null;
      return fn();
    }
  }

  /** Cache do hash do escritório dentro da instância — muda a cada renovação. */
  private appHashEscritorio: string | null = null;

  /** Token de um app (escritório ou empresa), pedido pelo `app_hash`. */
  private async tokenDoApp(appHash: string, scope: 'APP' | 'COMPANY', chave: string): Promise<string> {
    const atual = await this.store.ler(scope, chave);
    if (atual && !expirado(atual)) return atual.token;

    // O portal emite token de app a partir do token do usuário. Renovar por
    // aqui é mais simples que pelo refresh do app e tem o mesmo efeito.
    const r = await this.comRenovacao(async () => {
      const usuario = await this.tokenDoUsuario();
      return this.pedir<RespostaToken>(`${PORTAL}/apps/${appHash}/token/`, { token: usuario });
    });
    if (!r.token) throw new OneflowError(null, `token do app ${appHash}`, 'resposta sem token');

    const novo: TokenDuplo = {
      token: r.token,
      refreshToken: r.refresh_token ?? null,
      expiresAt: validadePadrao(),
    };
    await this.store.gravar(scope, chave, appHash, novo);
    return novo.token;
  }

  /** Guarda o par inicial do usuário, obtido no navegador. */
  async registrarTokenDoUsuario(token: string, refreshToken: string): Promise<void> {
    await this.store.gravar('USER', null, null, {
      token,
      refreshToken,
      expiresAt: validadePadrao(),
    });
  }

  /* ── Escritório ──────────────────────────────────────────────────────── */

  /** Apps da conta. É aqui que se descobre o `app_hash` do OneflOW do escritório. */
  async listarApps(): Promise<{ app_hash: string; app_type: string; nome?: string }[]> {
    return this.comRenovacao(async () => {
      const usuario = await this.tokenDoUsuario();
      const r = await this.pedir<unknown>(`${PORTAL}/apps/`, { token: usuario });
      const lista = Array.isArray(r) ? r : ((r as Record<string, unknown>).results as unknown[]) ?? [];
      return lista as { app_hash: string; app_type: string; nome?: string }[];
    });
  }

  /** `app_hash` do OneFlow do escritório, descoberto pelo `app_type`. */
  async appHashDoEscritorio(): Promise<string> {
    const apps = await this.listarApps();
    const of = apps.find((a) => String(a.app_type).toUpperCase() === 'ONEFLOW');
    if (!of) {
      throw new OneflowError(
        null,
        'apps do portal',
        `Nenhum app do tipo ONEFLOW nesta conta. Tipos encontrados: ${apps.map((a) => a.app_type).join(', ') || 'nenhum'}.`,
      );
    }
    return of.app_hash;
  }

  /**
   * Cria a empresa no OneFlow (como "não cliente do Omie ERP"), já com os
   * módulos e a competência inicial de cada um.
   *
   * Não há endpoint para excluir empresa: o que for criado errado sai à mão.
   * Por isso só é chamado na aprovação do contador, com o que vai ser
   * enviado mostrado antes — nunca no cadastro do cliente.
   */
  async criarEmpresa(cadastro: CadastroEmpresaOneflow): Promise<unknown> {
    const hash = await this.appHashDoEscritorio();
    const token = await this.tokenDoApp(hash, 'APP', hash);
    return this.pedir(`${API}/oneflow/escritorio/empresas/criar`, {
      token,
      method: 'POST',
      body: cadastro,
    });
  }

  /**
   * A empresa já existe no OneFlow? Pelo CNPJ.
   *
   * O endpoint responde erro quando não encontra, e é assim que "não
   * existe" chega — por isso a busca é pela listagem, que diz a mesma coisa
   * sem confundir "não existe" com "a chamada falhou".
   */
  async empresaPorCnpj(cnpj: string): Promise<EmpresaOneflow | null> {
    const so = cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    for (let pagina = 1; pagina <= 20; pagina++) {
      const lote = await this.listarEmpresas(pagina);
      if (!lote.length) return null;
      const achada = lote.find((e) => e.cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase() === so);
      if (achada) return achada;
    }
    return null;
  }

  /** Empresas do escritório, com o `app_hash` de cada uma. */
  async listarEmpresas(pagina = 1): Promise<EmpresaOneflow[]> {
    const hash = await this.appHashDoEscritorio();
    const token = await this.tokenDoApp(hash, 'APP', hash);
    const r = await this.pedir<unknown>(
      `${API}/oneflow/escritorio/empresas/listar?pagina=${pagina}`,
      { token },
    );
    /**
     * A lista vem em `result.empresas`, e as chaves são MINÚSCULAS:
     * `apphash`, `cnpj`, `razao`. A primeira versão lia `empresas` na raiz e
     * `appHash`/`razaoSocial` em cada item — e por isso devolvia lista vazia
     * ou objetos sem hash, silenciosamente. Silenciosamente é o problema:
     * quem chamava concluía "empresa não existe no OneFlow" quando o que
     * havia era um nome de campo errado.
     */
    const env = r as Record<string, unknown>;
    const res = (env.result ?? env) as Record<string, unknown>;
    const lista = (Array.isArray(r) ? r : (res.empresas as unknown[])) ?? [];

    return (lista as Record<string, unknown>[]).map((e) => ({
      appHash: String(e.apphash ?? e.appHash ?? ''),
      cnpj: String(e.cnpj ?? ''),
      razaoSocial: String(e.razao ?? e.razaoSocial ?? ''),
      ...e,
    }));
  }

  /**
   * Cliente autenticado para uma empresa.
   *
   * `companyId` é o id no Hub, e `appHash` o da empresa no OneFlow — os dois
   * porque o token é guardado pela chave do Hub, mas pedido pela do OneFlow.
   */
  private async tokenDaEmpresa(companyId: string, appHash: string): Promise<string> {
    return this.tokenDoApp(appHash, 'COMPANY', companyId);
  }

  /* ── Contábil ────────────────────────────────────────────────────────── */

  /** Plano de contas da empresa no OneFlow — a base do de-para. */
  async planoDeContas(
    companyId: string,
    appHash: string,
    pagina = 1,
  ): Promise<ContaContabilOneflow[]> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    const r = await this.pedir<unknown>(
      `${API}/oneflow/empresa/contabil/planocontas/contas?pagina=${pagina}`,
      { token },
    );
    const lista = Array.isArray(r) ? r : ((r as Record<string, unknown>).contas as unknown[]) ?? [];
    return (lista as Record<string, unknown>[]).map((c) => ({
      classificacao: String(c.classificacao ?? c.Classificacao ?? ''),
      codigoReduzido: (c.codigoReduzido ?? c.codigo_reduzido ?? null) as string | null,
      descricao: String(c.descricao ?? c.nome ?? ''),
    }));
  }

  /**
   * Envia uma partida contábil.
   *
   * Confere o equilíbrio ANTES de mandar. O razão do Hub já garante isso por
   * trigger, mas o de-para de contas acontece no caminho, e um erro de
   * mapeamento pode produzir um payload desbalanceado a partir de uma partida
   * que fechava. Descobrir isso aqui é muito melhor que descobrir num erro do
   * OneFlow, ou pior, num lançamento aceito e errado.
   */
  async enviarLancamento(
    companyId: string,
    appHash: string,
    lancamento: LancamentoOneflow,
  ): Promise<{ id: string | null }> {
    const cents = (n: number) => Math.round(n * 100);
    const debito = lancamento.partidas
      .filter((p) => p.d_c === 'D')
      .reduce((s, p) => s + cents(p.valor), 0);
    const credito = lancamento.partidas
      .filter((p) => p.d_c === 'C')
      .reduce((s, p) => s + cents(p.valor), 0);

    if (debito !== credito) {
      throw new OneflowError(
        null,
        'gerarlancamento',
        `Partida não fecha após o de-para: débito ${debito / 100} ≠ crédito ${credito / 100}. ` +
          'Provável conta sem correspondência no plano do OneFlow.',
      );
    }
    if (!lancamento.partidas.length) {
      throw new OneflowError(null, 'gerarlancamento', 'Lançamento sem partidas.');
    }

    const token = await this.tokenDaEmpresa(companyId, appHash);
    const r = await this.pedir<Record<string, unknown>>(
      `${API}/oneflow/empresa/contabil/lancamentos/gerarlancamento`,
      { token, method: 'POST', body: lancamento },
    );
    return { id: idDoLancamento(r) };
  }

  /**
   * Exclui um lançamento contábil pelo id que o próprio OneFlow devolveu.
   *
   * Responde `201` quando exclui. A listagem do razão de lá não devolve ids,
   * então só dá para excluir o que o Hub enviou e cujo id guardou em
   * `oneflow_envio.oneflow_id` — que é exatamente o que precisa sair quando
   * algo foi enviado sem dever.
   */
  async excluirLancamento(companyId: string, appHash: string, id: string): Promise<void> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    await this.pedir(`${API}/oneflow/empresa/contabil/lancamentos/excluirlancamento`, {
      token,
      method: 'POST',
      body: { id: Number(id) },
    });
  }

  /** Balancete do OneFlow — para conferir contra o nosso. */
  async balancete(
    companyId: string,
    appHash: string,
    competenciaInicial: string,
    competenciaFinal: string,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/contabil/balancete` +
        `?competenciaInicial=${competenciaInicial}&competenciaFinal=${competenciaFinal}`,
      { token },
    );
  }

  /* ── Folha — a mão de volta ──────────────────────────────────────────── */

  /**
   * Totais dos recibos de pagamento por competência.
   *
   * É daqui que vem o pró-labore real, com valor e retenções. Enquanto isso
   * não chega, o Informe de Rendimentos do sócio cobre só lucros distribuídos
   * e avisa que pró-labore não está incluso.
   *
   * @param competencia AAAAMM
   * @param tipoFolha código do OneFlow (mensal, 13º, férias…)
   */
  async recibosDaFolha(
    companyId: string,
    appHash: string,
    competencia: string,
    tipoFolha: number,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/folha/recibos/totais?competencia=${competencia}&tipoFolha=${tipoFolha}`,
      { token },
    );
  }

  /** Status das folhas da competência — diz se existe folha antes de buscá-la. */
  async statusDaFolha(companyId: string, appHash: string, competencia: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/folha/statusfolha?competencia=${competencia}`,
      { token },
    );
  }

  /**
   * Composição do Fator R da competência.
   *
   * Decide entre o Anexo III (alíquota menor) e o Anexo V do Simples quando a
   * folha passa de 28% da receita bruta. É a informação da folha com maior
   * efeito sobre o imposto, e hoje o Hub não a tem de lado nenhum.
   */
  async fatorR(companyId: string, appHash: string, competencia: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/folha/fatorr?competencia=${competencia}`,
      { token },
    );
  }

  /* ── Guias — a outra mão de volta ────────────────────────────────────── */

  /**
   * Apurações fiscais da competência.
   *
   * É AQUI que o imposto apurado mora — não nos anexos. Os anexos são o PDF
   * da guia; a apuração é o valor. Escriturar a partir do PDF exigiria lê-lo;
   * a partir daqui, não.
   */
  async apuracoesFiscais(companyId: string, appHash: string, competencia: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/fiscal/apuracao/listar?competencia=${competencia}`,
      { token },
    );
  }

  /**
   * Resumo de uma apuração — o valor devido de um imposto.
   *
   * @param imposto um dos códigos do OneFlow: SIMPLES, ISS, INSS, IRRF,
   *        PISCOFINS, ICMS, IRPJCSLL, RETENCAO, CPRB, MEI…
   */
  async resumoDaApuracao(
    companyId: string,
    appHash: string,
    competencia: string,
    imposto: string,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/fiscal/apuracao/resumo?competencia=${competencia}&imposto=${imposto}`,
      { token },
    );
  }

  /** Alíquotas do Simples Nacional aplicadas na competência. */
  async aliquotasDoSimples(companyId: string, appHash: string, competencia: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/fiscal/simplesnacional/aliquotas?competencia=${competencia}`,
      { token },
    );
  }

  /**
   * Insere notas de serviço no módulo FISCAL do OneFlow.
   *
   * É o que alimenta a apuração — e, por consequência, a guia do DAS. Sem
   * isto o módulo fiscal não tem receita, apura zero, e a mão de volta não
   * tem guia para trazer.
   *
   * Usa o layout estruturado, não o envio de XML, porque o Hub não guarda o
   * XML da nota emitida: guarda número, valor, tomador e perfil fiscal. Com
   * esses campos o layout próprio do OneFlow é suficiente, e não depende de
   * rebuscar o XML no Emissor Nacional a cada envio.
   */
  async enviarNotasFiscais(
    companyId: string,
    appHash: string,
    notas: NotaFiscalOneflow[],
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(`${API}/oneflow/empresa/fiscal/nfse/layoutoneflow`, {
      token,
      method: 'POST',
      body: { notas },
    });
  }

  /**
   * Documentos fiscais JÁ escriturados no OneFlow na competência.
   *
   * É a pergunta que precede todo envio. O OneFlow pode ser configurado para
   * buscar as notas sozinho no Emissor Nacional, e quando essa busca funciona
   * a nota já está lá. Mandar de novo criaria receita em dobro na apuração —
   * e o cliente pagaria imposto sobre faturamento que não teve.
   */
  async documentosFiscais(
    companyId: string,
    appHash: string,
    competencia: string,
    pagina = 1,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/fiscal/documentos/listar?competencia=${competencia}&pagina=${pagina}`,
      { token },
    );
  }

  /** Quantidade de documentos fiscais escriturados — confere o que chegou lá. */
  async quantidadeDeDocumentos(
    companyId: string,
    appHash: string,
    competencia: string,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/fiscal/documentos/quantidade?competencia=${competencia}`,
      { token },
    );
  }

  /** Obrigações configuradas para a empresa — quais guias ela de fato tem. */
  async obrigacoesDaEmpresa(companyId: string, appHash: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(`${API}/oneflow/empresa/obrigacoes/listar`, { token });
  }

  /**
   * Anexos de UMA obrigação — o arquivo da guia ou da declaração.
   *
   * `codigo` é obrigatório e vem da listagem de obrigações (GPGDAS para a guia
   * do DAS, DDEFIS para a DEFIS, e assim por diante). Sem ele o OneFlow
   * responde "O preenchimento da tag [codigo] é obrigatório".
   */
  async anexosDasObrigacoes(
    companyId: string,
    appHash: string,
    competencia: string,
    codigo: string,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(
      `${API}/oneflow/empresa/obrigacoes/anexos?competencia=${competencia}&codigo=${codigo}`,
      { token },
    );
  }

  /**
   * Competência em que cada módulo foi implantado na empresa.
   *
   * O OneFlow RECUSA lançamento anterior à implantação do contábil, e com uma
   * mensagem que não diz isso: "É necessário informar uma Conta Contábil
   * válida". Quem recebe esse erro procura defeito no plano de contas e não
   * encontra nada — o problema é a data.
   *
   * Consultar antes de enviar troca um lote inteiro de erros por um mês que
   * nem chega a ser tentado.
   *
   * @returns mapa `{ Contábil: '2026-01', Fiscal: '2026-01', … }`
   */
  async competenciaInicialDosModulos(
    companyId: string,
    appHash: string,
  ): Promise<Record<string, string>> {
    const res = await this.dadosBasicosDaEmpresa(companyId, appHash);
    const modulos = Array.isArray(res.modulos) ? (res.modulos as Record<string, unknown>[]) : [];

    const out: Record<string, string> = {};
    for (const m of modulos) {
      // Vem como "MM/AAAA"; devolvemos "AAAA-MM", que ordena como texto.
      const ini = String(m.competenciaInicial ?? '').trim();
      const ok = /^(\d{2})\/(\d{4})$/.exec(ini);
      if (ok) out[String(m.modulo ?? '')] = `${ok[2]}-${ok[1]}`;
    }
    return out;
  }

  /**
   * Cadastro da empresa no OneFlow: razão, fantasia, endereço, módulos.
   *
   * É a fonte do cadastro no Hub. Os dados já foram conferidos por alguém ao
   * abrir a empresa lá — pedir ao cliente que os digite de novo só cria uma
   * segunda versão da verdade, com erros próprios.
   */
  async dadosBasicosDaEmpresa(
    companyId: string,
    appHash: string,
  ): Promise<Record<string, unknown>> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    const r = await this.pedir<Record<string, unknown>>(
      `${API}/oneflow/empresa/geral/dadosbasicos`,
      { token },
    );
    return (r.result ?? r) as Record<string, unknown>;
  }

  /** Quadro societário cadastrado lá — confere contra os sócios do Hub. */
  async quadroSocietario(companyId: string, appHash: string): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(`${API}/oneflow/empresa/geral/quadrosocietario`, { token });
  }

  /**
   * Finaliza a competência no OneFlow.
   *
   * O último passo da cadeia, e o único irreversível: depois disto o período
   * está encerrado lá. Por isso a régua de autonomia trata `LIBERAR_CONTABIL`
   * como ação que exige aprovação do contador.
   */
  async finalizarCompetencia(
    companyId: string,
    appHash: string,
    competencia: string,
    modulo?: string,
  ): Promise<unknown> {
    const token = await this.tokenDaEmpresa(companyId, appHash);
    return this.pedir(`${API}/oneflow/empresa/finalizar`, {
      token,
      method: 'POST',
      body: { competencia, ...(modulo ? { modulo } : {}) },
    });
  }
}

/**
 * Id do lançamento criado, na resposta do `gerarlancamento`.
 *
 * A resposta é `{"code":"201","result":{"id":11561902216}}` — o id vem
 * DENTRO de `result`. A leitura antiga olhava só o primeiro nível e gravava
 * nulo sem acusar nada: 153 partidas reenviadas em 19/09/2026 ficaram sem
 * id, e sem id o OneFlow não deixa excluir pela API.
 *
 * Devolve `null` em vez de lançar: o lançamento JÁ EXISTE lá, e tratá-lo
 * como falha faria o Hub reenviá-lo no dia seguinte, em dobro. Quem envia
 * decide o que fazer com a falta — `enviarRazao` para o lote.
 */
export function idDoLancamento(resposta: Record<string, unknown>): string | null {
  const dentro = (resposta.result && typeof resposta.result === 'object'
    ? resposta.result
    : {}) as Record<string, unknown>;
  const id = dentro.id ?? dentro.idLancamento ?? resposta.id ?? resposta.idLancamento;
  return id === undefined || id === null || String(id).trim() === '' ? null : String(id);
}
