# Handoff: Site Hexx Digital (Next.js)

## Visão geral
Site institucional + funil de contratação da **Hexx Digital**, contabilidade digital para empresas de serviço. São 4 telas: home, página de planos (comparação), checkout e login (cliente/contador). O objetivo é substituir o site atual (`hexx-hub.vercel.app`) com a identidade visual nova, preços reais e checkout funcional.

## Sobre os arquivos de design
Os arquivos em `referencia/` são **referências de design feitas em HTML**: protótipos que mostram o visual e o comportamento, **não código de produção para copiar**. A tarefa é **recriar essas telas em Next.js** (App Router + TypeScript + Tailwind), usando padrões idiomáticos do framework.

Para abrir as referências: sirva a pasta `referencia/` com qualquer servidor estático (`npx serve referencia`) e abra `Hexx Site v2.dc.html`. Cada arquivo `.dc.html` tem o markup (estilos inline) e, no fim, um `<script data-dc-script>` com a lógica e os dados da tela (`renderVals()`).

## Fidelidade
**Alta fidelidade.** Cores, tipografia, espaçamentos, textos e interações são finais. Recriar com precisão de pixel. Todos os textos (copy) estão em português e são definitivos, exceto onde está marcado como PENDENTE.

## Stack sugerida
- Next.js 14+ (App Router), TypeScript, Tailwind
- `next/font/google`: Sora (300, 400, 600, 700) e JetBrains Mono (400, 500)
- Framer Motion (ou CSS + IntersectionObserver) para as animações
- React Hook Form + Zod nos formulários
- Asaas (pagamentos), Resend (e-mail do formulário), autenticação do Hexx Hub existente (ou Supabase/NextAuth)
- Deploy na Vercel com o domínio `hexxdigital.com.br`

## Estrutura de rotas
```
app/
  layout.tsx              fontes, metadados base, favicon
  page.tsx                home
  planos/page.tsx         comparação completa
  checkout/page.tsx       fluxo em 3 passos + confirmação (client component)
  login/page.tsx          cliente | contador (?perfil=contador)
  termos/page.tsx         PENDENTE: texto jurídico
  privacidade/page.tsx    PENDENTE: política LGPD
  not-found.tsx           404 na identidade
  api/contato/route.ts    recebe o formulário → Resend/CRM
  api/checkout/route.ts   cria cliente + assinatura no Asaas
  api/webhooks/asaas/route.ts  confirma pagamento → libera acesso
src/data/planos.ts        ← JÁ PRONTO: fonte única de preços e regras
src/theme/tokens.ts       ← JÁ PRONTO: tokens para o Tailwind
public/brand/             logos SVG, fotos de perfil, ícone de app
```

## Tokens de design
Ver `src/theme/tokens.ts`. Resumo:
- **Cores:** grafite `#0E0E10`, grafite 2 `#1C1C20`, grafite 3 `#2A2A2E`, papel `#F3F2EE`, verde-limão `#B9E86B` (hover `#CBF08E`); cinzas `#E1E0DA` `#C9C8C2` `#B8B8B4` `#8A8A86` `#5A5A56` `#3A3A38`.
- **Proporção de cor:** ~60% grafite, 30% papel, 10% verde. O verde é só **acento**: botão principal, números em destaque, pontos de status e linha da aba ativa. Nunca como fundo de seção inteira.
- **Cantos:** retos (radius 0) em botões, cartões e inputs. Só avatares e pontos de status são círculos.
- **Tipografia:** Sora para títulos e texto; JetBrains Mono para números, preços, rótulos e etiquetas.
- **Container:** `max-width: 1240px`, padding lateral 32px. Seções com padding vertical de 112px (hero: 96px em cima e 88px embaixo).
- **Grids responsivos:** `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, com N entre 300 e 420 conforme o bloco. Nada de largura fixa.

## Telas

### 1. Home (`referencia/Hexx Site v2.dc.html`)
Ordem das seções, alternando o fundo:
1. **Header fixo** (grafite 92% + blur, borda `#1C1C20`): logo horizontal negativo (26px de altura) · nav (A Hexx, Planos → /planos, Depoimentos, Perguntas) · botões "Entrar" (contorno `#3A3A38`, vai para /login) e "Experimentar a Hexx" (verde, vai para #planos).
2. **Hero** (grafite): etiqueta mono "Para empresas de serviço, agências, devs e consultorias" · h1 "Contabilidade e gestão financeira. **Sem burocracia.**" (a segunda frase em verde) · subtítulo · 2 botões. À direita, um **painel de saldo** (fundo `#1C1C20`, borda `#2A2A2E`) com o saldo que **conta de 0 até R$ 48.920,00 em 1,4 s (easing cubic-out)**, 3 lançamentos e 2 métricas (Próximo DAS, Fator R). Símbolo gigante ao fundo com opacidade .06. Variante opcional: hero em papel.
3. **Faixa "Feito para"**: rolagem contínua (`translateX(0 → -50%)`, 45 s, linear, infinita, conteúdo duplicado) com máscara de fade nas bordas.
4. **01 — A Hexx por dentro** (papel): 5 abas (Caixa & Cobranças, NFSe 1-clique, Propostas & Contratos, Bússola Tributária, Lucros & Cofre). Aba ativa: fundo grafite + `inset 0 -3px 0 #B9E86B`. Ao trocar, o painel faz fade-out em 200 ms (opacidade 0, translateY 8px), troca o conteúdo e faz fade-in. Os dados das abas estão em `renderVals()`, no array `T`.
5. **02 — Recursos** (papel): grade de 6 cartões com gap de 1px sobre fundo grafite, criando linhas de 1px. Hover: fundo branco.
6. **03 — Histórias reais** (grafite): 3 depoimentos em `#1C1C20`. Etiqueta de resultado com contorno e texto verde. Hover: sobe 3px e a borda fica `#3A3A38`.
7. **04 — Planos** (papel):
   - Chave **Anual | Mês a mês** (começa em Anual).
   - 3 cartões: Sem movimento · **Simples** (fundo grafite, "Mais escolhido", chave Completo | Light que começa no Completo) · Presumido (com link para plano sob medida no WhatsApp).
   - Cada cartão mostra o preço (mono 44px), "/mês no anual" ou "/mês", e a economia no ano.
   - Abaixo: bloco "Em todos os planos" (adicionais) + "Pagamento" (regras) + "Precisa de algo diferente?" → WhatsApp.
   - Depois, o **bloco MEI** (`#1C1C20`): "Você é MEI? Temos uma condição especial pra você."
   - Link "Ver a comparação completa" → /planos.
   - Botão de cada plano → `/checkout?plano=<id>&cobranca=<anual|mensal>`.
