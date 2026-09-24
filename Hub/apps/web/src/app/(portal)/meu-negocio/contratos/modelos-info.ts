/**
 * Os modelos de contrato e os índices de reajuste — só os nomes, sem o texto
 * das cláusulas (que vive em `modelos.ts`, junto do PDF). Leve para a tela.
 */

export type ModeloDeContrato = 'CLIENTE' | 'PJ' | 'FORNECEDOR';

export const MODELOS: Record<
  ModeloDeContrato,
  { titulo: string; tipo: 'ENTRADA' | 'SAIDA'; rotulo: string; resumo: string; parte: string; minhaEmpresa: 'CONTRATADA' | 'CONTRATANTE' }
> = {
  CLIENTE: {
    titulo: 'Contrato de Prestação de Serviços',
    tipo: 'ENTRADA',
    rotulo: 'Prestar serviço a um cliente',
    resumo: 'Você presta o serviço e recebe todo mês.',
    parte: 'Cliente',
    minhaEmpresa: 'CONTRATADA',
  },
  PJ: {
    titulo: 'Contrato de Prestação de Serviços Profissionais (PJ)',
    tipo: 'SAIDA',
    rotulo: 'Contratar um profissional PJ',
    resumo: 'Um colaborador como pessoa jurídica, sem vínculo de emprego.',
    parte: 'Profissional',
    minhaEmpresa: 'CONTRATANTE',
  },
  FORNECEDOR: {
    titulo: 'Contrato de Prestação de Serviços',
    tipo: 'SAIDA',
    rotulo: 'Contratar um fornecedor',
    resumo: 'Uma empresa que presta serviço para você.',
    parte: 'Fornecedor',
    minhaEmpresa: 'CONTRATANTE',
  },
};

export const INDICES = {
  IPCA: 'IPCA (IBGE)',
  IGPM: 'IGP-M (FGV)',
  NENHUM: 'Sem reajuste',
} as const;
export type IndiceDeReajuste = keyof typeof INDICES;


/** Área do serviço: acrescenta cláusulas específicas (ver CATEGORY_CLAUSES). */
export const AREAS: { value: string; label: string }[] = [
  { value: '', label: 'Geral' },
  { value: 'CONSULTORIA', label: 'Consultoria' },
  { value: 'TI', label: 'Tecnologia / TI' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SOCIAL_MIDIA', label: 'Social mídia' },
  { value: 'DESIGN', label: 'Design / criação' },
  { value: 'COMERCIAL', label: 'Comercial / vendas' },
  { value: 'MEDICO', label: 'Saúde' },
  { value: 'JURIDICO', label: 'Jurídico' },
  { value: 'CONTABIL', label: 'Contábil / financeiro' },
  { value: 'PJ_AUTONOMO', label: 'Autônomo' },
];
