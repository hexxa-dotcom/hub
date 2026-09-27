-- EMISSÃO DE NOTA SEM ESFORÇO — e pronta para a reforma tributária.
--
-- customer.endereco: o endereço estruturado que a nota pede (CEP, código IBGE
-- do município, logradouro…). Vem da consulta pública do CNPJ e fica salvo; o
-- campo `address` (texto livre) continua para exibição.
--
-- emissao_agendada: "emitir todo dia 5 para o cliente X" ou "emitir no dia
-- 20/10", para quem não tem contrato. A rotina diária emite, avisa na véspera
-- e manda o e-mail.
--
-- nfse_service_profile.c_class_trib / cst_ibs_cbs: a classificação do serviço
-- no IBS/CBS (LC 214/2025). tax_regime_setting 'IBS_CBS': as alíquotas por ano
-- — 2026 é o ano de teste (CBS 0,9%, IBS 0,1%); mudar de ano é mudar a linha.

ALTER TABLE customer ADD COLUMN IF NOT EXISTS endereco jsonb;

CREATE TABLE IF NOT EXISTS emissao_agendada (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  customer_id      uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  perfil_id        uuid REFERENCES nfse_service_profile(id) ON DELETE SET NULL,
  descricao        text NOT NULL,
  valor            numeric(14, 2) NOT NULL CHECK (valor > 0),
  proxima_data     date NOT NULL,
  -- null = nota única; preenchido = repete todo mês neste dia.
  dia_do_mes       smallint CHECK (dia_do_mes IS NULL OR dia_do_mes BETWEEN 1 AND 28),
  ate              date,
  enviar_email     boolean NOT NULL DEFAULT true,
  ativa            boolean NOT NULL DEFAULT true,
  avisada_em       date,                 -- último aviso de véspera, para não repetir
  ultima_nota_id   uuid REFERENCES service_invoice(id) ON DELETE SET NULL,
  ultimo_erro      text,
  criada_em        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emissao_agendada_proxima_idx ON emissao_agendada (ativa, proxima_data);

ALTER TABLE emissao_agendada ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON emissao_agendada
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

ALTER TABLE nfse_service_profile ADD COLUMN IF NOT EXISTS c_class_trib text;
ALTER TABLE nfse_service_profile ADD COLUMN IF NOT EXISTS cst_ibs_cbs text;

INSERT INTO tax_regime_setting (setting_code, name, parameters, valid_from, valid_until)
SELECT 'IBS_CBS', 'IBS e CBS — ano de teste (LC 214/2025)',
       '{"cbs": 0.9, "ibs": 0.1, "simplesDispensado": true}'::jsonb, '2026-01-01', '2026-12-31'
 WHERE NOT EXISTS (SELECT 1 FROM tax_regime_setting WHERE setting_code = 'IBS_CBS' AND valid_from = '2026-01-01');
