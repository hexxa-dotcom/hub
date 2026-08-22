import type { SignaturePort, SignatureCreateInput, SignatureEnvelope } from '@hexxa/core/ports';

const BASE_URL = 'https://api.docuseal.com';

/**
 * Adapter de assinatura eletrônica usando a API do DocuSeal (plano Pro, chave
 * única da conta — os signatários finais não precisam de conta/chave própria).
 *
 * IMPORTANTE: o posicionamento do campo de assinatura (`areas` abaixo) é uma
 * posição padrão no rodapé da 1ª página, feita sem confirmação contra a API
 * real do DocuSeal (sem acesso de teste neste ambiente). Antes de usar em
 * contratos reais, valide um envio de teste e, se necessário, ajuste a
 * posição no Construtor DocuSeal (aba "Construtor" do sistema) — o template
 * criado aqui pode ser editado visualmente lá antes do primeiro envio real.
 */
export class DocusealAdapter implements SignaturePort {
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { 'X-Auth-Token': this.apiKey, 'Content-Type': 'application/json' };
  }

  async createEnvelope(input: SignatureCreateInput): Promise<SignatureEnvelope> {
    if (!input.documentBuffer) {
      throw new Error('DocuSeal requer o PDF em base64 (documentBuffer).');
    }

    const fields = input.signers.map((s, i) => ({
      name: `Assinatura — ${s.role ?? s.name ?? `Parte ${i + 1}`}`,
      type: 'signature',
      role: s.role ?? `Parte ${i + 1}`,
      required: true,
      areas: [{ x: 0.58, y: Math.min(0.9, 0.7 + i * 0.08), w: 0.32, h: 0.06, page: 0 }],
    }));

    const templateRes = await fetch(`${BASE_URL}/templates/pdf`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name: input.title,
        documents: [{ name: input.documentBuffer.filename, file: input.documentBuffer.base64 }],
        fields,
      }),
    });
    if (!templateRes.ok) {
      throw new Error(`Falha ao criar template no DocuSeal: ${await templateRes.text()}`);
    }
    const template = (await templateRes.json()) as { id: number };

    const submitters = input.signers.map((s, i) => ({
      name: s.name,
      email: s.email,
      role: s.role ?? `Parte ${i + 1}`,
    }));

    const subRes = await fetch(`${BASE_URL}/submissions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ template_id: template.id, send_email: true, submitters }),
    });
    if (!subRes.ok) {
      throw new Error(`Falha ao enviar para assinatura no DocuSeal: ${await subRes.text()}`);
    }
    const subData = (await subRes.json()) as Array<{ submission_id: number; email: string; embed_src: string }>;
    const submissionId = subData[0]?.submission_id;
    if (!submissionId) {
      throw new Error('DocuSeal não retornou um submission_id.');
    }

    return {
      providerEnvelopeId: String(submissionId),
      status: 'SENT',
      signUrls: subData.map((s) => ({ email: s.email, url: s.embed_src })),
    };
  }

  async getEnvelope(providerEnvelopeId: string): Promise<SignatureEnvelope> {
    const res = await fetch(`${BASE_URL}/submissions/${providerEnvelopeId}`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`Falha ao consultar assinatura no DocuSeal: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      status: string;
      submitters: Array<{ email: string; status: string; documents?: { url: string }[] }>;
    };
    const status: SignatureEnvelope['status'] =
      data.status === 'completed'
        ? 'SIGNED'
        : data.status === 'declined'
          ? 'REFUSED'
          : data.status === 'expired'
            ? 'EXPIRED'
            : 'SENT';
    return {
      providerEnvelopeId,
      status,
      signUrls: (data.submitters ?? []).map((s) => ({ email: s.email, url: s.documents?.[0]?.url ?? '' })),
    };
  }

  async cancel(providerEnvelopeId: string): Promise<void> {
    await fetch(`${BASE_URL}/submissions/${providerEnvelopeId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }
}
