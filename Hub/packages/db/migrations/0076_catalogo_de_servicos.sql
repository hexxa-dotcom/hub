-- Serviços Adicionais: o catálogo sai do código e vai para o banco, com o
-- preço que o contador define (incluso no plano, a partir de, valor fixo ou
-- sob orçamento). E o pedido vira conversa de verdade: anexo nos dois
-- sentidos.
--
-- O catálogo é do escritório (vale para todas as empresas), então não tem
-- company_id nem RLS por empresa.

CREATE TABLE IF NOT EXISTS service_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   text NOT NULL,
  nome        text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  prazo       text NOT NULL,
  preco_tipo  text NOT NULL DEFAULT 'ORCAMENTO' CHECK (preco_tipo IN ('INCLUSO', 'A_PARTIR', 'FIXO', 'ORCAMENTO')),
  preco       numeric(14, 2),
  ativo       boolean NOT NULL DEFAULT true,
  ordem       int NOT NULL DEFAULT 0
);

ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment text;       -- data URL
ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment_name text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
    GRANT SELECT ON service_catalog TO hexxa_app;
  END IF;
END $$;

-- O catálogo revisado para prestadoras de serviço (Simples e Presumido). Saem
-- DIRF (extinta em 2025), RAIS (substituída pelo eSocial), EIRELI (extinta) e
-- a migração Presumido → Real, que não é do público.
INSERT INTO service_catalog (categoria, nome, descricao, prazo, ordem) VALUES
  ('Alterações na empresa', 'Alteração de endereço', 'Mudança do endereço da sede ou filial na Junta Comercial, Receita Federal e prefeitura.', '5 a 10 dias úteis', 10),
  ('Alterações na empresa', 'Inclusão ou saída de sócio', 'Alteração do quadro societário com o contrato social e o registro na Junta Comercial.', '10 a 20 dias úteis', 11),
  ('Alterações na empresa', 'Alteração de atividade (CNAE)', 'Inclusão, troca ou exclusão de atividades no CNPJ e no alvará, com a análise do impacto no imposto.', '7 a 15 dias úteis', 12),
  ('Alterações na empresa', 'Alteração do nome empresarial', 'Mudança da razão social ou do nome fantasia, atualizada em todos os órgãos.', '10 a 20 dias úteis', 13),
  ('Alterações na empresa', 'Alteração do capital social', 'Aumento ou redução do capital social com a alteração contratual e o registro.', '7 a 15 dias úteis', 14),
  ('Certidões e declarações', 'Certidão Negativa Federal (CND)', 'Certidão de regularidade com a Receita Federal e a PGFN.', '1 a 3 dias úteis', 20),
  ('Certidões e declarações', 'Certidão Negativa Municipal', 'Certidão de regularidade com a prefeitura (ISS e taxas).', '1 a 5 dias úteis', 21),
  ('Certidões e declarações', 'Certidão FGTS (CRF)', 'Certificado de Regularidade do FGTS emitido pela Caixa.', '1 a 3 dias úteis', 22),
  ('Certidões e declarações', 'Declaração de faturamento', 'Declaração do faturamento assinada pelo contador, para banco, contrato ou licitação.', '2 a 5 dias úteis', 23),
  ('Certidões e declarações', 'Declaração de rendimentos do sócio (DECORE)', 'Comprovação de renda do sócio, emitida pelo contador, para financiamento ou aluguel.', '2 a 5 dias úteis', 24),
  ('Certidões e declarações', 'Imposto de Renda do sócio (IRPF)', 'Declaração anual do Imposto de Renda da pessoa física do sócio.', 'Até o prazo da Receita', 25),
  ('Regularização e parcelamento', 'Parcelamento de débitos federais', 'Parcelamento de impostos federais em atraso na Receita Federal ou na PGFN.', '3 a 7 dias úteis', 30),
  ('Regularização e parcelamento', 'Parcelamento do Simples Nacional', 'Parcelamento de DAS em atraso.', '3 a 7 dias úteis', 31),
  ('Regularização e parcelamento', 'Parcelamento de ISS', 'Negociação com a prefeitura do ISS em atraso.', '5 a 10 dias úteis', 32),
  ('Regularização e parcelamento', 'Regularização de pendências', 'Levantamento e solução de pendências fiscais, previdenciárias e cadastrais.', '10 a 30 dias úteis', 33),
  ('Impostos e regime', 'Planejamento tributário', 'Comparação entre Simples e Lucro Presumido com a projeção do imposto para o ano.', '10 a 20 dias úteis', 40),
  ('Impostos e regime', 'Opção pelo Simples Nacional', 'Análise e pedido de opção pelo Simples, no prazo de janeiro.', 'Conforme o calendário', 41),
  ('Impostos e regime', 'Mudança para o Lucro Presumido', 'Saída do Simples e passagem para o Lucro Presumido, com o ajuste das obrigações.', '5 a 10 dias úteis', 42),
  ('Pessoal', 'Admissão de funcionário', 'Registro do empregado, eSocial, contrato de trabalho e exame admissional.', '2 a 5 dias úteis', 50),
  ('Pessoal', 'Rescisão de contrato de trabalho', 'Cálculo das verbas, guias e comunicação ao eSocial.', '3 a 7 dias úteis', 51),
  ('Pessoal', 'Programação de férias', 'Cálculo e recibo de férias do empregado.', '2 a 5 dias úteis', 52),
  ('Abertura e encerramento', 'Abertura de filial', 'Registro da filial com CNPJ, inscrição municipal e alvará.', '15 a 30 dias úteis', 60),
  ('Abertura e encerramento', 'Encerramento da empresa', 'Distrato, baixa do CNPJ e encerramento em todos os órgãos.', '30 a 90 dias úteis', 61),
  ('Abertura e encerramento', 'Desenquadramento do MEI', 'Passagem de MEI para microempresa, com o ajuste do regime e das obrigações.', '10 a 20 dias úteis', 62),
  ('Consultoria', 'Reunião com o contador', 'Uma conversa para tirar dúvidas ou planejar uma decisão da empresa.', 'Agendamento', 70),
  ('Consultoria', 'Holding e reestruturação societária', 'Organização do patrimônio e do quadro societário, com proteção patrimonial.', '30 a 60 dias úteis', 71),
  ('Consultoria', 'Documentação para licitação', 'Certidões, declarações e habilitação para participar de editais.', '5 a 15 dias úteis', 72)
ON CONFLICT (nome) DO NOTHING;