8. **05 — Atendimento** (`#1C1C20`): 4 itens numerados.
9. **06 — Perguntas frequentes** (papel): acordeão com 7 perguntas, só uma aberta por vez, a primeira aberta ao carregar. Abre com `grid-template-rows 0fr → 1fr` em 350 ms, e o "+" gira 45° até virar "×".
10. **Contato** (`#1C1C20`): título, 3 benefícios e o formulário em um cartão grafite (nome, e-mail, WhatsApp, área de atuação). Ao enviar, mostra "Recebemos seu contato."
11. **Rodapé**: assinatura vertical · slogan · colunas de navegação e contato · linha legal com **CNPJ 62.414.421/0001-16 · Contador responsável CRC SC-047967/0-2** · links para termos, privacidade e cookies.
12. **Botão flutuante de WhatsApp** (verde, canto inferior direito).

**Animação de entrada (todas as seções):** cada bloco começa em opacidade 0 e translateY 18px, e vai para 1/0 ao entrar na tela (IntersectionObserver com threshold .12 e rootMargin `-40px` embaixo). Transição de .7s `cubic-bezier(.2,.7,.2,1)`. Filhos de grades entram em sequência, com 80 ms entre cada um. Respeitar `prefers-reduced-motion`.

### 2. Planos (`referencia/Hexx Planos.dc.html`)
- Hero grafite com a chave Anual | Mês a mês (também lida de `?cobranca=`).
- Tabela com 5 colunas: `minmax(0,1.2fr) repeat(4,1fr)`. A **3ª coluna de plano (Simples Completo) tem fundo grafite** do começo ao fim.
- Cabeçalho da tabela fixo durante a rolagem, com nome, preço e botão "Contratar". Blocos: Para quem é · Contabilidade e fiscal · Sócios · Funções do Hub · Preço. Hover na linha: `#ECEBE6`.
- ✓ em mono 16px e "—" em cinza.
- No celular a tabela rola na horizontal (largura mínima de 880px). Se possível, manter a primeira coluna fixa.
- Abaixo da tabela: adicionais, regras de pagamento, bloco MEI e chamada final com WhatsApp.

### 3. Checkout (`referencia/Hexx Checkout.dc.html`)
Layout em 2 colunas (flex-wrap): conteúdo (flex 999 1 520px) + **resumo fixo** (grafite, flex 1 1 300px). Parâmetros lidos da URL: `?plano=` e `?cobranca=`.
- **Barra de passos:** Plano · Dados · Pagamento. Passos concluídos mostram ✓ verde e são clicáveis para voltar.
- **Passo 1, Plano:** chave de cobrança + lista de 5 planos em cartões de seleção, com o selecionado em grafite. O MEI aparece aqui.
- **Passo 2, Dados:** chave "Já tenho CNPJ | Ainda não tenho". Sem CNPJ, os campos de CNPJ e razão social somem e aparece um aviso de que a Hexx abre a empresa. Campos: CNPJ, razão social, nome, CPF, e-mail e WhatsApp, com máscaras (`00.000.000/0000-00`, `000.000.000-00`, `(00) 00000-0000`). **Adicionar:** validação de dígitos de CNPJ e CPF e consulta automática do CNPJ (BrasilAPI) para preencher a razão social.
- **Passo 3, Pagamento:**
  - Métodos conforme a cobrança: **anual → só cartão (12× de `anual`)**; **mês a mês → Pix, boleto ou cartão (5% de desconto)**.
  - Dados do cartão: número, nome, validade e CVV. Aceite dos termos obrigatório.
  - O botão mostra "Processando…" durante o envio.
