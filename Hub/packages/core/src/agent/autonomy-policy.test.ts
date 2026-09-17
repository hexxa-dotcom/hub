import { describe, it, expect } from 'vitest';
import { decidirAutonomia, reguaCompleta, CONFIANCA_MINIMA_AUTO, type ActionKind } from './autonomy-policy';

const ALTA = 0.95;

describe('régua de autonomia', () => {
  it('classificar despesa pequena com boa evidência roda sozinho', () => {
    const d = decidirAutonomia('CLASSIFICAR_LANCAMENTO', 120, ALTA);
    expect(d.autonomy).toBe('AUTO');
  });

  it('valor acima do limite sobe um degrau', () => {
    const d = decidirAutonomia('CLASSIFICAR_LANCAMENTO', 50_000, ALTA);
    expect(d.autonomy).toBe('REVIEW');
    expect(d.motivo).toMatch(/acima do limite/);
  });

  /**
   * O ponto central da régua: o que decide é o custo de errar, não o quanto o
   * modelo acha que acertou.
   */
  it('emitir NFSe exige aprovação mesmo com confiança máxima e valor baixo', () => {
    const d = decidirAutonomia('EMITIR_NFSE', 50, 1);
    expect(d.autonomy).toBe('APPROVAL');
  });

  it('pagar guia exige aprovação — move dinheiro para fora', () => {
    expect(decidirAutonomia('PAGAR_GUIA', 10, 1).autonomy).toBe('APPROVAL');
  });

  it('distribuir lucro exige aprovação, qualquer valor', () => {
    expect(decidirAutonomia('DISTRIBUIR_LUCRO', 1, 1).autonomy).toBe('APPROVAL');
  });

  it('confiança baixa aperta a régua', () => {
    const d = decidirAutonomia('CLASSIFICAR_LANCAMENTO', 100, 0.4);
    expect(d.autonomy).toBe('REVIEW');
    expect(d.motivo).toMatch(/confiança medida/);
  });

  /**
   * A assimetria que impede o modelo de comprar a própria liberdade: confiança
   * alta nunca afrouxa a régua, só a confiança baixa aperta.
   */
  it('confiança alta NÃO afrouxa um teto de aprovação', () => {
    for (const c of [0.9, 0.99, 1]) {
      expect(decidirAutonomia('EMITIR_NFSE', 100, c).autonomy).toBe('APPROVAL');
      // FECHAR_MES saiu daqui: trancar o mês para o cliente é reversível e
      // interno, então virou REVIEW. Quem herdou o papel de ação externa e
      // irreversível do fechamento é LIBERAR_CONTABIL.
      expect(decidirAutonomia('LIBERAR_CONTABIL', null, c).autonomy).toBe('APPROVAL');
    }
  });

  it('confiança exatamente no limiar ainda é automática', () => {
    expect(decidirAutonomia('CLASSIFICAR_LANCAMENTO', 10, CONFIANCA_MINIMA_AUTO).autonomy).toBe('AUTO');
  });

  it('ação desconhecida cai em aprovação, não em automático', () => {
    const d = decidirAutonomia('FAZER_QUALQUER_COISA' as ActionKind, 10, 1);
    expect(d.autonomy).toBe('APPROVAL');
    expect(d.motivo).toMatch(/não está na régua/);
  });

  it('escriturar é automático em qualquer valor — o razão só aceita partida que fecha', () => {
    expect(decidirAutonomia('ESCRITURAR', 900_000, ALTA).autonomy).toBe('AUTO');
  });

  it('nenhuma ação que move dinheiro para fora é automática', () => {
    const irreversiveis: ActionKind[] = ['PAGAR_GUIA', 'DISTRIBUIR_LUCRO', 'EMITIR_NFSE', 'CANCELAR_NFSE'];
    for (const k of irreversiveis) {
      expect(decidirAutonomia(k, 0, 1).autonomy, k).toBe('APPROVAL');
    }
  });

  it('toda ação da régua tem justificativa escrita', () => {
    for (const r of reguaCompleta()) {
      expect(r.porque.length, r.kind).toBeGreaterThan(30);
    }
  });
});

describe('os dois fechamentos', () => {
  /**
   * Trancar o mês para o cliente é reversível e interno. Exigir aprovação para
   * isso deixaria o cliente esperando alguém destravar o mês dele para voltar
   * a trabalhar — que é o oposto de uma ferramenta que simplifica.
   */
  it('fechar o mês a IA faz sozinha, com revisão posterior', () => {
    const d = decidirAutonomia('FECHAR_MES', 500_000, ALTA);
    expect(d.autonomy).toBe('REVIEW');
  });

  /**
   * Liberar para o contábil sai do sistema e não volta. É o contador quem
   * assina o balanço — o cliente não pode aprovar o que não sabe avaliar.
   */
  it('liberar para a contabilidade oficial sempre exige aprovação', () => {
    for (const c of [0.5, 0.9, 1]) {
      expect(decidirAutonomia('LIBERAR_CONTABIL', null, c).autonomy).toBe('APPROVAL');
    }
  });

  it('reabrir mês fechado exige aprovação — muda número já apresentado', () => {
    expect(decidirAutonomia('REABRIR_MES', null, 1).autonomy).toBe('APPROVAL');
  });
});
