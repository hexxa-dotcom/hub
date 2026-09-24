/**
 * OS MODELOS DE CONTRATO.
 *
 * Cada modelo é uma lista de cláusulas montada a partir dos dados do
 * contrato. O texto é fixo e revisável aqui — nunca gerado por IA a cada
 * contrato. A IA só ajuda a redigir o objeto (a descrição do serviço).
 *
 * Base: Código Civil, arts. 593 a 609 (prestação de serviço); Lei 13.709/2018
 * (LGPD); MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020 (validade da
 * assinatura eletrônica entre particulares).
 *
 * IMPORTANTE: são modelos de referência de mercado. Antes de chamá-los de
 * "validados", passam pela revisão de um advogado.
 */

import { CATEGORY_CLAUSES } from './StandardContractTemplate';
import { MODELOS, INDICES, type ModeloDeContrato, type IndiceDeReajuste } from './modelos-info';
export { MODELOS, INDICES, type ModeloDeContrato, type IndiceDeReajuste };

export interface Parte {
  nome: string;
  documento: string;
  endereco: string;
}

export interface DadosDoContrato {
  modelo: ModeloDeContrato;
  categoria?: string;
  contratante: Parte;
  contratada: Parte;
  objeto: string;
  valorMensal: string; // "R$ 5.000,00"
  diaVencimento: number;
  formaPagamento: string;
  inicio: string; // dd/mm/aaaa
  fim: string;
  indice: IndiceDeReajuste;
  cidadeData: string;
}

export interface Clausula {
  titulo: string;
  itens: string[];
}

