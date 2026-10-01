# Recibos — emissão e agendamento

O código aproveita o modelo de aluguel existente e adiciona emissão de recibos de pagamento para qualquer empresa. Cada recibo aponta para um `financial_entry` de recebimento já pago e com data de pagamento. A emissão preserva os dados e o PDF, sem criar outro recebível, receita, nota ou imposto.

## Revisão local

Na raiz de `Hub`, iniciar `npm run dev -w @hexxa/web -- --hostname 127.0.0.1 --port 3001`.

- `/previa/recibos`: holdings, com dados fictícios e ações em memória.
- `/previa/recibos?tipo=servicos`: outras empresas.
- `/meu-negocio/recibos`: operação autenticada, após aplicar a migração.

A demonstração e os PDFs de exemplo só estão disponíveis fora de produção. O envio real de e-mails em desenvolvimento exige `RECEIPT_ALLOW_EMAIL=true`; por padrão fica desativado. A demonstração nunca usa a conexão de banco nem envia mensagens, mesmo com essa variável habilitada.

## Banco e funcionamento

Antes de usar a operação com dados reais, aplicar `packages/db/migrations/0110_recibos.sql` ao ambiente escolhido. As migrações 0110, 0111 e 0112 foram aplicadas em transação ao banco configurado do Hub em 30/09/2026, na ativação para deploy. Como as demais migrações SQL manuais posteriores à primeira, ela não está no journal inicial do Drizzle: não assumir que `db:migrate` a executará.

- `payment_receipt`: emissão única por recebimento, dados preservados, PDF e cancelamento.
- `receipt_schedule`: emissão única ou mensal por contrato de aluguel.
- `receipt_share`: token aleatório de 256 bits, guardado como hash, expiração em 7 dias.
- `receipt_delivery`: registro de tentativas de e-mail e chave de idempotência para a agenda.

A emissão trava o recebível dentro da transação e conta também com unicidade no banco. Todas as consultas do portal são limitadas à empresa ativa. A rota pública `/r/<token>` só entrega recibos válidos associados a um pagamento ainda registrado como pago. Links de recibos cancelados deixam de funcionar.

Os botões em Patrimônio > Aluguéis e no detalhe dos recebimentos do Financeiro usam o mesmo serviço da área Recibos. O comprovante anexado ao financeiro continua separado do recibo emitido. NFS-e local usa `source_id`; NFS-e sincronizada usa `external_id`/chave de acesso para vincular a nota correta.

O cron `/api/cron/recibos-agendados` exige `CRON_SECRET` e participa do turno da manhã do orquestrador. A agenda aguarda o pagamento, mantém as falhas visíveis e não salta uma ocorrência que falhou. A recorrência conserva o dia original mesmo em meses curtos. O e-mail de locação é obtido do cadastro de cliente apenas quando há um único nome correspondente dentro da mesma empresa; se não houver, o envio manual permite informar o destinatário. Uma tentativa de e-mail com resultado incerto exige conferência, evitando repetição automática.

## Integração fiscal ainda pendente

Outras empresas: `fiscal_eligible=false` e `NAO_APLICAVEL`, inclusive quando o recibo comprova pagamento de NFS-e. A nota segue seu fluxo fiscal existente, sem ser duplicada pelo recibo.

Holding: somente aluguel pago de imóvel `owner_type= PJ` fica elegível. Recibo de imóvel pessoal de sócio identifica o sócio como locador e não é elegível. Os elegíveis ficam em `AGUARDANDO_CONFIGURACAO`; nenhum deles é enviado ao ONEFLOW por este código.

Ainda falta definir com o usuário o momento/mês de reconhecimento fiscal (emissão ou recebimento), validar a transmissão de um documento de modelo **Recibo**, configurar o serviço de locação e integrar a conferência fiscal/contábil para impedir duplicidade. A elegibilidade operacional não define o regime fiscal nem habilita envio.

Verificação da API pública em 30/09/2026: `NFSeOneFlow` no endpoint `/oneflow/empresa/fiscal/nfse/layoutoneflow` não expõe um campo de modelo Recibo. Não reutilizar automaticamente esse endpoint ou inventar LC116/ISS para aluguel. Não foi realizada chamada autenticada ou alteração no ONEFLOW.

Fontes oficiais consultadas:

