# Arena PvP — configuração do Supabase

O código do jogo já está pronto (`js/systems/pvp.js`, `js/data/pvpConfig.js`,
nova aba "🏟️ Arena PvP" dentro de "Outros"). Faltam só 3 passos manuais no
painel do seu projeto Supabase — nenhum deles precisa de instalar nada na
sua máquina.

## 1. Rodar o schema do banco

1. Abra o [painel do seu projeto](https://supabase.com/dashboard/project/xkcvvcvyzobnojgkkngy) → **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de `supabase/migrations/0001_pvp_arena.sql` e clique **Run**.
3. Isso cria 3 tabelas (`pvp_profiles`, `pvp_snapshots`, `pvp_matches`) e as
   políticas de RLS que garantem que um jogador só edita a própria linha e
   nunca escreve um resultado de luta direto no banco.

## 2. Habilitar login anônimo

O jogo usa **login anônimo** do Supabase Auth — sem e-mail/senha, sem
fricção nenhuma pro jogador.

1. **Authentication** → **Providers** (ou **Sign In / Providers**, o nome
   muda um pouco entre versões do painel).
2. Habilite **"Allow anonymous sign-ins"**.

## 3. Publicar a Edge Function que resolve as lutas

O código está em `supabase/functions/resolve-pvp-battle/index.ts`. É ELE
quem decide quem venceu — o cliente nunca decide isso sozinho (ver o
comentário no topo do arquivo pra entender por quê).

**Caminho mais simples (sem instalar nada):**
1. No painel: **Edge Functions** → **Create a new function**.
2. Nome: `resolve-pvp-battle` (tem que ser exatamente esse — é o nome que
   `js/systems/pvp.js` chama).
3. Cole o conteúdo de `supabase/functions/resolve-pvp-battle/index.ts` no
   editor e clique em **Deploy**.

**Caminho com a CLI (se preferir, ou pra deploys futuros mais rápidos):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref xkcvvcvyzobnojgkkngy
supabase functions deploy resolve-pvp-battle
```

## Depois disso

Abra o jogo, vá em **Outros → 🏟️ Arena PvP**, clique em **"Conectar à
Arena"**. Isso cria sua conta anônima, sobe suas stats atuais pro banco, e
já mostra o ranking. Pra testar um ataque de verdade, você vai precisar de
uma 2ª conta com stats diferentes — abra o jogo numa aba anônima do
navegador (ou em outro navegador) pra simular um 2º jogador.

## O que cada arquivo faz

| Arquivo | Papel |
|---|---|
| `migrations/0001_pvp_arena.sql` | Schema + RLS (rode 1x no SQL Editor) |
| `functions/resolve-pvp-battle/index.ts` | Resolve 1 ataque (deploy como Edge Function) |
| `../js/data/pvpConfig.js` | URL + chave pública do projeto (já preenchidas) |
| `../js/systems/pvp.js` | Cliente: login anônimo, sincronizar stats, buscar ranking/oponentes, atacar |
| `../js/ui/render.js` (`renderPvpTab`) | A tela da aba Arena PvP |
| `../js/main.js` (`refreshPvpTab`/`handlePvpAttack`) | Liga a UI ao `systems/pvp.js` |

## Próximos passos possíveis (ainda não implementados)

- Cooldown de ataque visível no cliente (hoje só o servidor recusa e a UI
  mostra o erro depois de tentar).
- Recompensa/penalidade pro jogador que foi atacado (hoje só quem ataca
  ganha ouro).
- Histórico de lutas (a tabela `pvp_matches` já guarda tudo, só falta uma
  tela pra mostrar).
- Sincronizar automaticamente as stats a cada X minutos, em vez de só
  quando o jogador clica "Sincronizar".
