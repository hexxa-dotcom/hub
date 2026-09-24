import 'server-only';
import { callLlm } from '@hexxa/integrations';
import { resolverMotor, credencialDoAmbiente } from './llm-config';

/**
 * Sugestão de texto por IA pra campos de preenchimento livre (ex.: descrição
 * de serviço, forma de pagamento) — independente do painel de "Hexx
 * Insights" (apps/web/src/lib/server/ai-insight.ts), que tem um switch do
 * contador que pode estar desligado.
 *
 * A independência é deliberada: aqui é ferramenta de digitação, disparada pelo
 * usuário no momento em que ele quer. Desligá-la junto com as dicas proativas
 * quebraria um botão que a pessoa acabou de apertar, por uma configuração que
 * trata de outra coisa. Por isso usa a credencial do ambiente, não a do banco.
 */
export async function draftContractField(prompt: string): Promise<string> {
  const cred = credencialDoAmbiente();
  if (!cred) {
    throw new Error('Sugestão por IA indisponível: nenhuma chave de modelo configurada no ambiente.');
  }

  const motor = await resolverMotor(cred);
  const r = await callLlm(motor, {
    system: 'Você redige textos curtos e diretos em português do Brasil, sem preâmbulo.',
    user: prompt,
    maxTokens: 500,
  });
  return r.text.trim();
}
