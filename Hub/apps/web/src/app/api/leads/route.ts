import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, email, whats, area } = body;

    if (!nome || !email || !whats) {
      return NextResponse.json(
        { error: 'Nome, e-mail e WhatsApp são obrigatórios.' },
        { status: 400 }
      );
    }

    const leadData = {
      nome,
      email,
      whats,
      area: area || 'Não informada',
      origem: 'Landing Page Hexx Hub',
      timestamp: new Date().toISOString(),
    };

    console.log('[HEXX LEAD CAPTURED]', leadData);

    // Optional webhook trigger if configured (Discord, Slack, Make, Zapier, CRM)
    const webhookUrl = process.env.LEAD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🎯 **Novo Lead Capturado - Hexx Hub**\n**Nome:** ${nome}\n**Email:** ${email}\n**WhatsApp:** ${whats}\n**Área / Plano:** ${leadData.area}`,
          }),
        });
      } catch (webhookErr) {
        console.error('[LEAD WEBHOOK ERROR]', webhookErr);
      }
    }

    const cleanPhone = whats.replace(/\D/g, '');
    const whatsappMsg = `Olá! Sou ${nome} (${leadData.area}) e acabei de solicitar uma demonstração/contato pelo site do Hexx Hub.`;

    return NextResponse.json(
      {
        success: true,
        message: 'Lead recebido com sucesso!',
        whatsappUrl: `https://wa.me/5500000000000?text=${encodeURIComponent(whatsappMsg)}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[LEAD CAPTURE ERROR]', error);
    return NextResponse.json(
      { error: 'Falha ao processar solicitação.' },
      { status: 500 }
    );
  }
}
