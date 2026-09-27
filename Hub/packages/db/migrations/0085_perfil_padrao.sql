-- O serviço (perfil fiscal) que já vem escolhido na emissão. Um por empresa;
-- sem nenhum marcado, vale o primeiro por nome.
ALTER TABLE nfse_service_profile ADD COLUMN IF NOT EXISTS padrao boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS nfse_service_profile_um_padrao ON nfse_service_profile (company_id) WHERE padrao;
