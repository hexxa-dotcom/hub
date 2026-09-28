-- Validade e titular do certificado A1, gravados junto dele: a lista de
-- clientes e o alerta do painel do escritório leem daqui, sem descriptografar
-- e abrir cada certificado a cada carregamento.
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS cert_valido_ate date;
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS cert_titular text;
