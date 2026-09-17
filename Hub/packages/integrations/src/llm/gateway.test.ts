import { describe, it, expect } from 'vitest';
import { extrairJson, BASE_URLS, callLlm, LlmError } from './gateway';

describe('recorte de JSON da resposta do modelo', () => {
  it('lê JSON puro', () => {
    expect(extrairJson<number[]>('[1,2,3]')).toEqual([1, 2, 3]);
  });

  /** O caso mais comum na prática: o modelo embrulha em cerca de markdown. */
  it('lê JSON dentro de cerca de markdown', () => {
    const texto = '```json\n[{"id":"a"}]\n```';
    expect(extrairJson<{ id: string }[]>(texto)).toEqual([{ id: 'a' }]);
  });

  it('lê JSON depois de conversa fiada', () => {
    const texto = 'Claro! Aqui está a classificação:\n[{"id":"a"}]\nEspero ter ajudado.';
    expect(extrairJson<{ id: string }[]>(texto)).toEqual([{ id: 'a' }]);
  });

  it('lê objeto quando a forma pedida é objeto', () => {
    expect(extrairJson<{ ok: boolean }>('{"ok":true}', 'objeto')).toEqual({ ok: true });
  });

  /**
   * Malformado devolve null, nunca um palpite. Um recorte "quase certo" viraria
   * classificação contábil sem ninguém ter decidido nada.
   */
  it('devolve null em JSON quebrado', () => {
    expect(extrairJson('[{"id": }')).toBeNull();
  });

  it('devolve null quando não há delimitador', () => {
    expect(extrairJson('não consegui classificar nada')).toBeNull();
  });

  it('devolve null quando os delimitadores estão invertidos', () => {
    expect(extrairJson(']  [')).toBeNull();
  });
});

describe('endpoints da família OpenAI', () => {
  /**
   * DeepSeek, Kimi, OpenRouter e Groq falam a mesma API. É isso que permite
   * trocar de motor pela tela em vez de por código.
   */
  it('todos os endpoints conhecidos são https e terminam em /v1', () => {
    for (const [nome, url] of Object.entries(BASE_URLS)) {
      expect(url.startsWith('https://'), nome).toBe(true);
      expect(url.endsWith('/v1'), nome).toBe(true);
    }
  });
});

describe('provedor desconhecido', () => {
  /**
   * Falhar alto em vez de cair num padrão: cair no padrão mandaria dados de
   * cliente para um endereço que ninguém escolheu.
   */
  it('não cai num provedor padrão', async () => {
    await expect(
      callLlm(
        { provider: 'inventado' as never, apiKey: 'x', model: 'y' },
        { system: 's', user: 'u' },
      ),
    ).rejects.toThrow(LlmError);
  });
});
