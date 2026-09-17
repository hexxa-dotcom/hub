import 'server-only';
import { getDb, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * INFORME DE RENDIMENTOS DO SÓCIO.
 *
 * O sócio usa este documento para preencher o IRPF dele. Isso muda tudo sobre
 * como ele precisa ser construído: um informe incompleto não é um relatório
 * fraco, é uma declaração errada entregue à Receita — e o problema vira do
 * sócio, não nosso.
 *
 * Por isso o documento declara com todas as letras O QUE ele cobre e o que
 * não cobre. Duas fontes, com confiabilidade muito diferente:
 *
 * - **Lucros distribuídos**: são fatos registrados, com data e valor, e estão
 *   escriturados no razão (partida contra Lucros Acumulados). São confiáveis.
 *
 * - **Pró-labore**: `partner.pro_labore` é um valor MENSAL CONFIGURADO, usado
 *   para calcular o Fator R. Não é registro de pagamento. Multiplicá-lo por 12
 *   e chamar de rendimento tributável seria afirmar pagamentos que ninguém
 *   registrou — e o sócio declararia à Receita um número que o sistema
 *   inventou. Então o informe NÃO inclui pró-labore, e diz isso.
 */

export interface LinhaDistribuicao {
  data: string;
  valor: number;
  observacao: string | null;
}

export interface InformeDoSocio {
  socio: { id: string; nome: string; cpf: string | null; participacao: number };
  /** Lucros distribuídos no ano — rendimento isento e não tributável. */
  totalDistribuido: number;
  lancamentos: LinhaDistribuicao[];
  /**
   * `true` quando há pró-labore configurado para este sócio. O informe não o
   * inclui, e precisa avisar — senão o sócio pensa que o documento é completo.
   */
  temProLaboreConfigurado: boolean;
  /**
   * Recebeu distribuição mas não está no cadastro de sócios. O informe dele
   * sai sem CPF, e CPF é obrigatório no IRPF — então isso precisa aparecer
   * como pendência, não ser escondido.
   */
  naoCadastrado: boolean;
}

export interface InformeDeRendimentos {
  ano: number;
  empresa: { razaoSocial: string; cnpj: string; regime: string };
  socios: InformeDoSocio[];
  totalGeral: number;
  /** Anos com distribuição registrada, para o seletor da tela. */
  anosDisponiveis: number[];
}

export async function getInformeDeRendimentos(
  ctx: TenantContext,
  ano?: number,
): Promise<InformeDeRendimentos> {
  const db = getDb();

  const [emp] = (await db.execute(sql`
    SELECT legal_name, cnpj, tax_regime::text AS regime
    FROM company WHERE id = ${ctx.companyId}
  `)) as unknown as Record<string, string>[];

  const anosRows = (await db.execute(sql`
    SELECT DISTINCT reference_year AS ano
    FROM profit_distribution
    WHERE company_id = ${ctx.companyId}
    ORDER BY 1 DESC
  `)) as unknown as { ano: number }[];

  const anosDisponiveis = anosRows.map((r) => Number(r.ano));
  const anoAlvo = ano ?? anosDisponiveis[0] ?? new Date().getFullYear();

  interface SocioRow {
    id: string;
    name: string;
    cpf: string | null;
    ownership_pct: string;
    pro_labore: string;
  }

  const socios = (await db.execute(sql`
    SELECT id::text, name, cpf, ownership_pct, pro_labore
    FROM partner WHERE company_id = ${ctx.companyId}
    ORDER BY name
  `)) as unknown as SocioRow[];

  const distribuicoes = (await db.execute(sql`
    SELECT
      partner_id::text AS partner_id,
      partner_name,
      to_char(distributed_at, 'YYYY-MM-DD') AS data,
      amount,
      notes
    FROM profit_distribution
    WHERE company_id = ${ctx.companyId} AND reference_year = ${anoAlvo}
    ORDER BY distributed_at
  `)) as unknown as Record<string, string>[];

  /**
   * Distribuição sem `partner_id` existe: a coluna nasceu depois, e registros
   * antigos só têm o nome do beneficiário. Casar pelo nome é a única forma de
   * não perder esses lançamentos — e perder um lançamento aqui significaria o
   * sócio declarar menos do que recebeu.
   */
  const porSocio = new Map<string, LinhaDistribuicao[]>();
  // Beneficiário sem cadastro é agrupado POR NOME, nunca num balde só.
  //
  // A primeira versão juntava todos numa linha "não cadastrado". Num Informe
  // de Rendimentos isso é perigoso: cada beneficiário usa o documento no IRPF
  // DELE, e somar João com Maria numa linha de R$ 42 mil produziria um papel
  // que, se impresso, faria os dois declararem errado.
  const porNomeSemCadastro = new Map<string, LinhaDistribuicao[]>();

  for (const d of distribuicoes) {
    const linha: LinhaDistribuicao = {
      data: String(d.data),
      valor: Number(d.amount),
      observacao: (d.notes as string | null) ?? null,
    };

    const porId = d.partner_id ? socios.find((s) => s.id === d.partner_id) : undefined;
    const porNome = porId
      ? undefined
      : socios.find(
          (s) => s.name.trim().toLowerCase() === String(d.partner_name).trim().toLowerCase(),
        );
    const alvo = porId ?? porNome;

    if (!alvo) {
      const nome = String(d.partner_name).trim();
      const atual = porNomeSemCadastro.get(nome) ?? [];
      atual.push(linha);
      porNomeSemCadastro.set(nome, atual);
      continue;
    }
    const atual = porSocio.get(alvo.id) ?? [];
    atual.push(linha);
    porSocio.set(alvo.id, atual);
  }

  const linhasSocios: InformeDoSocio[] = socios.map((s) => {
    const lancamentos = porSocio.get(s.id) ?? [];
    return {
      socio: {
        id: s.id,
        nome: s.name,
        cpf: s.cpf ?? null,
        participacao: Number(s.ownership_pct ?? 0),
      },
      totalDistribuido: lancamentos.reduce((acc, l) => acc + l.valor, 0),
      lancamentos,
      temProLaboreConfigurado: Number(s.pro_labore ?? 0) > 0,
      naoCadastrado: false,
    };
  });

  // Cada beneficiário sem cadastro vira uma seção própria, com o nome dele.
  for (const [nome, lancamentos] of porNomeSemCadastro) {
    linhasSocios.push({
      socio: { id: `sem-cadastro:${nome}`, nome, cpf: null, participacao: 0 },
      totalDistribuido: lancamentos.reduce((acc, l) => acc + l.valor, 0),
      lancamentos,
      temProLaboreConfigurado: false,
      naoCadastrado: true,
    });
  }

  return {
    ano: anoAlvo,
    empresa: {
      razaoSocial: String(emp?.legal_name ?? ''),
      cnpj: String(emp?.cnpj ?? ''),
      regime: String(emp?.regime ?? ''),
    },
    socios: linhasSocios,
    totalGeral: linhasSocios.reduce((acc, s) => acc + s.totalDistribuido, 0),
    anosDisponiveis: anosDisponiveis.length ? anosDisponiveis : [anoAlvo],
  };
}
