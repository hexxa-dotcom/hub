-- Estorno não despublica a partida original.
--
-- O desenho anterior marcava a original como REVERSED e publicava a espelho.
-- Mas o balancete só soma partida POSTED — então a original saía da conta e a
-- espelho entrava, e o efeito do estorno era aplicado DUAS VEZES: uma por
-- remoção, outra por contra-lançamento. Reclassificar uma despesa de R$ 485
-- fazia a conta de origem variar R$ 970.
--
-- O certo é o que a contabilidade sempre fez: partida publicada não se
-- despublica. Ela permanece, e a espelho ao lado a anula. As duas ficam no
-- razão, as duas contam, e a soma é zero — que é exatamente o que "estornado"
-- significa.
--
-- `reversed_by` deixa de ser adorno e passa a ser o marcador real: é ele que
-- diz que a partida foi anulada, e é ele que libera a chave de idempotência
-- para uma nova escrituração do mesmo fato.

DROP INDEX IF EXISTS uq_journal_entry_source_event;

CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entry_source_event
  ON journal_entry (company_id, source, source_id, event)
  WHERE source_id IS NOT NULL
    AND reversed_by IS NULL
    AND event IN ('ACCRUAL', 'SETTLEMENT');

-- Reabilita as partidas que o desenho antigo tirou do balancete. Elas têm
-- reversed_by preenchido, então continuam corretamente anuladas pela espelho —
-- só voltam a ser contadas dos dois lados.
UPDATE journal_entry
SET status = 'POSTED'
WHERE status = 'REVERSED' AND reversed_by IS NOT NULL;
