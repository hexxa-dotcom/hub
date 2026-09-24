-- Clientes que nascem das notas, e propostas que o cliente aceita por link.

-- Proposta ligada ao cliente, com link público de aceite (/p/<token>), o
-- registro de quem aceitou, e o que é preciso para virar contrato.
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customer(id) ON DELETE SET NULL;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS decided_by_name text;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS decided_by_email text;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS decided_ip text;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS decision_note text;
-- MENSAL: o total é por mês (vira contrato recorrente); UNICA: pagamento único.
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS recorrencia text NOT NULL DEFAULT 'MENSAL';
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS prazo_meses int;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS contract_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS proposal_public_token_key ON proposal (public_token) WHERE public_token IS NOT NULL;

-- Todo tomador de nota EMITIDA vira cliente (pelo documento), sem duplicar.
INSERT INTO customer (company_id, name, document, type)
SELECT DISTINCT ON (d.company_id, d.tomador_documento)
       d.company_id, d.tomador_nome, d.tomador_documento,
       CASE WHEN length(d.tomador_documento) = 11 THEN 'PF' ELSE 'PJ' END
  FROM nfse_distribuicao_doc d
 WHERE d.tipo_documento = 'NFSE' AND d.direction = 'EMITIDA'
   AND d.tomador_documento IS NOT NULL AND d.tomador_nome IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM customer c
      WHERE c.company_id = d.company_id
        AND regexp_replace(coalesce(c.document, ''), '[^0-9]', '', 'g') = regexp_replace(d.tomador_documento, '[^0-9]', '', 'g')
   )
 ORDER BY d.company_id, d.tomador_documento, d.data_emissao DESC;

-- CPF cadastrado como PJ (cadastros antigos): corrige o tipo pelo tamanho.
UPDATE customer SET type = 'PF'
 WHERE length(regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g')) = 11 AND type <> 'PF';
