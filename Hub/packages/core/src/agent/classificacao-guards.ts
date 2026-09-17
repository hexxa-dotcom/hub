/**
 * TRAVAS DA CLASSIFICAÇÃO POR IA.
 *
 * Separadas da chamada ao modelo de propósito: a chamada é rede, estas são
 * decisões — e são elas que impedem que a resposta de um LLM vire lançamento
 * contábil sem passar por nada.
 *
 * Um modelo pedido para classificar devolve com prazer uma categoria plausível
 * que não existe no plano. Também troca receita por despesa quando a descrição
 * é ambígua. As duas coisas o razão aceitaria sem reclamar: a partida fecharia
 * do mesmo jeito, só que na conta errada — e o erro só apareceria na DRE, meses
 * depois, sem ninguém saber de onde veio.
 */

export interface SugestaoBruta {
  id: string;
  categoria_id: string;
  justificativa?: string;
  confianca?: number;
}

export interface LancamentoPendente {
  id: string;
  tipo: 'PAYABLE' | 'RECEIVABLE';
}

export interface CategoriaDisponivel {
  id: string;
  nome: string;
  tipo: 'INCOME' | 'EXPENSE';
}

export interface SugestaoAceita {
  lancamentoId: string;
  categoriaId: string;
  categoriaNome: string;
  justificativa: string;
  autoavaliacao: number;
}

export interface Descarte {
  id: string;
  motivo: string;
}

export interface SugestoesValidadas {
  aceitas: SugestaoAceita[];
  descartados: Descarte[];
}

/**
 * Filtra as sugestões do modelo contra a realidade do banco.
 *
 * Descarta em vez de corrigir. "Corrigir" para a categoria mais parecida
 * transformaria uma alucinação numa classificação com aparência de deliberada
 * — e ela entraria no razão carregando a confiança de uma decisão que ninguém
 * tomou.
 */
export function validarSugestoes(
  sugestoes: SugestaoBruta[],
  pendentes: LancamentoPendente[],
  categorias: CategoriaDisponivel[],
): SugestoesValidadas {
  const porId = new Map(pendentes.map((p) => [p.id, p]));
  const catsPorId = new Map(categorias.map((c) => [c.id, c]));

  const aceitas: SugestaoAceita[] = [];
  const descartados: Descarte[] = [];
  const jaVistos = new Set<string>();

  for (const s of sugestoes) {
    const lanc = porId.get(s.id);
    if (!lanc) {
      descartados.push({ id: s.id, motivo: 'Lançamento não estava no lote enviado.' });
      continue;
    }

    // O modelo pode devolver o mesmo lançamento duas vezes com categorias
    // diferentes. A segunda não é uma opção alternativa — é contradição, e
    // aceitar qualquer uma das duas seria escolher por sorteio.
    if (jaVistos.has(s.id)) {
      descartados.push({ id: s.id, motivo: 'Modelo sugeriu duas categorias para o mesmo lançamento.' });
      continue;
    }

    const cat = catsPorId.get(s.categoria_id);
    if (!cat) {
      descartados.push({ id: s.id, motivo: `Categoria ${s.categoria_id} não existe no plano.` });
      continue;
    }

    const esperado = lanc.tipo === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
    if (cat.tipo !== esperado) {
      descartados.push({
        id: s.id,
        motivo: `Categoria "${cat.nome}" é ${cat.tipo}, mas o lançamento é ${lanc.tipo}.`,
      });
      continue;
    }

    jaVistos.add(s.id);
    aceitas.push({
      lancamentoId: lanc.id,
      categoriaId: cat.id,
      categoriaNome: cat.nome,
      justificativa: s.justificativa?.trim() || `Classificado como "${cat.nome}".`,
      // Confiança fora da faixa é sintoma de resposta malformada, não de
      // certeza extrema. Vale 0,5 — nem endossa nem pune.
      autoavaliacao:
        typeof s.confianca === 'number' && s.confianca >= 0 && s.confianca <= 1 ? s.confianca : 0.5,
    });
  }

  // Omissão é decisão do modelo, não falha: a instrução manda omitir quando
  // não dá para decidir com segurança. Registrar mostra quanto do lote ficou
  // para um humano — que é o número a acompanhar para saber se o agente está
  // ajudando ou empurrando trabalho adiante.
  const respondidos = new Set(sugestoes.map((s) => s.id));
  for (const p of pendentes) {
    if (!respondidos.has(p.id)) {
      descartados.push({ id: p.id, motivo: 'Modelo não teve segurança para classificar.' });
    }
  }

  return { aceitas, descartados };
}
