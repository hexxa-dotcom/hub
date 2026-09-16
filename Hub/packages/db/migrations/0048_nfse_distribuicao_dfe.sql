-- Sincronização com a Distribuição de DF-e do Sistema Nacional NFS-e (ADN).
-- Permite enxergar valores de notas (emitidas OU recebidas pelo CNPJ da
-- empresa) direto do governo, sem depender de emissão pelo Hub nem de
-- integração com o sistema próprio de cada município.

alter table nfse_config
  add column if not exists ult_nsu_distribuicao bigint not null default 0;

create table if not exists nfse_distribuicao_doc (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  nsu bigint not null,
  chave_acesso text not null,
  tipo_documento text not null, -- NFSE | EVENTO | DPS | PEDIDO_REGISTRO_EVENTO | CNC
  tipo_evento text, -- preenchido quando tipo_documento = EVENTO (ex: CANCELAMENTO)
  direction text, -- EMITIDA | RECEBIDA (null para EVENTO/outros)
  numero_nfse text,
  municipio_emissao text,
  data_emissao timestamptz,
  valor_servico numeric(14, 2),
  valor_liquido numeric(14, 2),
  valor_iss numeric(14, 2),
  prestador_cnpj text,
  prestador_nome text,
  tomador_documento text,
  tomador_nome text,
  descricao_servico text,
  item_lista_servico text,
  cancelado boolean not null default false,
  data_hora_geracao timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, nsu)
);

create index if not exists nfse_distribuicao_doc_company_data_idx
  on nfse_distribuicao_doc (company_id, data_emissao);

create index if not exists nfse_distribuicao_doc_chave_idx
  on nfse_distribuicao_doc (company_id, chave_acesso);

notify pgrst, 'reload schema';