export function clausulasDoContrato(dados: DadosDoContrato): Clausula[] {
  // O objeto entra no meio de uma frase que já termina com ponto.
  const d = { ...dados, objeto: dados.objeto.trim().replace(/[.\s]+$/, '') };
  const c: Clausula[] = [];

  c.push({
    titulo: 'Do objeto',
    itens: [
      d.modelo === 'SOFTWARE'
        ? `O presente contrato tem por objeto a licença de uso, pela CONTRATANTE, do software ou plataforma da CONTRATADA e a prestação dos serviços associados: ${d.objeto}.`
        : `O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, dos seguintes serviços: ${d.objeto}.`,
      'Serviços não descritos acima dependem de acordo por escrito entre as partes, inclusive quanto ao preço.',
    ],
  });

  c.push({
    titulo: 'Da vigência',
    itens: [
      `Este contrato vigora de ${d.inicio} a ${d.fim}, podendo ser renovado por acordo entre as partes, inclusive por meio eletrônico.`,
    ],
  });

  c.push({
    titulo: 'Do preço e do pagamento',
    itens: [
      `Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor mensal de ${d.valorMensal}, com vencimento todo dia ${d.diaVencimento} de cada mês.`,
      `Forma de pagamento: ${d.formaPagamento}.`,
      'O pagamento fica condicionado à emissão da nota fiscal correspondente pela CONTRATADA, sendo de responsabilidade de cada parte os tributos que a lei lhe atribuir.',
      'O atraso no pagamento sujeita a CONTRATANTE a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês, calculados sobre o valor em atraso.',
    ],
  });

  c.push({
    titulo: 'Do reajuste',
    itens: [
      d.indice === 'NENHUM'
        ? 'O valor deste contrato não sofrerá reajuste automático durante a vigência; qualquer alteração dependerá de acordo por escrito entre as partes.'
        : `O valor será reajustado a cada 12 (doze) meses, contados do início da vigência, pela variação acumulada do ${INDICES[d.indice]} no período. Em caso de variação negativa, o valor será mantido.`,
    ],
  });

  c.push({
    titulo: 'Das obrigações das partes',
    itens: [
      'A CONTRATADA executará os serviços com zelo, técnica e qualidade compatíveis com as boas práticas do mercado, mantendo a CONTRATANTE informada sobre o andamento.',
      'A CONTRATANTE fornecerá as informações, os acessos e os documentos necessários à execução dos serviços e efetuará os pagamentos nos prazos acordados.',
    ],
  });

  if (d.modelo === 'PROJETO') {
    c.push({
      titulo: 'Das entregas e do aceite',
      itens: [
        'As entregas do projeto são as descritas no objeto. A CONTRATANTE terá 5 (cinco) dias úteis, contados de cada entrega, para aprová-la ou apontar por escrito os ajustes necessários; sem manifestação nesse prazo, a entrega considera-se aceita.',
        'Mudanças de escopo, novas entregas ou alterações de prazo dependem de aditivo acordado entre as partes, inclusive quanto ao preço.',
        'Atrasos causados pela falta de informações, acessos ou aprovações da CONTRATANTE prorrogam os prazos da CONTRATADA pelo mesmo período.',
      ],
    });
  }

  if (d.modelo === 'SOFTWARE') {
    c.push({
      titulo: 'Da licença de uso',
      itens: [
        'A licença é não exclusiva, intransferível e válida durante a vigência deste contrato, para uso pela CONTRATANTE e seus usuários autorizados, sendo vedados a revenda, a sublicença, a cópia e a engenharia reversa.',
        'O software, suas atualizações e a respectiva propriedade intelectual permanecem da CONTRATADA.',
      ],
    });
    c.push({
      titulo: 'Da disponibilidade, do suporte e dos dados',
      itens: [
        'A CONTRATADA empregará os melhores esforços para manter a plataforma disponível, avisando com antecedência as manutenções programadas, e prestará suporte em horário comercial pelos canais informados.',
        'Os dados inseridos pela CONTRATANTE pertencem a ela, que poderá exportá-los durante a vigência e em até 30 (trinta) dias após o término do contrato.',
        'A responsabilidade da CONTRATADA por eventuais danos fica limitada ao valor pago pela CONTRATANTE nos 12 (doze) meses anteriores ao fato, salvo dolo ou culpa grave.',
      ],
    });
  }

  if (d.modelo === 'PJ') {
    c.push({
      titulo: 'Da autonomia da contratada',
      itens: [
        'A CONTRATADA presta os serviços com autonomia técnica e organizacional, definindo a forma, os meios e os horários de execução, sem subordinação jurídica à CONTRATANTE e sem controle de jornada.',
        'Não há exclusividade: a CONTRATADA pode prestar serviços a terceiros, desde que não haja conflito com as obrigações de confidencialidade deste contrato.',
        'A CONTRATADA utiliza seus próprios equipamentos e ferramentas de trabalho e assume os riscos da sua atividade.',
        'Este contrato tem natureza estritamente civil (arts. 593 e seguintes do Código Civil) e não gera vínculo empregatício entre a CONTRATANTE e a CONTRATADA, seus sócios ou prepostos.',
      ],
    });
    c.push({
      titulo: 'Da propriedade intelectual',
      itens: [
        'Os resultados, documentos, códigos, peças e demais materiais produzidos especificamente para a CONTRATANTE no âmbito deste contrato passam a pertencer a ela após o respectivo pagamento, podendo a CONTRATADA mencioná-los em seu portfólio, salvo se houver informação confidencial.',
      ],
    });
  } else {
    c.push({
      titulo: 'Da natureza da contratação',
      itens: [
        'Este contrato tem natureza estritamente civil (arts. 593 e seguintes do Código Civil) e não gera vínculo empregatício, societário ou de subordinação entre as partes, seus sócios ou empregados.',
        d.modelo === 'FORNECEDOR'
          ? 'A CONTRATADA é a única responsável pelos encargos trabalhistas, previdenciários e fiscais de seus empregados e prepostos envolvidos na execução dos serviços.'
          : 'Cada parte responde pelos encargos trabalhistas, previdenciários e fiscais de seus próprios empregados e prepostos.',
      ],
    });
  }

  const categoria = d.categoria ? CATEGORY_CLAUSES[d.categoria] : undefined;
  if (categoria) {
    c.push({ titulo: categoria.heading.replace(/^DISPOSIÇÕES ESPECÍFICAS — /, 'Disposições específicas — ').toLowerCase().replace(/^./, (x) => x.toUpperCase()), itens: categoria.items });
  }

  c.push({
    titulo: 'Da confidencialidade e dos dados pessoais',
    itens: [
      'As partes manterão sigilo sobre as informações a que tiverem acesso em razão deste contrato, durante a vigência e por 2 (dois) anos após o seu término.',
      'Havendo tratamento de dados pessoais, as partes observarão a Lei Geral de Proteção de Dados (Lei 13.709/2018), tratando-os apenas para a execução deste contrato e adotando medidas de segurança adequadas.',
    ],
  });

  c.push({
    titulo: 'Da rescisão',
    itens: [
      'Qualquer das partes pode rescindir este contrato, sem multa, mediante aviso por escrito com 30 (trinta) dias de antecedência, sendo devidos os valores dos serviços prestados até a data do término.',
      'O descumprimento de qualquer cláusula permite a rescisão imediata pela parte prejudicada, sem prejuízo de perdas e danos.',
    ],
  });

  c.push({
    titulo: 'Da assinatura eletrônica',
    itens: [
      'As partes reconhecem como válida a assinatura deste contrato por meio eletrônico, nos termos do art. 10, § 2º, da MP 2.200-2/2001 e da Lei 14.063/2020, com o registro de data, hora e identificação de cada signatário.',
    ],
  });

  c.push({
    titulo: 'Do foro',
    itens: ['Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer questões oriundas deste contrato.'],
  });

  return c;
}
