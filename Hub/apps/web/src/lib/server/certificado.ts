import { inspecionarCertificado, type FichaDoCertificado } from '@hexxa/integrations';
import type { TenantContext } from '@hexxa/core';
import { normalizeDocument } from '@hexxa/core/document-br';
import { getNfseConfig } from './fiscal';

/**
 * O ESTADO DO CERTIFICADO DIGITAL, EM PORTUGUÊS.
 *
 * ── Por que os avisos começam com 30 dias ──────────────────────────────
 *
 * Renovar um A1 não é instantâneo: depende de agendar videoconferência ou ir
 * a um posto de atendimento, e depende da agenda de terceiros. Avisar na
 * véspera é avisar tarde. Trinta dias é o prazo em que ainda dá para
 * remarcar se a primeira tentativa falhar.
 *
 * Os degraus 30 / 15 / 7 existem porque um aviso único some no meio de tudo.
 * O que muda é o tom, não a informação: o de 7 dias precisa incomodar.
 *
 * ── Por que confere o titular ──────────────────────────────────────────
 *
 * Subir o certificado de outra empresa é erro comum de quem cuida de mais de
 * um CNPJ. Sem esta conferência, o erro só apareceria na primeira emissão,
 * como uma recusa incompreensível do Emissor Nacional — no dia em que a nota
 * precisa sair.
 */
export type NivelDoAviso = 'OK' | 'ATENCAO' | 'URGENTE' | 'VENCIDO' | 'AUSENTE' | 'INVALIDO';

export interface StatusDoCertificado {
  nivel: NivelDoAviso;
  /** Uma frase, pronta para a tela. */
  mensagem: string;
  ficha: FichaDoCertificado | null;
  /** `true` quando o CNPJ do certificado não é o da empresa. */
  titularDivergente: boolean;
}

/** Dias que disparam aviso. Ver o cabeçalho para o porquê de cada um. */
export const DEGRAUS_DE_AVISO = [30, 15, 7] as const;

export async function getStatusDoCertificado(ctx: TenantContext): Promise<StatusDoCertificado> {
  const cfg = await getNfseConfig(ctx).catch(() => null);

  if (!cfg?.certPfxB64 || !cfg.certPassword) {
    return {
      nivel: 'AUSENTE',
      mensagem: 'Nenhum certificado digital enviado. Sem ele o Hub não emite nota fiscal.',
      ficha: null,
      titularDivergente: false,
    };
  }

  let ficha: FichaDoCertificado;
  try {
    ficha = inspecionarCertificado(cfg.certPfxB64, cfg.certPassword);
  } catch (err) {
    // Senha errada e arquivo corrompido caem aqui, e a diferença importa
    // pouco para quem lê: nos dois casos a nota não sai.
    return {
      nivel: 'INVALIDO',
      mensagem:
        err instanceof Error && /senha/i.test(err.message)
          ? 'Não consegui abrir o certificado — a senha parece estar errada.'
          : 'Não consegui ler o certificado enviado. Envie o arquivo .pfx de novo.',
      ficha: null,
      titularDivergente: false,
    };
  }

  const daEmpresa = normalizeDocument(cfg.cnpj ?? '');
  const titularDivergente = Boolean(ficha.cnpj && daEmpresa && ficha.cnpj !== daEmpresa);

  if (titularDivergente) {
    return {
      nivel: 'INVALIDO',
      mensagem: `Este certificado é de outro CNPJ (${ficha.cnpj}). Envie o da própria empresa.`,
      ficha,
      titularDivergente,
    };
  }

  const dia = new Date(`${ficha.validoAte}T12:00:00Z`).toLocaleDateString('pt-BR');

  if (ficha.vencido) {
    return {
      nivel: 'VENCIDO',
      mensagem: `Certificado vencido em ${dia}. A emissão de notas está parada até renovar.`,
      ficha,
      titularDivergente: false,
    };
  }
  if (ficha.diasParaVencer <= 7) {
    return {
      nivel: 'URGENTE',
      mensagem:
        ficha.diasParaVencer === 0
          ? `Seu certificado vence HOJE (${dia}). Renove antes de precisar emitir.`
          : `Seu certificado vence em ${ficha.diasParaVencer} dia${ficha.diasParaVencer === 1 ? '' : 's'} (${dia}). Renove agora.`,
      ficha,
      titularDivergente: false,
    };
  }
  if (ficha.diasParaVencer <= 30) {
    return {
      nivel: 'ATENCAO',
      mensagem: `Seu certificado vence em ${ficha.diasParaVencer} dias (${dia}). Vale começar a renovação — depende de agendamento.`,
      ficha,
      titularDivergente: false,
    };
  }

  return {
    nivel: 'OK',
    mensagem: `Certificado validado, em nome de ${ficha.titular.split(':')[0]}. Vence em ${dia}.`,
    ficha,
    titularDivergente: false,
  };
}
