-- De onde veio cada alíquota do tax_history.
--
-- ── O problema ─────────────────────────────────────────────────────────────
--
-- `tax_history` guardava duas coisas diferentes sob o mesmo formato: a
-- alíquota EFETIVA que o OneFlow apurou, e uma estimativa interna calculada
-- pela alíquota NOMINAL da faixa. O cálculo do imposto aproximado lê a linha
-- mais recente e a trata como apuração real.
--
-- Enquanto o cron de fechamento gravou estimativas ali, a leitura pegava a
-- nominal. A diferença não é cosmética: numa empresa no Anexo III com RBT12 de
-- R$ 706 mil, a nominal é 13,5% e a efetiva fica perto de 10% — o cliente via
-- um imposto um terço maior que o real em toda nota.
--
-- ── Por que uma coluna, e não uma limpeza ──────────────────────────────────
--
-- Apagar as linhas resolveria hoje e não impediria amanhã. A tabela precisa
-- saber distinguir as duas coisas, porque as duas têm razão de existir: a
-- estimativa serve para a empresa que ainda não tem apuração importada.

ALTER TABLE tax_history
  ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'ESTIMATE';

-- Backfill pela única marca que as distingue nos dados existentes: o cron
-- antigo escrevia a faixa ("Anexo III - Faixa 3"), o retorno do OneFlow grava
-- só o anexo ("Anexo III"). É uma regra frágil como heurística de runtime,
-- mas exata aqui, aplicada uma vez sobre um conjunto conhecido.
UPDATE tax_history
   SET source = 'ONEFLOW'
 WHERE tax_bracket NOT LIKE '%Faixa%';

COMMENT ON COLUMN tax_history.source IS
  'ONEFLOW = apuração real importada; ESTIMATE = cálculo interno. Só ONEFLOW alimenta o imposto aproximado.';

-- A leitura do imposto aproximado busca a linha mais recente de uma empresa
-- entre as apuradas.
CREATE INDEX IF NOT EXISTS tax_history_apuracao_idx
  ON tax_history (company_id, source, reference_month DESC);
