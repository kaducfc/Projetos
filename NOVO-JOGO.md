# Checklist: lançar um jogo novo no Rift Arcade

O catálogo `site/shared/config.js` (`GAMES`) é a fonte única. O que sai dele **sozinho**:

- card no hub (nome, descrição, selo, botão) e o filtro do perfil;
- card "Minha ranqueada" (perfil e ranking): linha do jogo com PDR do dia e vagas;
- painel "hoje" da página inicial (contagem de jogos feitos) e a linha de vagas do card do hub;
- abóboras do Passe de Batalha: qualquer partida registrada com `platform.recordResult(gameId, …)` rende abóboras.

## 1. Catálogo
Nova entrada em `GAMES`. Para valer PDR, inclua `ranked`:
`ranked: { modo: 'vagas' | 'diario', selo: 'Ranqueada' }` (`nome`, `rotulo` e `sub` só se forem diferentes do padrão).
Enquanto estiver em teste: `soAdmin: true` (some do hub/perfil e bloqueia a página para quem não é admin). Para lançar, apague essa linha.

## 2. Capa do hub
`site/js/hub.js`: uma entrada em `CAPAS` (arte da capa) e, se for diferente das duas linhas padrão (vagas/diário), uma em `VIVO`.

## 3. Jogo
- Ao terminar: `platform.recordResult(GAME_ID, { score, summary })` (alimenta recorde, histórico e passe).
- Ranqueada por vagas: `platform.rankedIniciar(jogo)` no começo (ou RPC próprio, como o Barão) e os avisos de
  `shared/aviso-ranked.js` (adicione o jogo em `NOMES`: `{ uma, varias }`).
- Sons/idiomas: textos novos precisam de linha em `shared/i18n/src/*.mjs` e `node scripts/i18n-build.mjs`.

## 4. Servidor (SQL, rodar no Supabase)
- `site_rk_iniciar`: incluir o id na lista de jogos aceitos e em `site_rk_meu` ('vagas'). A migração `0065` mostra como.
- Regra de PDR do jogo: função `site_rk_base_<jogo>` e lançamento por `site_rk_lancar(uid, dia, jogo, 'partida', valor)`.
- Limite diário: `limite constant int` em `site_rk_iniciar` (hoje 3, migração `0067`).
- Jogos com respostas secretas: lógica no servidor (padrão do Barão, `0066`); dados fora de `site/`.

## 5. Testes e conferência
`node --test tests/*.test.mjs` (há um teste que confere o card da ranqueada contra o catálogo).
Abra hub, perfil e ranking logado e confira: card do jogo, linha de PDR/vagas, aviso no começo e no fim da partida.
