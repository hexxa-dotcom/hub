# Parcelamentos por documento

A área de guias do cliente e do contador compartilha o cadastro e a consulta de parcelamentos. O PDF de adesão (até 3 MB) é lido pela IA configurada no ambiente. Os campos extraídos ficam em um rascunho: o usuário confere CNPJ, tributo, órgão, acordo, valor consolidado, entrada, parcela base, vencimento e histórico antes de gerar as parcelas.

A confirmação gera o plano e todas as parcelas em uma transação. Na leitura, a IA precisa classificar o documento como parcelamento tributário e identificar o CNPJ do contribuinte, acompanhado de trecho literal. Em PDFs com texto, esse CNPJ também deve existir no texto extraído. CNPJ ausente, divergente, sem evidência ou documento de outro tipo bloqueiam a importação antes de guardar o rascunho. O CNPJ deve corresponder à empresa selecionada. A confirmação repete a validação contra os dados do documento guardados no servidor; editar o formulário não altera a identidade reconhecida. Rascunhos antigos sem essa validação exigem nova leitura. Essa conferência de identidade não comprova autenticidade governamental do PDF. Reimportações do mesmo PDF ou acordo não duplicam o plano. O histórico de parcelas iniciais pagas exige confirmação explícita e não movimenta o banco.

A primeira parcela preserva o vencimento informado no documento. As futuras parcelas federais usam como previsão o último dia útil bancário nacional do mês (fins de semana, feriados nacionais fixos, Sexta-feira Santa, Carnaval e fechamento bancário de 31/12). Para outros órgãos, o dia original é preservado, ajustando meses menores para o último dia. Feriados locais ou regras específicas devem ser confirmados pelo contador na guia oficial. Valores previstos são estimativas: juros e atualizações entram ao anexar a guia oficial de cada mês. O cliente solicita a guia; o contador anexa o PDF, valor, vencimento e Pix específico daquela parcela, gerando protocolo de entrega. O sistema não emite uma guia governamental a partir do termo de adesão.

As parcelas ficam no módulo fiscal de guias. Como o parcelamento quita uma dívida já constituída, as parcelas gerenciadas por esse fluxo não são provisionadas novamente como despesa tributária pelo escriturador. A reclassificação e baixa contábil do passivo original dependem do vínculo contábil da dívida e ainda não fazem parte deste fluxo.

## Ativação e validação

A migração `0113_parcelamentos_ia.sql` cria planos, rascunhos, restrições de duplicidade e os campos necessários nas guias. Ela foi aplicada ao banco configurado do Hub em 30/09/2026, após autorização do usuário, em transação. Foram conferidos os três campos novos de guias, as duas políticas de isolamento e o acesso pela conexão restrita do aplicativo. A leitura usa as credenciais de IA existentes. PDFs com texto usam o motor de conciliação; documentos escaneados têm leitura nativa quando o provedor configurado é Gemini. Outros provedores exigem PDF com texto ou preenchimento manual.

Os arquivos ficam protegidos pelo escopo da empresa e pela autorização da área do contador. A prévia `/previa/parcelamentos` (ou `?area=contador`) funciona somente fora de produção, com dados fictícios em memória, sem chamadas à IA ou gravações no banco.

Os testes cobrem programação mensal, histórico, validação de CNPJ, isolamento entre empresas, importação idempotente, anexação da guia à parcela existente, protocolo e proteção contra provisionamento duplicado. A prévia não exercita a IA nem a persistência. A leitura de um documento real ocorreu no Hub durante a validação; a criação definitiva de parcelas deve ser confirmada pelo usuário após conferir os dados extraídos.

Falhas de banco/provedor são apresentadas sem SQL, parâmetros ou conteúdo base64 do documento. Quando a migração estiver pendente, a mensagem informa que o cadastro precisa da atualização do banco.

## Consulta e disponibilidade mensal

O card usa o componente visual padrão do Hub. O nome amigável pode ser editado pelo cliente ou contador; a edição altera somente a descrição do plano, sem mexer em acordo, tributo, valores ou histórico. Por padrão, a lista expandida exibe as 12 primeiras parcelas; o usuário pode escolher o ano corrente ou todas. Totais e progresso sempre consideram o plano inteiro.

Exceto a primeira parcela, a solicitação e o envio da guia são liberados a partir do dia 10 do mês de vencimento, com validação no servidor. Parcelas futuras continuam visíveis para consulta, com a data de disponibilidade. O PDF oficial prevalece sobre as previsões. Base para o Simples Nacional: https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_PARCELAMENTO.pdf (seção 3.2). O dia 10 é o padrão operacional solicitado para o Hub, sujeito à regra do parcelamento emitido pelo órgão.

Referência para o fechamento de dezembro: https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/2025/dezembro/dia-30-12-2025 .

## Avisos de novas guias

A aba Parcelamentos conta apenas PDFs oficiais entregues e ainda não abertos, baixados ou confirmados pelo cliente. O mesmo critério ativa o aviso no Início, com acesso direto à aba. Parcelas previstas, guias pagas e consultas feitas pelo contador não geram nem consomem esse aviso.
