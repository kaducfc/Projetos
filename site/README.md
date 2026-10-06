# Rift Arcade

Site de minigames com contas: um hub com a lista de jogos e o histórico do
jogador, mais os jogos em `jogos/`. HTML + CSS + JavaScript puro, sem build.

```
site/
├── index.html, css/hub.css, js/hub.js   # hub: jogos + "Seu histórico"
├── shared/
│   ├── config.js      # nome do site, chaves do Supabase, catálogo de jogos
│   ├── platform.js    # SDK: conta, saves e histórico (usado por todos os jogos)
│   ├── account.js     # barra do site + janela de Entrar/Criar conta
│   └── account.css
├── jogos/
│   ├── carreira-no-rift/                # simulador de carreira
│   ├── runetermo/                       # palavra do dia (estilo Termo)
│   ├── campeao/                         # adivinhe o campeão do dia
│   └── lendas-do-cblol/                 # monte um time com lendas do CBLOL e simule
├── supabase/migrations/   # 0001 contas, 0002 login com Google
├── supabase/email-templates/  # e-mails do Supabase em português
└── tests/             # testes do platform.js com um Supabase simulado
```

## Rodando localmente

```bash
cd site
python3 -m http.server 8000
# abra http://localhost:8000
npm test   # testes do sistema de contas
```

## Como funcionam as contas

- **Visitante:** tudo fica no `localStorage` do navegador (progresso e histórico).
- **Com conta** (e-mail + senha + nome de usuário): o progresso é salvo no
  navegador a cada jogada e enviado para a nuvem **no máximo 1 vez por
  minuto** (e na hora ao sair da aba ou ao terminar a partida). Se o servidor
  falhar, o envio é tentado de novo sozinho, esperando cada vez mais.
  Cada partida terminada entra no histórico.
- **Ao entrar**, o que foi jogado como visitante é enviado para a conta, e
  o save mais recente (do aparelho ou da nuvem) vence.
- **Ao sair**, o aparelho é limpo; entrando de novo, tudo volta da nuvem.
- O site usa um projeto Supabase só dele (separado do Idle Hunter).
  Enquanto `SUPABASE_URL` e `SUPABASE_ANON_KEY` estiverem vazios em
  `shared/config.js`, o site roda só em modo visitante.

## Configuração no Supabase (uma vez)

0. Crie um projeto novo em supabase.com e copie a **Project URL** e a
   **publishable key** (Project Settings → API) para `shared/config.js`.
1. **SQL Editor → New query:** cole `supabase/migrations/0001_site_accounts.sql`
   inteiro e clique em **Run**. Cria as tabelas `site_profiles`,
   `site_game_saves` e `site_game_results`, as regras de segurança (cada conta
   só vê os próprios dados) e o gatilho que cria o perfil no cadastro.
2. **Authentication → Providers → Email:** confirme que está habilitado.
   - Com **"Confirm email"** ligado (padrão), quem se cadastra recebe um link
     e só consegue entrar depois de confirmar. Para testar mais rápido, dá
     para desligar.
3. **Authentication → URL Configuration:** em **Site URL**, coloque o
   endereço onde o site vai ficar (ex.: `https://kaducfc.github.io/Projetos/arcade/`).
   O link do e-mail de confirmação leva para lá.

4. **Login com Google:** rode também `supabase/migrations/0002_google_login.sql`.
   Quem entra pelo Google escolhe o nome de usuário no primeiro acesso
   (função `site_claim_username`). No Google Cloud, crie um cliente OAuth
   "Web application" com o redirect `https://<projeto>.supabase.co/auth/v1/callback`
   e cole o Client ID e o Client Secret em **Authentication → Sign In / Providers → Google**.

## Painel do administrador

Em `painel/` (fora dos buscadores). Mostra visitantes por dia, carreiras
iniciadas e terminadas, contas novas e as médias da Carreira no Rift (OVR
máximo, temporadas, troféus, legado, rotas, regiões e as 10 melhores
carreiras). O site registra eventos anônimos em `site_events` (visita 1x por
dia por navegador, início e fim de partida, via `platform.track`); só a
função `site_admin_stats` lê essa tabela, e só para contas em `site_admins`.
Configuração: rode `supabase/migrations/0003_painel.sql` e depois o `0004_painel_runetermo.sql` (no fim dele fica o
e-mail do administrador). O link "Painel" aparece no menu da conta para quem
tem acesso.

