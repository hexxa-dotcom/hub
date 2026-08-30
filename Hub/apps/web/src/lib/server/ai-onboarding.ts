import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

/**
 * Interface do que esperamos que a IA extraia dos PDFs 
 * do Contrato Social e Balanço Patrimonial.
 */
export interface OnboardingExtractedData {
  companyName: string;
  cnpj: string;
  totalSocialCapital: number;
  unpaidSocialCapital: number;
  allowsDisproportionateDistribution: boolean;
  accumulatedLosses: number;
  activeMutualContractsBalance: number;
  partners: Array<{
    name: string;
    cpf: string;
    sharePercentage: number;
  }>;
}

export class AIOnboardingService {
  /**
   * Envia os textos extraídos dos PDFs para o Gemini analisar e retornar 
   * o JSON estruturado para plugar no banco de dados.
   * Obs: Na vida real, poderíamos passar os bytes do PDF direto (Multimodal).
   * Aqui simulamos passando o texto via OCR/conversão.
   */
  public async extractCompanyData(
    socialContractText: string,
    balanceSheetText: string
  ): Promise<OnboardingExtractedData> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        temperature: 0.1,
        // Usamos Schema para forçar a saída exata em JSON
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            companyName: { type: SchemaType.STRING },
            cnpj: { type: SchemaType.STRING },
            totalSocialCapital: { type: SchemaType.NUMBER },
            unpaidSocialCapital: { type: SchemaType.NUMBER, description: 'Capital a Integralizar' },
            allowsDisproportionateDistribution: { type: SchemaType.BOOLEAN, description: 'Tem cláusula explícita para distribuição desproporcional de lucros?' },
            accumulatedLosses: { type: SchemaType.NUMBER, description: 'Prejuízos Acumulados no passivo' },
            activeMutualContractsBalance: { type: SchemaType.NUMBER, description: 'Mútuos (empréstimos) a receber de sócios' },
            partners: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  cpf: { type: SchemaType.STRING },
                  sharePercentage: { type: SchemaType.NUMBER },
                },
              },
            },
          },
        },
      },
    });

    const prompt = `
    Você é um Auditor Sênior de Onboarding Contábil do Hexx Hub.
    Extraia os dados societários e contábeis dos dois documentos abaixo.
    
    CONTRATO SOCIAL:
    ${socialContractText}
    
    BALANÇO PATRIMONIAL (DRE):
    ${balanceSheetText}
    
    Siga o schema JSON estritamente.
    `;

    try {
      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      
      const data: OnboardingExtractedData = JSON.parse(textResponse);
      return data;
    } catch (error) {
      console.error('Falha na extração de Onboarding pela IA:', error);
      throw error;
    }
  }
}
