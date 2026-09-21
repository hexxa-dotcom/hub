/**
 * O PREÇO QUE VAI NA FATURA DO CLIENTE.
 *
 * Havia três lugares somando isto à mão — a fatura mensal, a lista de clientes
 * e a ficha do cliente. Três cópias da mesma conta é como um cliente acaba
 * vendo um valor na tela e outro no boleto.
 *
 * São duas formas de acordo, e a ordem entre elas importa:
 *
 * 1. **Valor combinado** (`customValue`): o honorário é aquele, ponto. Não é
 *    tabela nem desconto, e não sobe quando a tabela sobe.
 * 2. **Tabela menos abatimento**: o acordo é "R$ 100 a menos" sobre o plano,
 *    qualquer que ele seja. Um reajuste da tabela alcança o cliente sozinho.
 *
 * O combinado vence porque é mais específico. Nunca devolve negativo: fatura
 * negativa seria pagar o cliente para atendê-lo.
 */
/**
 * Os três valores chegam como texto quando vêm do banco — `numeric` do
 * Postgres é string em JavaScript, e converter em cada chamada é justamente
 * onde um `Number(undefined)` vira `NaN` sem ninguém notar. Aceitar os dois
 * aqui deixa a conversão num lugar só.
 */
type Dinheiro = number | string | null | undefined;

export interface Honorarios {
  /** Preço de tabela do plano. */
  valorDoPlano: Dinheiro;
  /** Abatimento combinado sobre a tabela, em reais. */
  desconto?: Dinheiro;
  /** Honorário combinado caso a caso — quando existe, é o preço. */
  valorCombinado?: Dinheiro;
}

export function valorDosHonorarios(h: Honorarios): number {
  const combinado = Number(h.valorCombinado ?? NaN);
  if (Number.isFinite(combinado)) return Math.max(0, combinado);
  return Math.max(0, Number(h.valorDoPlano ?? 0) - Number(h.desconto ?? 0));
}

/**
 * Como o preço se explica na fatura.
 *
 * O cliente precisa ver de onde veio o número. Um abatimento aparece com o
 * preço cheio ao lado — é o que mostra o benefício e o que impede um desconto
 * esquecido de virar, sem ninguém notar, o preço da tabela. Um valor combinado
 * não tem "preço cheio" para mostrar, então não finge ter.
 */
export function descricaoDosHonorarios(
  h: Honorarios & { plano: string; motivoDoDesconto?: string | null },
): string {
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (Number.isFinite(Number(h.valorCombinado ?? NaN))) {
    return `Honorários Contábeis — ${h.plano} (valor combinado)`;
  }
  const desconto = Number(h.desconto ?? 0);
  if (desconto > 0) {
    return (
      `Honorários Contábeis — ${h.plano} ${brl(Number(h.valorDoPlano))} − desconto ${brl(desconto)}` +
      (h.motivoDoDesconto ? ` (${h.motivoDoDesconto})` : '')
    );
  }
  return `Honorários Contábeis — ${h.plano}`;
}