- **Confirmação:** o texto muda conforme o método. No Pix, mostra QR Code e copia e cola **reais do Asaas** (hoje são marcadores). Três próximos passos e um botão para /login.
- **Resumo:** plano, itens, tipo de cobrança, total (anual: "12× R$ X", com o total do ano e a economia; mensal no cartão: valor com desconto) e os adicionais (no MEI, só "Empregado do MEI").
- Cálculos em `src/data/planos.ts` (`valorMensal`, `totalAnual`, `economiaAno`, `metodosPermitidos`).

### 4. Login (`referencia/Hexx Login.dc.html`)
- Tela dividida: painel esquerdo em `#1C1C20` (logo, título e texto que mudam por perfil, símbolo verde ao fundo) e formulário à direita (largura máxima de 400px).
- Chave "Sou cliente | Sou contador" (`?perfil=contador` abre direto na segunda).
- E-mail, senha com botão mostrar/ocultar, "Manter conectado" e "Esqueci minha senha", que abre uma tela de recuperação com mensagem neutra: "Se o e-mail estiver cadastrado…".
- Ao entrar, mostra "Entrando…" e depois uma tela de sucesso com barra de progresso. **Na produção:** autenticar de verdade e redirecionar para o painel do Hub.

## Integrações (o que precisa funcionar)
1. **Formulário de contato:** `POST /api/contato` com validação Zod, proteção contra spam (honeypot + limite de requisições ou Turnstile) e envio via Resend para `contato@hexxdigital.com.br` ou para o CRM.
2. **Asaas:**
   - Criar o cliente com CPF/CNPJ, nome, e-mail e telefone.
   - Criar a cobrança conforme a cobrança escolhida:
     - Anual: cobrança parcelada no cartão, 12× de `anual`, com `installmentCount: 12`.
     - Mês a mês no Pix ou boleto: assinatura mensal (`/subscriptions`) de `mensal`.
     - Mês a mês no cartão: assinatura mensal de `mensal × 0,95`.
   - Tokenizar o cartão no cliente, nunca trafegando o número pelo servidor sem necessidade.
   - Mostrar o QR Code e o copia e cola retornados pelo Asaas.
   - Webhook `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → criar o acesso no Hub e enviar e-mail e WhatsApp de boas-vindas.
3. **Autenticação:** integrar ao sistema do Hexx Hub (rotas atuais `/auth/login` e `/auth/login/contador`), com os papéis `cliente` e `contador` separados.
4. **SEO:** `metadata` por página, imagem Open Graph 1200×630 com a marca nova, `sitemap.ts`, `robots.ts` e favicon (`public/brand/hexx-simbolo-positivo.svg`).
5. **Medição:** GA4 ou Meta Pixel, com os eventos `view_plans`, `begin_checkout`, `add_payment_info`, `purchase` e `generate_lead`.
6. **Cookies e LGPD:** banner de consentimento antes de carregar os scripts de medição.

## Estado (resumo)
- Home: `tab`, `faqAberta`, `cobranca` (`'anual'` por padrão), `varianteSimples` (`'completo'` por padrão), `formEnviado`, `saldoAnimado`.
- Planos: `cobranca`.
- Checkout: `passo` (0–3), `plano`, `cobranca`, `temCnpj`, `metodo`, campos do formulário, `carregando`, `pixCopiado`.
- Login: `perfil`, `tela` (`login` | `recuperar` | `sucesso`), `mostrarSenha`, `carregando`.

## Assets
- `public/brand/`: todos os logos em SVG, em positivo, negativo, branco, preto e na cor sinal, nas versões horizontal, vertical, com e sem tagline, e o símbolo sozinho.
  - No header: `hexx-horizontal-negativo.svg`.
  - No rodapé: `hexx-vertical-negativo.svg`.
  - Símbolos de fundo: `hexx-simbolo-branco.svg` e `hexx-simbolo-sinal.svg`.
- `public/brand/perfil/`: fotos de perfil 1080×1080 para Instagram e WhatsApp.
- `public/brand/app-icon-grafite.png`: ícone de app 1024px.
- Os logos já estão em curvas; nenhum depende de fonte instalada.

## PENDENTE (depende da Hexx)
- Textos de termos de uso e da política de privacidade.
- Fotos reais para os depoimentos (hoje aparecem iniciais).
- Os números do painel do hero e das abas são exemplos ilustrativos. Confirmar se ficam.
- Captura real do painel do Hub, se quiserem trocar o painel simulado.
- Simulador de economia (existe no site atual em `/simulador`). Decidir se entra no site novo.

## Arquivos
- `referencia/Hexx Site v2.dc.html`: home
- `referencia/Hexx Planos.dc.html`: comparação de planos
- `referencia/Hexx Checkout.dc.html`: checkout
- `referencia/Hexx Login.dc.html`: login
- `referencia/support.js`: runtime que faz as referências funcionarem no navegador (não usar no projeto)
- `src/data/planos.ts`: dados e regras de preço, prontos para importar
- `src/theme/tokens.ts`: tokens de design