## Perfil do jogador

`perfil/` (link "Meu perfil" no menu da conta): ícone (mascote ou campeão,
com borda na cor do elo), troca de nome (1 vez a cada 2 dias), troca/criação
de senha, situação na ranqueada, resumo e histórico de partidas por jogo e
exclusão da conta. Nomes com palavrões ou reservados são barrados
por `shared/nomes.js` (aviso na hora) e pela função `site_nome_proibido` do
banco (que decide de verdade). Configuração: rode
`supabase/migrations/0005_perfil.sql`.

## Ranqueada

Só da Carreira no Rift, para contas conectadas: valem as 3 primeiras carreiras
do dia (nota do dia = a maior). A cada ciclo de 3 dias somam-se as notas; quem
chegar aos pontos do próximo elo sobe 1 elo: Bronze → Prata (1500) → Ouro
(1950) → Platina (2250) → Diamante (2550) → Desafiante (2850, só 100 vagas).
Quem fizer menos de 1/6 da meta do próprio elo cai 1 elo (3 dias sem jogar
sempre derruba). Rankings diário, semanal e mensal em `ranking/`. Cada elo dá
um pequeno benefício nos outros jogos (`shared/ranked.js`). Emblemas em
`shared/assets/elos/`. As regras valem no banco (`0006_ranqueada.sql` +
`0007_ranqueada_pontos.sql`); os ciclos pendentes são fechados quando alguém
abre o ranking ou o perfil, sem tarefa agendada. Para o lançamento oficial (ou
nova temporada), o painel do administrador tem o botão **Zerar ranqueada**.

## Apoio (Mercado Pago)

Página `apoiar/` (links no menu da conta, no perfil e no rodapé). O apoio é
voluntário e só dá um cosmético: quem apoia (qualquer valor, mínimo R$ 5)
ganha automaticamente o efeito "Reflexo" no nick (`shared/apoio.js` + CSS em
`shared/account.css`), no perfil, no ranking e na barra do site.
Fluxo: o site chama a Edge Function `apoio-criar` (registra a doação pendente
e cria o pagamento no Checkout Pro do Mercado Pago) → a pessoa paga no Mercado
Pago (Pix, cartão, boleto) → o Mercado Pago avisa a Edge Function
`apoio-webhook`, que confere o pagamento na API do Mercado Pago e marca a
doação como aprovada → o banco soma o total da conta (`0008_apoio.sql`).
Configuração: rode `supabase/migrations/0008_apoio.sql`, crie as duas Edge
Functions (código em `supabase/functions/`, com "Verify JWT" desligado), guarde
o Access Token do Mercado Pago no segredo `MP_ACCESS_TOKEN` das Edge Functions
e mude `APOIO_ATIVO` para `true` em `shared/config.js`. O painel do
administrador registra apoios feitos por fora (Pix direto).

### Apoio internacional (Stripe)

Quando o site **não** está em português, a página `apoiar/` mostra, no lugar do
Mercado Pago, o botão de pagar com o **Stripe** (cartão, Apple Pay, Google Pay), em
dólar ou euro (`js/apoiar.js`). Fluxo: o site chama a Edge Function
`apoio-intl-criar` (cria a doação pendente e a sessão do Stripe Checkout) → a
pessoa paga no Stripe → `apoio-intl-webhook` recebe o aviso (assinatura
conferida) e marca a doação como aprovada. O valor vai para o banco em reais
(cotação em `USD_BRL` e `EUR_BRL`, só para somar o total e o painel) e o valor
real fica em `valor_original` + `moeda` (`0037_apoio_internacional.sql`).
Configuração: rode a 0037; crie as duas funções (código em `supabase/functions/`,
"Verify JWT" desligado); segredos: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
(opcionais: `USD_BRL`, `EUR_BRL`); cadastre o webhook (endereço e eventos no topo de
`apoio-intl-webhook/index.ts`). `APOIO_INTL_ATIVO` em `shared/config.js`:
`'admin'` (teste, só administradores) → `true` (público).

## Rift Coins (moeda do site)

