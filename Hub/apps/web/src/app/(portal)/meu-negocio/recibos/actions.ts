'use server';
import { headers } from 'next/headers';
import type { ReciboItem } from '@/lib/recibo-rules';
import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { emitirRecibo, compartilharRecibo, cancelarRecibo, agendarRecibo, alterarAgendaRecibo, salvarDiscriminacao, configurarAssinaturaRecibos, opcoesAssinaturaRecibo } from '@/lib/server/recibos';
import { enviarReciboEmitidoEmail } from '@/lib/server/recibo-envio';

export async function executarReciboAction(input: { action: 'emitir' | 'compartilhar' | 'email' | 'cancelar' | 'agendar' | 'agenda' | 'discriminar' | 'assinatura'; consent?:boolean; sign?:boolean; itens?: ReciboItem[]; id: string; name?: string; email?: string; reason?: string; date?: string; recurring?: boolean; sendEmail?: boolean; active?: boolean }) {
  try {
    const ctx = await getTenantContext();
    let path: string | undefined;
    let message = 'Atualizado.';
    switch (input.action) {
      case 'assinatura': {
        const h=await headers();
        await configurarAssinaturaRecibos(ctx,!!input.active,!!input.consent,{ip:h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,userAgent:h.get('user-agent')});
        message=input.active ? 'Assinatura automática autorizada para novos recibos da empresa.' : 'Assinatura automática desativada. Os recibos anteriores foram preservados.';
        break;
      }
      case 'discriminar': await salvarDiscriminacao(ctx,input.id,input.itens || []); message='Discriminação salva para a emissão manual ou agendada.'; break;
      case 'emitir': {
        const r = await emitirRecibo(ctx, input.id, input.name,input.sign);
        path = `/api/recibos/${r.id}`;
        message = r.alreadyIssued ? 'Este recibo já foi emitido.' : 'Recibo emitido. O PDF está pronto.';
        break;
      }
      case 'compartilhar': path = await compartilharRecibo(ctx, input.id); message = 'Link pronto. Válido por 7 dias.'; break;
      case 'email': return await enviarReciboEmitidoEmail(ctx, input.id, input.email);
      case 'cancelar': await cancelarRecibo(ctx, input.id, input.reason || ''); message = 'Recibo cancelado. Os links de compartilhamento foram desativados.'; break;
      case 'agendar': await agendarRecibo(ctx, { entryId: input.id, date: input.date || '', recurring: !!input.recurring, sendEmail: !!input.sendEmail }); message = 'Emissão agendada. A quitação será emitida após o pagamento ser registrado.'; break;
      case 'agenda': await alterarAgendaRecibo(ctx, input.id, !!input.active); message = input.active ? 'Agendamento retomado.' : 'Agendamento pausado.'; break;
    }
    revalidatePath('/meu-negocio/recibos');
    revalidatePath('/patrimonial');
    return { ok: true, message, path };
  } catch (err) { return { ok: false, message: err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.' }; }
}

export async function obterOpcoesReciboAction(entryId:string) {
 try {return {ok:true,...await opcoesAssinaturaRecibo(await getTenantContext(),entryId)};}
 catch(e){return {ok:false,message:e instanceof Error ? e.message:'Não foi possível carregar as opções.'};}
}
