/**
 * Tipos do wizard unificado de Contratos — extensível: um novo tipo de
 * contrato é um novo branch em `ContractKind` + um novo `...FormData`, sem
 * reescrever o restante do wizard.
 */

export type ContractKind = 'SERVICO' | 'ALUGUEL' | 'MUTUO';

export interface CounterpartyData {
  name: string;
  document: string; // CPF/CNPJ
  address: string;
  email: string;
}

export interface ServicoFormData {
  kind: 'SERVICO';
  contraparte: CounterpartyData;
  descricao: string;
  valor: number;
  formaPagamento: string;
  dueDay: number;
  startDate: string;
  endDate: string;
}

export interface AluguelFormData {
  kind: 'ALUGUEL';
  propertyId: string;
  propertyLabel: string;
  contraparte: CounterpartyData;
  monthlyRent: number;
  indexType: 'IPCA' | 'IGPM';
  startDate: string;
  endDate: string;
}

export interface MutuoFormData {
  kind: 'MUTUO';
  contraparte: CounterpartyData;
  direcao: 'MUTUO_ATIVO' | 'MUTUO_PASSIVO'; // ATIVO = empresa empresta ao sócio/terceiro
  valor: number;
  jurosAoMes: string;
  formaPagamento: string;
  prazo: string;
  dueDay: number;
  startDate: string;
  endDate: string;
}

export type WizardFormData = ServicoFormData | AluguelFormData | MutuoFormData;

/**
 * AUTO = sistema gera o PDF padrão e manda pro DocuSeal.
 * ALREADY_SIGNED = contrato já existia fora do sistema — só registra
 * (upload do PDF assinado), ativa e lança o financeiro na hora, sem
 * passar pelo DocuSeal.
 */
export type DocumentSource = 'AUTO' | 'ALREADY_SIGNED';

export interface WizardSubmission {
  formData: WizardFormData;
  documentSource: DocumentSource;
  cityDate: string;
  /** obrigatório quando documentSource = ALREADY_SIGNED */
  signedPdfBase64?: string;
  signedPdfFilename?: string;
  signingDate?: string;
}

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  SERVICO: 'Prestação de Serviço',
  ALUGUEL: 'Aluguel',
  MUTUO: 'Mútuo Financeiro',
};
