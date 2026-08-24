-- O enum integration_kind no banco só tinha NFSE, ELECTRONIC_SIGNATURE e
-- OPEN_FINANCE — ERP e GATEWAY existiam no schema.ts mas nunca foram
-- migrados de verdade, quebrando silenciosamente o salvamento de
-- credenciais do Asaas (kind='GATEWAY') e agora do Oneflow (kind='ERP').
ALTER TYPE "integration_kind" ADD VALUE IF NOT EXISTS 'ERP';
ALTER TYPE "integration_kind" ADD VALUE IF NOT EXISTS 'GATEWAY';
