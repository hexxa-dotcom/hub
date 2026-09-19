-- A atividade da empresa se sujeita ao Fator R? Resposta do OneFlow, por mês.
--
-- O termômetro tributário calculava o Fator R pela folha e decidia Anexo III
-- ou V para toda empresa — inclusive as que estão no Anexo III pela própria
-- atividade, sem Fator R nenhum. Para essas, a tela dizia "Abaixo de 28% ·
-- Anexo V" e o piloto automático recomendava AUMENTAR o pró-labore: mais INSS
-- sem benefício algum.
--
-- O Fator R oficial vem do OneFlow (`folha/fatorr`, série mensal) e era lido
-- e descartado. A sujeição não vem de endpoint nenhum: é deduzida do anexo
-- APURADO lado a lado com o fator — Anexo III com fator abaixo de 28% só é
-- possível para atividade fora do Fator R. Nulo = não se sabe.

ALTER TABLE tax_history
  ADD COLUMN IF NOT EXISTS fator_r numeric(6,4),
  ADD COLUMN IF NOT EXISTS fator_r_sujeito boolean;

COMMENT ON COLUMN tax_history.fator_r IS
  'Fator R da competência, do OneFlow (0.46 = 46%).';
COMMENT ON COLUMN tax_history.fator_r_sujeito IS
  'Deduzido: true = anexo V apurado; false = anexo III com fator < 28%; null = não se sabe.';

-- Uma primeira versão deste código gravou a sujeição a partir de uma leitura
-- errada da resposta (lista vazia = "fora do Fator R"). Sem o fator ao lado,
-- não há base para afirmar nada: volta a ser desconhecido.
UPDATE tax_history SET fator_r_sujeito = NULL WHERE fator_r IS NULL;
