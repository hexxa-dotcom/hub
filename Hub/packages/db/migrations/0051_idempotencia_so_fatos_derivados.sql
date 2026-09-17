-- ⚠️ SUPERSEDIDA PELA 0052. Não reexecutar.
--
-- Esta migration criava o índice de idempotência excluindo apenas
-- `status <> 'REVERSED'`. A 0052 mudou o modelo: partida estornada permanece
-- POSTED e passa a ser marcada por `reversed_by`. Com isso, reexecutar o índice
-- desta migration encontra duplicatas legítimas (a partida original estornada
-- e a nova escrituração do mesmo fato) e falha.
--
-- O índice final vive na 0052. Mantido aqui só como registro do passo.
--
-- A chave de idempotência da partida cobria eventos demais.
--
-- Ela existe para impedir que o MESMO fato derivado de um documento seja
-- lançado duas vezes: uma nota não pode reconhecer receita duas vezes, um
-- pagamento não pode baixar o passivo duas vezes. São fatos que, por
-- definição, acontecem uma vez só por documento.
--
-- Estorno e ajuste não são assim. Um lançamento reclassificado duas vezes
-- precisa ser estornado duas vezes, e a chave antiga recusava o segundo
-- estorno com violação de chave única — travando justamente a correção, que é
-- o caminho que o sistema oferece para consertar erro de agente.
--
-- Agora a chave cobre só ACCRUAL e SETTLEMENT. Correções são livres para se
-- repetir; o que não se repete é o fato original.

DROP INDEX IF EXISTS uq_journal_entry_source_event;

CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entry_source_event
  ON journal_entry (company_id, source, source_id, event)
  WHERE source_id IS NOT NULL
    AND status <> 'REVERSED'
    AND event IN ('ACCRUAL', 'SETTLEMENT');
