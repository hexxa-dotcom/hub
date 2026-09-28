-- Número da empresa no escritório: 3 dígitos (001 a 999), para achar pelo
-- número. Automático no cadastro (o menor livre, seguindo a ordem), e o
-- contador pode trocar — sem repetir.
ALTER TABLE company ADD COLUMN IF NOT EXISTS numero smallint;
ALTER TABLE company DROP CONSTRAINT IF EXISTS company_numero_faixa;
ALTER TABLE company ADD CONSTRAINT company_numero_faixa CHECK (numero IS NULL OR numero BETWEEN 0 AND 999);
CREATE UNIQUE INDEX IF NOT EXISTS company_numero_unico ON company (numero) WHERE numero IS NOT NULL;

-- As que já existem: na ordem de cadastro, a partir de 001.
WITH ordem AS (
  SELECT id, row_number() OVER (ORDER BY created_at, legal_name) AS n FROM company WHERE numero IS NULL
)
UPDATE company c SET numero = o.n FROM ordem o WHERE o.id = c.id AND o.n <= 999;

-- Toda empresa nova ganha o menor número livre a partir de 001, venha de onde vier.
CREATE OR REPLACE FUNCTION company_numero_automatico() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT min(n) INTO NEW.numero FROM generate_series(1, 999) n
     WHERE NOT EXISTS (SELECT 1 FROM company c WHERE c.numero = n);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_numero_automatico ON company;
CREATE TRIGGER company_numero_automatico BEFORE INSERT ON company FOR EACH ROW EXECUTE FUNCTION company_numero_automatico();
