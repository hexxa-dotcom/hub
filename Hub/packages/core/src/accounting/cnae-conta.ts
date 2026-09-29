/**
 * CNAE DA OUTRA PARTE → CONTA DE DESPESA.
 *
 * O Pix a uma empresa traz o CNPJ no histórico; o cartão do CNPJ diz a
 * atividade dela (CNAE, tabela oficial do IBGE). Quem pagou um restaurante
 * teve despesa com alimentação; quem pagou uma empresa de software, com
 * software. É referência pública, igual para todo cliente — vira regra fixa
 * antes da IA, e contexto para ela no que a tabela não cobre.
 *
 * Só SAÍDAS. Entrada de empresa sem nota já tem destino (receita de serviço).
 *
 * Regra do mais específico: classe de 4 dígitos antes da divisão de 2.
 * CNAE ambíguo para uma empresa de serviços (intermediadores de pagamento,
 * administração pública, saúde, associações) fica de fora de propósito:
 * errar aqui vira regra errada em todo cliente.
 *
 * Códigos das contas: categorias do Anexo 7 da ITG 1000 (categorias-padrao.ts).
 */

const ALIMENTACAO = '3.3.2.02.16';
const CONSUMO = '3.3.2.02.17';
const VIAGENS = '3.3.2.02.18';
const COMBUSTIVEIS = '3.3.2.02.19';
const SERVICOS = '3.3.2.02.06';
const SOFTWARE = '3.3.2.02.15';
const PUBLICIDADE = '3.3.1.02.02';
const PROMOCIONAL = '3.3.1.02.03';
const TELEFONE = '3.3.2.02.09';
const CORREIOS = '3.3.2.02.10';
const ENERGIA = '3.3.2.02.07';
const AGUA = '3.3.2.02.08';
const ALUGUEL = '3.3.2.02.01';
const SEGUROS = '3.3.2.02.11';
const BANCARIAS = '3.4.1.01.02';
const VEICULOS = '3.3.2.02.03';
const PEQUENO_VALOR = '3.3.2.02.13';
const ESCRITORIO = '3.3.2.02.14';
const TREINAMENTO = '3.3.2.01.11';

/** Classes (4 dígitos) — têm prioridade sobre a divisão. */
const POR_CLASSE: Record<string, string> = {
  // Varejo: combustível, informática e papelaria têm conta própria.
  '4731': COMBUSTIVEIS,
  '4732': COMBUSTIVEIS,
  '4751': PEQUENO_VALOR,
  '4752': PEQUENO_VALOR,
  '4753': PEQUENO_VALOR,
  '4761': ESCRITORIO,
  // Gráfica: material impresso da empresa.
  '1811': PROMOCIONAL,
  '1812': PROMOCIONAL,
  '1813': PROMOCIONAL,
  '1821': PROMOCIONAL,
  // Transporte de passageiros (táxi, aplicativo, ônibus) é viagem; carga é serviço.
  '4921': VIAGENS,
  '4922': VIAGENS,
  '4923': VIAGENS,
  '4929': VIAGENS,
  // Veículos: manutenção e peças.
  '4520': VEICULOS,
  '4530': VEICULOS,
  // Atividades auxiliares de seguros e previdência.
  '6621': SEGUROS,
  '6622': SEGUROS,
};

/** Divisões (2 dígitos). */
const POR_DIVISAO: Record<string, string> = {
  '10': ALIMENTACAO, '11': ALIMENTACAO,
  '35': ENERGIA,
  '36': AGUA, '37': AGUA,
  '46': CONSUMO, // atacado (Komprão: 4691)
  '47': CONSUMO, // varejo (supermercado, padaria, farmácia) — copa, limpeza, consumo
  '49': SERVICOS, '50': VIAGENS, '51': VIAGENS,
  '53': CORREIOS,
  '55': VIAGENS, // hospedagem
  '56': ALIMENTACAO, // restaurantes, lanchonetes (Vitrine: 5611)
  '58': SOFTWARE, // edição (inclui software)
  '59': SERVICOS, // audiovisual (Jackson: 5912)
  '60': PUBLICIDADE,
  '61': TELEFONE,
  '62': SOFTWARE, // desenvolvimento de software (M4: 6201)
  '63': SOFTWARE, // hospedagem, portais
  '64': BANCARIAS,
  '65': SEGUROS,
  '68': ALUGUEL,
  '69': SERVICOS, // advocacia, contabilidade
  '70': SERVICOS, '71': SERVICOS, '72': SERVICOS, '74': SERVICOS, '78': SERVICOS,
  '73': PUBLICIDADE, // publicidade (Facebook: 7312)
  '77': ALUGUEL, // aluguel de máquinas e equipamentos
  '79': VIAGENS, // agências de viagem
  '80': SERVICOS, '81': SERVICOS, '82': SERVICOS, // vigilância, limpeza, apoio administrativo
  '85': TREINAMENTO, // educação
  '95': SERVICOS, // reparação de equipamentos
};

/** Conta de despesa pelo CNAE de quem recebeu. Null = a tabela não sabe; segue para a IA. */
export function contaPorCnae(cnae: string | null | undefined): string | null {
  const c = (cnae ?? '').replace(/\D/g, '');
  if (c.length < 4) return null;
  return POR_CLASSE[c.slice(0, 4)] ?? POR_DIVISAO[c.slice(0, 2)] ?? null;
}
