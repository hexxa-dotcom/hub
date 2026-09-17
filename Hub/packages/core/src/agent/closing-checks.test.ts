import { describe, it, expect } from 'vitest';
import { verificarFechamento, LIMITE_SEM_CLASSIFICACAO, type DadosDoMes } from './closing-checks';

/** Mês perfeito: nada para apontar. Cada teste estraga uma coisa só. */
const mesLimpo = (): DadosDoMes => ({
  referenceMonth: '2026-09-01',
  razao: { debito: 100_000, credito: 100_000 },
  aClassificar: { quantidade: 0, valor: 0, documentos: [] },
  extratoPendente: { quantidade: 0, valor: 0 },
  receita: 50_000,
  receitaComNota: 50_000,
  receitaSemNota: { quantidade: 0, valor: 0, documentos: [] },
  duplicidades: [],
  temGuiaDoMes: true,
  saldoBanco: { peloRazao: 30_000, peloCadastro: 30_000, temFeed: true },
  totalLancamentos: 42,
  despesaTotal: 20_000,
});

const ids = (r: ReturnType<typeof verificarFechamento>) => r.ocorrencias.map((o) => o.id);

describe('fechamento: mês sem pendência', () => {
  it('fecha e não inventa ocorrência', () => {
    const r = verificarFechamento(mesLimpo());
    expect(r.podeFechar).toBe(true);
    expect(r.ocorrencias).toEqual([]);
    expect(r.resumo).toMatch(/sem pendências/);
  });
});

describe('fechamento: bloqueios', () => {
  it('razão que não fecha bloqueia', () => {
    const r = verificarFechamento({ ...mesLimpo(), razao: { debito: 100_000, credito: 99_999.9 } });
    expect(r.podeFechar).toBe(false);
    expect(ids(r)).toContain('razao_nao_fecha');
  });

  it('receita sem nota bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      receitaSemNota: { quantidade: 2, valor: 8_000, documentos: ['a', 'b'] },
    });
    expect(r.podeFechar).toBe(false);
    expect(r.bloqueios[0]!.detalhe).toMatch(/16\.0% da receita/);
  });

  it('receita sem guia provisionada bloqueia', () => {
    const r = verificarFechamento({ ...mesLimpo(), temGuiaDoMes: false });
    expect(r.podeFechar).toBe(false);
    expect(ids(r)).toContain('guia_nao_provisionada');
  });

  it('mas sem receita não exige guia', () => {
    const r = verificarFechamento({ ...mesLimpo(), receita: 0, temGuiaDoMes: false });
    expect(ids(r)).not.toContain('guia_nao_provisionada');
  });

  it('saldo do razão divergente do banco bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      saldoBanco: { peloRazao: 30_000, peloCadastro: 28_500, temFeed: true },
    });
    expect(r.podeFechar).toBe(false);
    expect(r.bloqueios[0]!.detalhe).toMatch(/1\.500,00/);
  });
});

describe('fechamento: classificação pesa por valor, não por contagem', () => {
  /**
   * Vinte cafés sem categoria não impedem um fechamento; uma folha de
   * pagamento sozinha impede. Contar documentos trataria os dois casos igual.
   */
  it('muitos lançamentos pequenos são atenção, não bloqueio', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      aClassificar: { quantidade: 20, valor: 500, documentos: [] },
      despesaTotal: 20_000,
    });
    expect(r.podeFechar).toBe(true);
    expect(r.atencoes.map((a) => a.id)).toContain('sem_classificacao');
  });

  it('um lançamento grande bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      aClassificar: { quantidade: 1, valor: 9_000, documentos: ['x'] },
      despesaTotal: 20_000,
    });
    expect(r.podeFechar).toBe(false);
  });

  it('exatamente no limite já bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      aClassificar: { quantidade: 1, valor: 20_000 * LIMITE_SEM_CLASSIFICACAO, documentos: ['x'] },
      despesaTotal: 20_000,
    });
    expect(r.podeFechar).toBe(false);
  });
});

describe('fechamento: atenções não bloqueiam', () => {
  it('extrato não conciliado é atenção', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      extratoPendente: { quantidade: 3, valor: 4_200 },
    });
    expect(r.podeFechar).toBe(true);
    expect(ids(r)).toContain('extrato_nao_conciliado');
  });

  /**
   * Duas parcelas iguais no mesmo dia são legítimas com frequência. Acusar
   * como erro treinaria o usuário a ignorar o aviso — o pior resultado
   * possível para um alerta.
   */
  it('duplicidade provável é atenção, não acusação', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      duplicidades: [{ descricao: 'Aluguel', valor: 1_500, ids: ['a', 'b'] }],
    });
    expect(r.podeFechar).toBe(true);
    expect(r.atencoes.map((a) => a.id)).toContain('possivel_duplicidade');
  });

  it('mês sem movimento é atenção — dado que não chegou, não empresa parada', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      totalLancamentos: 0,
      receita: 0,
      despesaTotal: 0,
    });
    expect(r.podeFechar).toBe(true);
    expect(ids(r)).toContain('mes_sem_movimento');
  });

  it('sem conta bancária, avisa que nada confronta a escrituração', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      saldoBanco: { peloRazao: 30_000, peloCadastro: null, temFeed: false },
    });
    expect(r.podeFechar).toBe(true);
    expect(ids(r)).toContain('saldo_banco_sem_fonte');
  });

  /**
   * `bank_account.current_balance` é digitado uma vez e nunca atualizado.
   * Bloquear contra ele travaria TODO fechamento para sempre — e um bloqueio
   * que sempre aparece é um bloqueio que todo mundo aprende a ignorar,
   * inclusive nos dias em que ele estiver certo.
   */
  it('saldo digitado sem extrato ligado NÃO bloqueia, por mais que divirja', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      saldoBanco: { peloRazao: 653_450, peloCadastro: 0, temFeed: false },
    });
    expect(r.podeFechar).toBe(true);
    expect(ids(r)).toContain('saldo_banco_sem_fonte');
    expect(ids(r)).not.toContain('saldo_divergente');
  });

  it('com extrato ligado, a mesma divergência bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      saldoBanco: { peloRazao: 653_450, peloCadastro: 0, temFeed: true },
    });
    expect(r.podeFechar).toBe(false);
    expect(ids(r)).toContain('saldo_divergente');
  });
});

