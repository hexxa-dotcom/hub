import { NextResponse } from 'next/server';
import { zipSync, strToU8 } from 'fflate';
import { fetchXmlDaNotaPorNsu } from '@hexxa/integrations';
import { withTenant, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { getCertForTenant, getNfseConfig } from '@/lib/server/fiscal';
import { resolveNfsePort } from '@/lib/server/container';
import { parseNfseXml } from '@/lib/server/danfse';
import { renderDanfsePdf } from '@/lib/server/danfse-pdf';
import { danfseDeExemplo } from '@/lib/server/danfse-exemplo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * BAIXAR NOTAS EM MASSA — as notas selecionadas em Notas, num .zip só.
 *
 * Para cada nota vão a DANFSe (PDF) e o XML oficial, em pastas separadas —
 * o XML é o documento fiscal; o PDF é o que se manda ao cliente. As notas do
 * Emissor Nacional vêm pela chave (XML buscado com o certificado), as da Hexx
 * ainda não sincronizadas pelo id. A que falhar não derruba o lote: fica
 * listada no LEIA-ME.txt.
 */

const LIMITE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nomeDeArquivo = (numero: string | null, parte: string | null, reserva: string) =>
  `NFSe ${numero ?? reserva}${parte ? ` - ${parte}` : ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  const corpo = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(corpo?.ids) ? Array.from(new Set(corpo.ids.filter((i): i is string => typeof i === 'string'))) : [];
  if (!ids.length) return NextResponse.json({ error: 'Selecione ao menos uma nota.' }, { status: 400 });
  if (ids.length > LIMITE) return NextResponse.json({ error: `Dá para baixar até ${LIMITE} notas de uma vez.` }, { status: 400 });

  const arquivos: Record<string, Uint8Array> = {};
  const falhas: string[] = [];
  const guardar = (nome: string, pdf: Uint8Array | null, xml: string | null) => {
    let n = nome;
    for (let i = 2; arquivos[`PDF/${n}.pdf`] || arquivos[`XML/${n}.xml`]; i++) n = `${nome} (${i})`;
    if (pdf) arquivos[`PDF/${n}.pdf`] = pdf;
    if (xml) arquivos[`XML/${n}.xml`] = strToU8(xml);
  };

  const chaves = ids.filter((i) => i !== 'exemplo' && !UUID.test(i));
  const daHexx = ids.filter((i) => UUID.test(i));

  // ── Emissor Nacional: pela chave, XML buscado pelo NSU ───────────────────
  if (chaves.length) {
    const docs = (await withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`
        SELECT DISTINCT ON (chave_acesso) chave_acesso, nsu, numero_nfse,
               CASE WHEN direction = 'RECEBIDA' THEN prestador_nome ELSE tomador_nome END AS parte,
               bool_or(cancelado) OVER (PARTITION BY chave_acesso) AS cancelada
          FROM nfse_distribuicao_doc
         WHERE company_id = ${ctx.companyId} AND chave_acesso IN (${sql.join(
           chaves.map((c) => sql`${c}`),
           sql`, `,
         )})
         ORDER BY chave_acesso, (tipo_documento = 'NFSE') DESC, nsu ASC`),
    )) as unknown as { chave_acesso: string; nsu: string; numero_nfse: string | null; parte: string | null; cancelada: boolean }[];

    const [cert, cfg] = await Promise.all([getCertForTenant(ctx), getNfseConfig(ctx)]);
    if (!cert || !cfg?.cnpj) {
      falhas.push(`${docs.length} nota(s) do Emissor Nacional: a empresa não tem certificado digital para buscar o XML.`);
    } else {
      // Poucas de cada vez: o Emissor Nacional não gosta de rajada.
      for (let i = 0; i < docs.length; i += 4) {
        await Promise.all(
          docs.slice(i, i + 4).map(async (d) => {
            const nome = nomeDeArquivo(d.numero_nfse, d.parte, d.chave_acesso);
            try {
              const xml = await fetchXmlDaNotaPorNsu(cert, cfg.ambiente, cfg.cnpj!, Number(d.nsu));
              if (!xml) throw new Error('o Emissor Nacional não devolveu o XML');
              const pdf = await renderDanfsePdf({ ...parseNfseXml(xml, d.chave_acesso), cancelada: Boolean(d.cancelada) });
              guardar(nome, new Uint8Array(pdf), xml);
            } catch (err) {
              falhas.push(`${nome}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }),
        );
      }
    }
    const achadas = new Set(docs.map((d) => d.chave_acesso));
    for (const c of chaves) if (!achadas.has(c)) falhas.push(`Nota ${c}: não encontrada nesta empresa.`);
  }

  // ── Emitidas pela Hexx que ainda não chegaram do Emissor Nacional ────────
  if (daHexx.length) {
    const notas = (await withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`
        SELECT s.id::text, s.provider_protocol, s.nfse_number, s.status::text AS status, c.name AS parte
          FROM service_invoice s LEFT JOIN customer c ON c.id = s.customer_id
         WHERE s.company_id = ${ctx.companyId} AND s.id IN (${sql.join(
           daHexx.map((i) => sql`${i}::uuid`),
           sql`, `,
         )})`),
    )) as unknown as { id: string; provider_protocol: string | null; nfse_number: string | null; status: string; parte: string | null }[];
    const port = await resolveNfsePort(ctx);
    for (const n of notas) {
      const nome = nomeDeArquivo(n.nfse_number, n.parte, n.id.slice(0, 8));
      try {
        if (!n.provider_protocol || !port.download) throw new Error('a nota ainda não foi autorizada');
        const xml = (await port.download(n.provider_protocol, 'xml')).toString('utf-8');
        const pdf = await renderDanfsePdf({ ...parseNfseXml(xml, n.provider_protocol), cancelada: n.status === 'CANCELED' });
        guardar(nome, new Uint8Array(pdf), xml);
      } catch (err) {
        falhas.push(`${nome}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (ids.includes('exemplo')) guardar('NFSe EXEMPLO - Cliente Exemplo Ltda', new Uint8Array(await danfseDeExemplo(ctx.companyId)), null);

  if (!Object.keys(arquivos).length) {
    return NextResponse.json({ error: falhas[0] ?? 'Nenhuma nota pôde ser baixada.' }, { status: 502 });
  }
  if (falhas.length) {
    arquivos['LEIA-ME.txt'] = strToU8(`Estas notas não vieram no arquivo — tente baixá-las de novo:\r\n\r\n${falhas.map((f) => `- ${f}`).join('\r\n')}\r\n`);
  }

  // PDF e XML já são comprimidos o bastante: nível baixo deixa o zip rápido.
  const zip = zipSync(arquivos, { level: 1 });
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="notas-${hoje}.zip"`,
      'X-Notas-Baixadas': String(Object.keys(arquivos).filter((k) => k.startsWith('PDF/')).length),
      'X-Notas-Com-Falha': String(falhas.length),
    },
  });
}
