-- Aprovação do cadastro do cliente e criação dele no OneFlow.
--
-- O cliente se cadastra no Hub com o básico (CNPJ e os dados de quem
-- responde pela empresa). O contador revisa e aprova; ao aprovar, o Hub cria
-- a empresa no OneFlow com os módulos. As regras tributárias o contador
-- define LÁ, e o Hub traz de volta — o OneFlow prevalece.
--
-- O responsável: CPF e celular são exigidos pelo OneFlow para criar a
-- empresa (dono do app e contato). Não havia onde guardar.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Quando o Hub criou (ou encontrou) a empresa no OneFlow. Nulo = ainda não
-- foi. É o que a ficha lê para mostrar "aprovar" ou "enviado".
ALTER TABLE company
  ADD COLUMN IF NOT EXISTS oneflow_created_at timestamptz;

COMMENT ON COLUMN company.oneflow_created_at IS
  'Quando o Hub criou ou vinculou a empresa no OneFlow, na aprovação do cadastro.';

-- Empresas que já estavam vinculadas ao OneFlow antes desta migração (vieram
-- de lá pelo cadastro do contador): já existem lá, e a ficha não deve
-- oferecer criá-las. O token da empresa é a prova do vínculo.
UPDATE company c SET oneflow_created_at = NOW()
 WHERE c.oneflow_created_at IS NULL
   AND EXISTS (SELECT 1 FROM oneflow_token t WHERE t.scope = 'COMPANY' AND t.scope_key = c.id::text);
