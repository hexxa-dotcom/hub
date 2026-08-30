import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Sugestão de texto por IA pra campos de preenchimento livre (ex.: descrição
 * de serviço, forma de pagamento) — independente do painel de "Hexxa
 * Insights" (apps/web/src/lib/server/ai-insight.ts), que tem um switch do
 * contador que pode estar desligado; aqui é uma ferramenta de digitação, não
 * uma dica proativa, então usa direto a GEMINI_API_KEY do ambiente.
 */
export async function draftContractField(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Sugestão por IA indisponível: GEMINI_API_KEY não configurada.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
