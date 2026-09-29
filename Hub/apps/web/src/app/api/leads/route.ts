import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';

/**
 * POST /api/leads — formulário "Fale com a gente" do site.
 * Grava em `contato_do_site` (aparece no painel do contador) e, se houver
 * LEAD_WEBHOOK_URL, avisa também por lá.
 */
const recentes = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const nome = String(body.nome ?? '').trim().slice(0, 120);
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 160);
    const whats = String(body.whats ?? '').replace(/\D/g, '').slice(0, 13);
    const area = String(body.area ?? '').trim().slice(0, 80) || null;

    if (nome.length < 2 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || whats.length < 10) {
      return NextResponse.json({ error: 'Confira nome, e-mail e WhatsApp.' }, { status: 400 });
    }

    // Limite por IP contra robô: 5 envios a cada 10 minutos.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'desconhecido';
    const agora = Date.now();
    const lista = (recentes.get(ip) ?? []).filter((t) => agora - t < 10 * 60_000);
    if (lista.length >= 5) return NextResponse.json({ error: 'Muitos envios. Tente mais tarde.' }, { status: 429 });
    recentes.set(ip, [...lista, agora]);

    await getDb().execute(sql`INSERT INTO contato_do_site (nome, email, whatsapp, area) VALUES (${nome}, ${email}, ${whats}, ${area})`);

    const webhookUrl = process.env.LEAD_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Novo contato pelo site — ${nome} · ${email} · ${whats} · ${area ?? 'área não informada'}` }),
        signal: AbortSignal.timeout(5000),
      }).catch((e) => console.error('[leads] webhook', e));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[leads]', error);
    return NextResponse.json({ error: 'Falha ao registrar o contato.' }, { status: 500 });
  }
}