- [Especificação OneFlow 2.0.0](https://api.swaggerhub.com/apis/oneflowoficial/integracoes/2.0.0)
- [Inclusão de NFS-e ou recibo no OneFlow](https://ajuda.omie.com.br/pt-BR/articles/15266090-incluindo-uma-nota-fiscal-de-servico-ou-recibo-via-digitacao-no-oneflow)
- [Escrituração automática de recibos do Omie](https://ajuda.omie.com.br/pt-BR/articles/3615933-habilitando-a-escrituracao-automatica-de-recibos-no-oneflow)

## Validação

`npm run typecheck -w @hexxa/web` e os testes de `recibo-rules`, `recibos` e `recibo-aluguel-pdf`. Os testes do serviço usam banco simulado e conferem vínculo da nota, recusa de pagamento pendente, preservação do PDF, isolamento por empresa e emissão repetida. Não substituem validação da migração e da concorrência em PostgreSQL real.

Para gerar os PDFs de exemplo durante os testes, definir `RECEIPT_PREVIEW_OUTPUT` para uma pasta local. Os modelos foram renderizados e inspecionados em A4, uma página cada. Os PDFs de exemplo ficam em `output/pdf` e não são documentos reais.

## Discriminação e consulta pública

Aplicar também `0111_recibo_discriminacao_verificacao.sql` na ativação (aplicada na ativação em 30/09/2026).
Principal, juros e descontos são extraídos automaticamente do recebimento. Em Pendentes → Discriminar valores, é possível editar até oito itens e vincular uma despesa PAYABLE da própria empresa. Despesas não são adicionadas só por existirem no financeiro: o vínculo é explícito, pois nem toda despesa deve ser cobrada do pagador. A soma em centavos deve coincidir com o total recebido; não altera o lançamento financeiro. A emissão agendada lê os itens do recebimento daquele mês, sem copiar cobranças antigas para outro mês.

Novas emissões salvam QR com token aleatório permanente para `/recibo/verificar/[token]`. O banco guarda o hash; a URL é preservada no snapshot/PDF. A consulta exibe somente emissor, número, referência, valor, data e estado atual. Cancelamento ou reversão do pagamento invalida a consulta. Não expõe CPF, contato, PDF ou endereço do pagador. O link temporário de compartilhamento continua separado.

Definir `RECEIPT_PUBLIC_URL` com a origem pública do Hub antes da ativação; local usa `http://127.0.0.1:3001`. Recibos históricos não são reescritos. Prévia pública fictícia: `/previa/recibos/verificar` (somente desenvolvimento).

O renderer verifica uma única página, tenta uma composição mais compacta quando necessário e bloqueia a emissão se o conteúdo continuar excedendo A4; não corta informações silenciosamente.

## Assinatura eletrônica automática no Hub

Aplicar `0112_recibo_assinatura.sql` na ativação; aplicada na ativação em 30/09/2026. A autorização é opt-in, apenas pelo usuário pessoal OWNER com cadastro aprovado e CPF informado. Registra versão do texto aceito, identidade, data, IP e navegador. Pode ser desativada para os próximos recibos sem apagar o histórico. O modo sem login não pode autorizar em nome do dono. A emissão manual e o cron consultam a autorização vigente e o vínculo do responsável. Não assina recibos de imóveis pessoais dos sócios em nome da empresa.

Novos PDFs exibem assinatura eletrônica interna, responsável e data. Guarda hash canônico do conteúdo, hash do snapshot completo e SHA-256 dos bytes do PDF. A consulta pública valida integridade antes de mostrar nome e data da assinatura. CPF, IP, e-mail e autorização não são exibidos publicamente. É o mesmo modelo de evidência eletrônica interna usado pelos contratos HUB; não implementa assinatura PAdES/ICP-Brasil com certificado A1 nem assinatura de carteira externa. O A1 atual assina XML das notas fiscais.

No desenvolvimento, `?assinado=true` na prévia do PDF mostra uma assinatura explicitamente fictícia, sem registrar consentimento ou assinar documentos reais.

A emissão manual abre a opção “Assinar eletronicamente este recibo”. É possível desmarcar mesmo com a autorização automática ativa. Sem autorização do recebedor, a emissão manual segue sem assinatura. O cron continua seguindo a autorização vigente da empresa. Recibos existentes são imutáveis; uma nova escolha não reescreve o PDF já emitido.