describe('fechamento: a decisão é mecânica', () => {
  it('um bloqueio entre muitas atenções ainda bloqueia', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      extratoPendente: { quantidade: 9, valor: 1_000 },
      duplicidades: [{ descricao: 'x', valor: 10, ids: ['a'] }],
      temGuiaDoMes: false,
    });
    expect(r.atencoes.length).toBeGreaterThanOrEqual(2);
    expect(r.podeFechar).toBe(false);
    expect(r.resumo).toMatch(/NÃO pode fechar/);
  });

  it('toda ocorrência diz o que fazer a respeito', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      razao: { debito: 1, credito: 2 },
      aClassificar: { quantidade: 3, valor: 9_000, documentos: [] },
      extratoPendente: { quantidade: 1, valor: 5 },
      receitaSemNota: { quantidade: 1, valor: 100, documentos: [] },
      duplicidades: [{ descricao: 'x', valor: 10, ids: ['a'] }],
      temGuiaDoMes: false,
      saldoBanco: { peloRazao: 1, peloCadastro: 2, temFeed: true },
      totalLancamentos: 0,
    });
    expect(r.ocorrencias.length).toBeGreaterThanOrEqual(7);
    for (const o of r.ocorrencias) {
      expect(o.acao, o.id).toBeTruthy();
      expect(o.detalhe.length, o.id).toBeGreaterThan(20);
    }
  });
});

describe('quem resolve o quê', () => {
  /**
   * O cliente é profissional autônomo: entende do negócio dele, não de
   * contabilidade. Ele faz UMA coisa — lança. Tudo que a IA conseguir resolver
   * a partir do lançamento, ela resolve, e ele nunca fica sabendo.
   */
  it('classificação e imposto são resolvidos pela IA, sem pedir nada ao cliente', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      aClassificar: { quantidade: 30, valor: 18_000, documentos: [] },
      temGuiaDoMes: false,
    });

    expect(r.podeFechar).toBe(false);
    expect(r.resolverSozinha.map((o) => o.id).sort()).toEqual([
      'guia_nao_provisionada',
      'sem_classificacao',
    ]);
    // Nada disso chega ao cliente.
    expect(r.recadoAoCliente).toBeNull();
  });

  /**
   * A única pergunta que nenhuma IA responde: esse dinheiro entrou com nota ou
   * sem? Só quem prestou o serviço sabe.
   */
  it('receita sem nota é a pergunta que só o cliente responde', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      receitaSemNota: { quantidade: 1, valor: 4_000, documentos: ['x'] },
    });

    expect(r.precisaDoCliente.map((o) => o.id)).toEqual(['receita_sem_nota']);
    expect(r.recadoAoCliente).toMatch(/emitiu a nota/);
    // E a mensagem não usa uma palavra de contador.
    for (const termo of ['categoria', 'partida', 'competência', 'débito', 'crédito', 'conta contábil']) {
      expect(r.recadoAoCliente!.toLowerCase()).not.toContain(termo);
    }
  });

  /** Avisar por avisar treina o cliente a ignorar todo aviso. */
  it('pendência que não bloqueia não vira recado', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      duplicidades: [{ descricao: 'Aluguel', valor: 1_500, ids: ['a', 'b'] }],
      totalLancamentos: 0,
      receita: 0,
      despesaTotal: 0,
    });
    expect(r.precisaDoCliente.length).toBeGreaterThan(0);
    expect(r.recadoAoCliente).toBeNull();
  });

  it('mês limpo não pede nada e não resolve nada', () => {
    const r = verificarFechamento(mesLimpo());
    expect(r.resolverSozinha).toEqual([]);
    expect(r.precisaDoCliente).toEqual([]);
    expect(r.recadoAoCliente).toBeNull();
  });

  it('toda ocorrência que precisa do cliente tem mensagem na língua dele', () => {
    const r = verificarFechamento({
      ...mesLimpo(),
      receitaSemNota: { quantidade: 1, valor: 100, documentos: [] },
      duplicidades: [{ descricao: 'x', valor: 10, ids: ['a'] }],
      saldoBanco: { peloRazao: 1, peloCadastro: 2, temFeed: true },
      totalLancamentos: 0,
    });
    for (const o of r.precisaDoCliente) {
      expect(o.mensagemCliente, o.id).toBeTruthy();
      expect(o.mensagemCliente!.length, o.id).toBeGreaterThan(30);
    }
  });
});