Cada conta tem uma carteira de **Rift Coins (RC)**, mostrada na barra do site
(entre o idioma e o nome); por enquanto não há outra tela da moeda.
O saldo é privado: só a própria conta enxerga (`site_carteira`, separado do perfil
público) e tudo que entra ou sai fica no extrato (`site_moedas_lanc`). Ninguém
escreve direto nas tabelas; só as funções do servidor (`0038_moedas.sql`).
Por enquanto as moedas vêm de:
- **Códigos de recompensa:** recompensa tipo "Rift Coins" com a quantidade
  (ex.: 250), uma vez por conta (painel → Ferramentas → Códigos de recompensa; dá
  para salvar em modelos, junto com ícones e efeitos);
- **Ajuste do administrador:** painel → Jogador → cartão "Rift Coins" (dar ou
  tirar, com nota; o saldo nunca fica negativo).
Para o passe de batalha e a loja: o servidor já tem a função interna
`site_moedas_mexer(uid, delta, motivo, ref)` (soma ou tira e registra no extrato).
Nova origem = nova função de servidor que chame essa, com um `motivo` novo (`passe` e `compra` já têm texto traduzido). A arte da moeda está em
`shared/assets/moeda/` (o original enviado fica em `rc-original.png`).
Configuração: rode `supabase/migrations/0038_moedas.sql`. Sem ela, o indicador
na barra some e o resto do site continua igual.

## Passe de Batalha (em teste)

Primeira temporada: **Halloween 2026** (`0039_passe_batalha.sql`). Nível 0 (grátis,
libera na hora) + 15 níveis, cada um com uma recompensa (16 no total); as trilhas se alternam (0 grátis, 1 premium, 2 grátis…
até o 15, premium). Quem não tem o passe premium resgata só os níveis grátis.
Por enquanto: 500 RC em todos os níveis, e o efeito **Halloween 2026** (`hw-neon`)
no nível 15. Para mudar a recompensa de um nível, edite a linha em
`site_passe_niveis` (tipo `moeda` com a quantidade em `chave`, `efeito` ou `icone`).
- **Abóboras (progresso):** cada partida concluída, em qualquer jogo (ranqueada ou
  não, ganhando ou perdendo), dá abóboras sorteadas (7 a 10; Passe Premium 9 a 15 — só interno, o site não escreve esses valores; 0062_passe_aboboras_sorteio.sql), até 150 por dia (zera à meia-noite de
  Brasília); cada nível pede 100 abóboras. É um gatilho em `site_game_results`
  (`site_passe_ao_concluir`), então vale só para quem está conectado; visitantes
  não geram resultado no servidor e não têm passe.
- **Aviso ao terminar a partida:** `platform.recordResult` compara o "hoje" do passe
  antes e depois (sem travar o jogo) e emite o evento `passe`; `shared/passe-aviso.js`
  guarda o ganho e só mostra quando o jogo chama `liberarAbobora()`, ou seja, **no fim da
  partida, junto do aviso de PDR** (os avisos de fim de `shared/aviso-ranked.js` já
  chamam; a Lendas modo livre chama no `terminar()`). O cartão fica parado, acima do aviso
  de PDR, com a abóbora, "+N abóboras" (o valor que ganhou), a barra do nível e o botão "Ir para o passe";
  só fecha no ×. Só aparece quando o passe está disponível para a conta.
- **Página do passe:** `/passe/` (`passe/index.html`, `js/passe.js`): nível, barra e
  recompensas com o botão Resgatar. Está com `noindex` enquanto o passe é teste.
- **Teste:** enquanto `site_passes.publico = false`, só administradores acumulam
  abóboras e resgatam. A aba **Teste** do painel mostra o passe (`shared/passe.js`,
  `css/passe.css`) com controles para dar/tirar abóboras, ligar o premium e zerar o
  progresso da própria conta, e o botão **Publicar para todos os jogadores**.
- **Passe premium (só com dinheiro):** R$ 15 no **Mercado Pago** para quem usa o site em
  português do Brasil; US$ 10 no **Stripe** nos outros idiomas (`shared/passe-compra.js`:
  o botão "★ Premium" do cartão e o "★ Obter Premium" do cabeçalho abrem a janela de compra).
  O preço é decidido no servidor (Edge Function `passe-premium-criar`); a compra fica em
  `site_passe_compras` (`0042_passe_premium.sql`) e os webhooks que já existem
  (`apoio-webhook` do Mercado Pago e `apoio-intl-webhook` do Stripe) chamam
  `site_passe_confirmar_compra`, que liga a coluna `premium` (estorno desliga; as
  recompensas já resgatadas ficam). O administrador ainda pode ligar na aba Teste.
  Depois do pagamento a pessoa volta para `/passe/?compra=aprovado` e a página confere o
  premium por alguns segundos.
  Para publicar: rode a 0042; crie a função `passe-premium-criar` (Verify JWT desligado,
  mesmos segredos `MP_ACCESS_TOKEN` e `STRIPE_SECRET_KEY`); **republique** `apoio-webhook`
  e `apoio-intl-webhook` (código novo que reconhece as compras do passe).
