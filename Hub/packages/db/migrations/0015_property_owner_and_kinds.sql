-- Corrige bug real: a action createProperty() gravava kind = 'REAL_ESTATE' ou
-- 'VEHICLE', valores que NUNCA existiram no enum property_kind (só tinha
-- APARTMENT/HOUSE/COMMERCIAL/LAND/OTHER) — cadastrar um Imóvel ou Veículo
-- sempre falhava silenciosamente (catch genérico "Erro ao criar ativo").
-- Adiciona as categorias reais que a calculadora de depreciação já usa.
ALTER TYPE property_kind ADD VALUE IF NOT EXISTS 'VEHICLE';
ALTER TYPE property_kind ADD VALUE IF NOT EXISTS 'MACHINERY';
ALTER TYPE property_kind ADD VALUE IF NOT EXISTS 'FURNITURE';
ALTER TYPE property_kind ADD VALUE IF NOT EXISTS 'IT_EQUIPMENT';

-- Patrimônio pessoal (PF) dos sócios, separado do patrimônio da empresa (PJ).
-- Continua na mesma tabela/tenant (isolamento por company_id), só marca de
-- quem é o bem: da empresa, ou de um sócio específico.
ALTER TABLE property ADD COLUMN IF NOT EXISTS owner_type TEXT NOT NULL DEFAULT 'PJ' CHECK (owner_type IN ('PJ', 'PF'));
ALTER TABLE property ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partner(id) ON DELETE SET NULL;
