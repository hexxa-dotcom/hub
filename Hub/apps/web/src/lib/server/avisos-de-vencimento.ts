import 'server-only';
import { getDb, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { listarDocumentos, checklist, extrasDosDocumentos, diasAte } from './documentos-da-empresa';

/**
 * AVISO DE DOCUMENTO VENCENDO — o sino avisa antes de vencer.
 *
 * O Início já mostra o documento vencendo, mas só para quem entra. Esta
 * rotina diária avisa no sino, uma vez em cada marco: faltando 30, 15 e 7
 * dias, e no dia em que vence. Vale para o essencial que tem validade
 * (alvará, certidões) e para o certificado digital — sem ele a nota não sai.
 *
 * Cada aviso fica registrado (`aviso_de_vencimento`) para não repetir; o
 * documento renovado tem validade nova e volta a ser acompanhado.
 */

const MARCOS = [30, 15, 7] as const;
const br = (iso: string) => iso.split('-').reverse().join('/');

/** O marco em que o documento está: 0 = vencido; 7, 15 ou 30 dias; null = longe ainda. */
function marcoDe(dias: number): number | null {
  if (dias < 0) return 0;
  return MARCOS.slice().reverse().find((m) => dias <= m) ?? null;
}

interface Acompanhado {
  item: string;
  nome: string;
  validade: string;
  href: string;
  comoRenovar: string;
}

/** `simular`: só diz o que avisaria, sem gravar nada. */
export async function rodarAvisosDeVencimento(simular = false): Promise<{ empresas: number; avisos: number; erros: string[]; seriam?: string[] }> {
  const db = getDb();
  const empresas = (await db.execute(sql`SELECT id::text, type FROM company WHERE closed_at IS NULL`)) as unknown as { id: string; type: string }[];
  const out = { empresas: empresas.length, avisos: 0, erros: [] as string[], seriam: [] as string[] };

  for (const e of empresas) {
    const ctx = { companyId: e.id, companyType: e.type, userId: 'rotina' } as TenantContext;
    try {
      const [docs, extras] = await Promise.all([listarDocumentos(ctx), extrasDosDocumentos(ctx)]);
      const acompanhados: Acompanhado[] = checklist(docs)
        .filter((i) => i.documento?.validoAte)
        .map((i) => ({
          item: i.categoria,
          nome: i.nome,
          validade: i.documento!.validoAte!,
          href: '/minha-contabilidade/arquivos',
          comoRenovar: i.servico ? `Peça a renovação à contabilidade em Serviços Adicionais (${i.servico}).` : i.comoObter,
        }));
      if (extras.certificado.validoAte) {
        acompanhados.push({
          item: 'CERTIFICADO',
          nome: 'Certificado digital',
          validade: extras.certificado.validoAte.slice(0, 10),
          href: '/configuracoes/fiscal',
          comoRenovar: 'Sem ele a nota fiscal não é emitida. Renove com a certificadora e envie o novo em Configurações > Fiscal.',
        });
      }

      for (const a of acompanhados) {
        const dias = diasAte(a.validade);
        const marco = marcoDe(dias);
        if (marco === null) continue;
        if (simular) {
          out.seriam.push(`${e.id} · ${a.nome} · ${br(a.validade)} · ${dias} dias`);
          continue;
        }
        const novo = (await db.execute(sql`
          INSERT INTO aviso_de_vencimento (company_id, item, validade, marco)
          VALUES (${e.id}, ${a.item}, ${a.validade}::date, ${marco})
          ON CONFLICT DO NOTHING RETURNING 1
        `)) as unknown as unknown[];
        if (!novo.length) continue;
        const titulo = marco === 0 ? `${a.nome} vencido` : `${a.nome} vence em ${dias === 1 ? '1 dia' : `${dias} dias`}`;
        await db.execute(sql`
          INSERT INTO notification (company_id, severity, title, body)
          VALUES (${e.id}, ${marco === 0 ? 'URGENT' : marco === 7 ? 'WARNING' : 'INFO'}, ${titulo},
                  ${`${marco === 0 ? 'Venceu' : 'Vale até'} ${br(a.validade)}. ${a.comoRenovar}`})
        `);
        out.avisos++;
      }
    } catch (err) {
      out.erros.push(`${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}