- Para o efeito do nível 15 poder ser escolhido no perfil, ele precisa sair de
  `EFEITOS_TESTE` para `EFEITOS` em `shared/efeitos.js` (junto da publicação).
Configuração: rode `supabase/migrations/0039_passe_batalha.sql` e depois a `0040_passe_nivel.sql` e a `0041_passe_nivel0.sql`.

## Aviso de fã, páginas institucionais e doações

O rodapé (`shared/footer.js`) aparece no hub e em todos os jogos, com o aviso
curto de projeto de fã e links para **Quem somos** (`sobre/`),
**Privacidade** (`privacidade/`) e **Termos de uso** (`termos/`). O texto
completo sobre o projeto e as doações fica em `sobre/`. O e-mail de contato
dessas páginas vem de `CONTACT_EMAIL` no `shared/config.js`.

Para mostrar o botão **"Apoiar o projeto"**, coloque o link (Pix, Ko-fi,
Livepix…) em `DONATION_URL` no `shared/config.js`. Vazio, o botão some.

Jogos novos: incluam `<footer id="site-footer"></footer>` no `index.html` e
chamem `mountSiteFooter(document.getElementById('site-footer'))`.

## Publicação

O login só funciona com o site hospedado de verdade (GitHub Pages, Netlify,
Vercel…), servindo a pasta `site/` inteira. A versão em arquivo único do
Carreira no Rift (`jogos/carreira-no-rift/scripts/build-bundle.mjs`) roda só
em modo visitante, porque não alcança o servidor.

## Adicionando um jogo novo

1. Crie a pasta `jogos/<id-do-jogo>/` com o `index.html` do jogo.
2. No `index.html`, inclua `<div id="site-bar"></div>` e
   `<link rel="stylesheet" href="../../shared/account.css" />`.
3. No JavaScript do jogo:

```js
import * as platform from '../../shared/platform.js'; // ajuste os ../ ao caminho
import { mountSiteBar } from '../../shared/account.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
platform.init();

// Jogos com progresso longo (opcional):
const salvo = platform.loadLocalSave('meu-jogo');
platform.writeSave('meu-jogo', estado);

// Ao terminar uma partida (quiz, adivinhação etc.):
platform.recordResult('meu-jogo', {
  score: 8,                                   // aparece como "Pontos" e recorde
  summary: { text: '8 de 10 acertos', acertos: 8 },  // text aparece no histórico
});
```

4. Adicione o jogo em `GAMES` no `shared/config.js` (com `status: 'live'`).

## Idiomas

O site está em português (padrão) e tem um seletor de idioma na barra do topo
(English, Deutsch, Español, Italiano, Français). Como funciona:

- `shared/i18n.js` traduz o que aparece na tela (textos, `title`, `placeholder`,
  `aria-label`, `alt`), inclusive o que os jogos desenham depois. O texto em
  português é a "chave"; o que não tiver tradução continua em português.
- As traduções ficam em `shared/i18n/src/*.mjs`, em linhas
  `[português, en, de, es, it, fr]`. Depois de editar, rode
  `node scripts/i18n-build.mjs` (gera `shared/i18n/<idioma>.js`).
- Texto com valor no meio usa `{nome}`: `['Hoje: {pts} PDR', 'Today: {pts} RP', …]`.
- Nomes de jogadores, apelidos e avatares nunca são traduzidos (`.nick`, `.avatar`,
  `data-no-i18n`, `translate="no"`).
- A escolha fica salva no navegador (`localStorage`, chave `rift-lang`).
- `tests/i18n.test.mjs` confere que todo texto do inventário (`tests/i18n-inventario.json`)
  tem tradução nos 5 idiomas.

### Passe Premium no painel de Apoio

