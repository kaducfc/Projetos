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
