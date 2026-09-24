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
│   └── carreira-no-rift/                # primeiro jogo
├── supabase/migrations/0001_site_accounts.sql
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
- **Com conta** (e-mail + senha + nome de usuário): o progresso vai para a
  nuvem logo após cada jogada, e cada partida terminada entra no histórico.
- **Ao entrar**, o que foi jogado como visitante é enviado para a conta, e
  o save mais recente (do aparelho ou da nuvem) vence.
- **Ao sair**, o aparelho é limpo; entrando de novo, tudo volta da nuvem.
- As contas usam o mesmo projeto Supabase do Idle Hunter, com tabelas
  próprias (`site_*`) e sessão separada (chave `rift-arcade-auth`), então
  não interfere no login anônimo do Idle Hunter.

## Configuração no Supabase (uma vez)

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
