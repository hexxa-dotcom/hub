-- REFORMA TRIBUTÁRIA NA NOTA — o grupo IBS/CBS da DPS, por empresa.
--
-- leiaute_ibs_cbs: NULL = a DPS sai como sempre (sem o grupo); 'V101' =
-- esquema XSD RTC v1.01 (validado); 'NT009' = leiaute RTC v1.04. Liga-se
-- empresa a empresa depois de a emissão passar em Produção Restrita.
-- reg_ap_ibscbs_sn: Simples — 1 IBS e CBS pelo SN (padrão); 2 só a CBS; 3 os dois pelo regime regular.
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS leiaute_ibs_cbs text
  CHECK (leiaute_ibs_cbs IS NULL OR leiaute_ibs_cbs IN ('V101', 'NT009'));
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS reg_ap_ibscbs_sn text
  CHECK (reg_ap_ibscbs_sn IS NULL OR reg_ap_ibscbs_sn IN ('1', '2', '3'));
ALTER TABLE nfse_service_profile ADD COLUMN IF NOT EXISTS c_nbs text;
