import { NextRequest, NextResponse } from 'next/server';

const PGMEI = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function extractLinhaDigitavel(html: string): string | null {
  // Formato padrão FEBRABAN: NNNNN.NNNNN NNNNN.NNNNNN N.NNNNNN N NNNNNNNNNNNNNN
  const pattern1 = html.match(/\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d\.\d{6}\s+\d\s+\d{14}/);
  if (pattern1) return pattern1[0].replace(/\s+/g, ' ').trim();

  // Linha digitável sem espaços (47 dígitos seguidos)
  const pattern2 = html.match(/\b(\d{47})\b/);
  if (pattern2) return pattern2[1] ?? null;

  // Campo nomeado como "Linha Digitável" no HTML
  const pattern3 = html.match(/linha\s*digit[aá]vel[^>]*>[^<]*([0-9.]{30,60})/i);
  if (pattern3) return (pattern3[1] ?? '').trim() || null;

  return null;
}

function competenciaToPA(competencia: string): string {
  // "MM/YYYY" → "YYYYMM"
  const parts = competencia.split('/');
  if (parts.length === 2 && parts[0]!.length <= 2 && parts[1]!.length === 4) {
    return `${parts[1]}${parts[0]!.padStart(2, '0')}`;
  }
  return competencia;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cnpjRaw = searchParams.get('cnpj') ?? '';
  const cnpj = cnpjRaw.replace(/\D/g, '');
  const paRaw = searchParams.get('pa') ?? '';

  // Aceita tanto YYYYMM quanto MM/YYYY
  const pa = paRaw.includes('/') ? competenciaToPA(paRaw) : paRaw;

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido — informe os 14 dígitos.' }, { status: 400 });
  }
  if (pa.length !== 6 || isNaN(Number(pa))) {
    return NextResponse.json({ error: 'Período inválido — use AAAAMM ou MM/AAAA.' }, { status: 400 });
  }

  const pgmeiUrl = `${PGMEI}/Identificacao?cnpj=${cnpj}`;

  try {
    // Passo 1: estabelecer sessão no PGMEI
    const sessRes = await fetch(pgmeiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });

    if (!sessRes.ok) {
      return NextResponse.json(
        { error: `PGMEI indisponível (${sessRes.status}). Tente emitir diretamente no portal.`, pgmeiUrl },
        { status: 502 },
      );
    }

    const setCookie = sessRes.headers.get('set-cookie') ?? '';

    // Passo 2: emitir o DAS para o período
    const emRes = await fetch(`${PGMEI}/Emissao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': pgmeiUrl,
        ...(setCookie ? { Cookie: setCookie } : {}),
      },
      body: new URLSearchParams({ cnpj, pa, tipoDasRetorno: '2' }).toString(),
      redirect: 'follow',
    });

    if (!emRes.ok) {
      return NextResponse.json(
        { error: `PGMEI retornou erro ${emRes.status} na emissão.`, pgmeiUrl },
        { status: 502 },
      );
    }

    const contentType = emRes.headers.get('content-type') ?? '';

    // Resposta em PDF → devolve o arquivo direto
    if (contentType.includes('application/pdf')) {
      const pdf = await emRes.arrayBuffer();
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="DAS-MEI-${pa}.pdf"`,
        },
      });
    }

    // Resposta em HTML → extrai a linha digitável
    const html = await emRes.text();
    const linhaDigitavel = extractLinhaDigitavel(html);

    if (linhaDigitavel) {
      return NextResponse.json({ linhaDigitavel, pgmeiUrl });
    }

    // PGMEI retornou HTML mas sem código detectável (CNPJ inválido, período sem DAS, etc.)
    const msgMatch = html.match(/<span[^>]*class="[^"]*erro[^"]*"[^>]*>([^<]+)</i)
      ?? html.match(/<div[^>]*class="[^"]*mensagem[^"]*"[^>]*>([^<]+)</i);
    const msgGov = msgMatch?.[1]?.trim() ?? null;

    return NextResponse.json(
      {
        error: msgGov ?? 'Código de barras não encontrado na resposta do PGMEI. Verifique o CNPJ e o período.',
        pgmeiUrl,
      },
      { status: 502 },
    );

  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Erro ao conectar ao PGMEI.',
        pgmeiUrl,
      },
      { status: 502 },
    );
  }
}