Rode `supabase/migrations/0043_painel_apoio_passe.sql` e republique a Edge Function `passe-premium-criar` (agora grava `valor_brl`). Na aba **Apoio** do painel, doações e compras do Passe Premium entram no mesmo total (Stripe em dólar convertido pela cotação `USD_BRL`); o seletor **Mostrar** isola só doações ou só Passe Premium. Quem compra o passe não vira "apoiador" (sem efeito dourado).

Para excluir um pagamento não concluído (aguardando, recusado ou cancelado) direto na lista da aba Apoio, rode `0044_painel_apoio_excluir.sql`. Aprovados e estornados não podem ser excluídos.

## Molduras (cosmético)

Imagem que envolve o ícone do jogador. Rode `supabase/migrations/0049_molduras.sql`. A arte fica em `shared/assets/molduras/<id>.webp` (quadrada, fundo transparente, buraco central centralizado; o `k` em `shared/molduras.js` é o diâmetro do buraco ÷ largura da imagem e define o tamanho em volta do ícone) e cada moldura é declarada em `shared/molduras.js` (`MOLDURAS_TESTE` = só administrador, aba Teste). Quem pode equipar é decidido no servidor (`site_recompensas`, tipo `moldura`); a escolha fica em Meu perfil → Moldura e aparece no perfil, ranking e barra do site. Também pode ser recompensa de nível do passe (`tipo = 'moldura'`).

**Passe encurtado (`0054_passe_10_niveis.sql`):** o passe Halloween 2026 passou a ter 10 níveis. Começa no nível 0 (sem recompensa); níveis ímpares são grátis e pares são premium (1 ícone Poro Assombrado, 2 500 RC, 3 300 RC, 4 moldura Abóboras e Espinhos, 5 ícone Halloween 2026, 6 efeito Teia de Aranha, 7 moldura Correntes e Caveiras, 8 moldura Vampito, 9 ícone Abóbora Sombria, 10 efeito Halloween 2026). Vale este arquivo no lugar dos 0045 a 0053 para as recompensas dos níveis.

**Loja de Rift Coins (`0055_loja_efeitos.sql`):** os efeitos **Brasa** e **Galáxia** são públicos e só se conseguem comprando por 2.000 RC cada, em Meu perfil → Efeito (botão "Comprar por 2.000 RC"). O preço fica na tabela `site_loja`; a compra (`site_loja_comprar`) desconta as moedas e libera o efeito na conta.

## Comprar Rift Coins (RC)

Clique no indicador de moedas da barra do site para abrir a janela de compra. Pacotes: 1.000 RC (R$ 10 / US$ 7), 3.000 RC (R$ 25 / US$ 17), 5.000 RC (R$ 40 / US$ 27) e 10.000 RC (R$ 70 / US$ 47). Português do Brasil paga em reais pelo Mercado Pago; inglês paga em dólar e os outros idiomas em euro (o dólar convertido pelas cotações `USD_BRL` e `EUR_BRL`), ambos pelo Stripe.

Para ativar: rode `supabase/migrations/0059_rc_compra.sql`, crie a Edge Function `rc-comprar-criar` (com "Verify JWT" desligado, mesmos segredos do passe premium) e republique `apoio-webhook` e `apoio-intl-webhook`. A confirmação chega pelos webhooks (`rc_<id>`), credita as moedas uma só vez e o estorno tira de volta o que ainda houver no saldo. As compras aparecem na aba Apoio do painel (tipo "Rift Coins").

**Estornos:** doação, Passe Premium ou compra de RC estornados aparecem num aviso "⚠ Estornos para verificar" no topo da aba Apoio (e em "Atenção" na Visão geral), com o que a pessoa já aproveitou (RC gastos, recompensas premium resgatadas). Clique no nome para abrir a ficha e banir, e depois em "Marcar como verificado". Requer `0060_estornos.sql`.

**Molduras de Rank (em teste, `0063_molduras_rank_teste.sql`):** dez artes, uma por elo (`shared/assets/molduras/elo-<elo>.webp`, tamanho calculado pelo buraco de cada uma). "Rank" é uma moldura só (`rank`): quem a equipa mostra sempre a do elo atual e ela troca sozinha quando o jogador sobe ou desce de elo (o elo vem da classe `elo-*` que as telas já passam ao `avatarHtml`). Por enquanto só administradores a recebem; para lançar, dar `rank` a todos (mover o item de `MOLDURAS_TESTE` para `MOLDURAS` em `shared/molduras.js` e liberar a moldura para todas as contas no servidor).
