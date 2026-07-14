import 'server-only';

/**
 * Integração com Conta gov.br (OAuth2).
 * MOCK para demo; depois substitua pelos secrets reais.
 */

export interface GovBrUser {
  cpf: string;
  cnpj?: string;
  nome: string;
  email: string;
}

/** Simula retorno da API Conta gov.br (em produção, vira um POST real). */
export function mockGovBrCallback(code: string): GovBrUser | null {
  // Em produção: troca `code` por um token real via POST em:
  // https://sso.acesso.gov.br/oauth/token
  // Depois valida o token e puxa os dados do usuário.

  const demos: Record<string, GovBrUser> = {
    'demo-cnpj': {
      cpf: '12345678900',
      cnpj: '12345678000199',
      nome: 'Empresa Demo LTDA',
      email: 'admin@demo.com.br',
    },
    'demo-pf': {
      cpf: '98765432100',
      nome: 'João da Silva',
      email: 'joao@demo.com.br',
    },
  };

  return demos[code] ?? null;
}

/** URL de redirecionamento pra o gov.br (em produção, tira o mock). */
export function getGovBrAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOV_BR_CLIENT_ID || 'mock-client-id',
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    nonce: Math.random().toString(36).substring(7),
  });
  return `https://sso.acesso.gov.br/oauth/authorize?${params}`;
}
