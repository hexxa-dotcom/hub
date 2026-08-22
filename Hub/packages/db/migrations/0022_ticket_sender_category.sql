-- "/suporte" era um chat 100% simulado: tickets hardcoded, respostas da
-- contabilidade geradas por setTimeout(), reunião "agendada" só mostrava um
-- toast e não persistia em lugar nenhum. Migra pro mesmo par ticket/
-- ticket_message já usado por Serviços Adicionais + painel do contador.
--
-- ticket_message não tinha como saber se uma mensagem veio do cliente ou da
-- contabilidade (authorUserId nunca era preenchido por nenhum dos dois
-- lados) — sem isso não dá pra desenhar o chat dos dois lados corretamente.
ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS sender TEXT NOT NULL DEFAULT 'CLIENT' CHECK (sender IN ('CLIENT', 'ACCOUNTING'));

-- Categoria da solicitação (Fiscal, Contábil, Departamento Pessoal, Reunião...).
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS category TEXT;
