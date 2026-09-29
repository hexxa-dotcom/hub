-- Chaves de serviços do escritório (não de um cliente), trocáveis pela tela de
-- Integrações. O valor fica cifrado (AES-256, secret-crypto.ts); a variável de
-- ambiente continua valendo como reserva quando não há nada salvo aqui.
CREATE TABLE IF NOT EXISTS segredo_da_plataforma (
  nome           text PRIMARY KEY,
  valor_cifrado  text NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
