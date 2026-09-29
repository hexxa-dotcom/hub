-- Formulário "Fale com a gente" do site: antes só ia para o log do servidor.
CREATE TABLE IF NOT EXISTS contato_do_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  area text,
  origem text NOT NULL DEFAULT 'site',
  atendido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contato_do_site_aberto_idx ON contato_do_site (created_at DESC) WHERE atendido_em IS NULL;
