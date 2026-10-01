ALTER TABLE financial_entry ADD COLUMN IF NOT EXISTS receipt_items jsonb;
ALTER TABLE payment_receipt ADD COLUMN IF NOT EXISTS verification_hash text UNIQUE;
