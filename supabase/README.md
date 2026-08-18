# Arena PvP — configuração do Supabase

O código do jogo já está pronto (`js/systems/pvp.js`, `js/data/pvpConfig.js`,
aba "🏟️ Arena PvP" dentro de "Outros"). Você já rodou o **Passo 1**
(`0001_pvp_arena.sql`) e publicou a Edge Function antiga — agora o sistema
ganhou Tiers/Rank, bots e o sistema de Entradas, então faltam mais alguns
passos (um SQL novo + reenviar o código da Edge Function, que mudou).

## 1. Rodar o schema base (já feito, se você seguiu o guia anterior)

`supabase/migrations/0001_pvp_arena.sql` no SQL Editor — cria
`pvp_profiles`/`pvp_snapshots`/`pvp_matches` + RLS. Pule se já rodou.

## 2. Rodar o schema dos Tiers (NOVO — precisa rodar agora)

1. **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de `supabase/migrations/0002_pvp_tiers.sql` e
   clique **Run**.
3. Isso adiciona: os 6 tiers (Bronze/Prata/Ouro/Platina/Diamante/
   Lendário), 30 bots (5 por tier), o sistema de Entradas, a função que
   calcula a "prancheta" de cada tier, e agenda a atualização automática
   de todo sábado 21h (Brasília).

**Se der erro tipo "permission denied to create extension" ou "extension
pg_cron is not available"** perto do fim: vá em **Database → Extensions**
no painel, procure **pg_cron**, clique em **Enable** por lá, volte no SQL
Editor e rode só este trecho de novo (o resto do arquivo já rodou):
```sql
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pvp-weekly-tier-reset') then
    perform cron.unschedule('pvp-weekly-tier-reset');
  end if;
end $$;

select cron.schedule(
  'pvp-weekly-tier-reset',
  '0 0 * * 0',
  $$select public.run_weekly_pvp_reset();$$
);
```

## 3. Habilitar login anônimo (já feito, se você seguiu o guia anterior)

**Authentication → Providers → "Allow anonymous sign-ins"**. Pule se já
fez.

## 4. Reenviar a Edge Function (o CONTEÚDO mudou — precisa atualizar)

O código de `supabase/functions/resolve-pvp-battle/index.ts` mudou bastante
(agora calcula pontos por posição no tier, entende bots, sistema de
entradas em vez de cooldown simples). O NOME da função continua o mesmo
(`resolve-pvp-battle`), então é só **substituir o conteúdo**:

1. **Edge Functions** → clique na função `resolve-pvp-battle` já existente.
2. Abra o editor dela (deve ter um botão tipo "Edit" ou o ícone de lápis).
3. **Apague tudo** e cole o conteúdo novo de
   `supabase/functions/resolve-pvp-battle/index.ts`.
4. **Deploy** de novo.

## Depois disso

Abra **Outros → 🏟️ Arena PvP**. Você deve ver seu Tier (começa no
**Bronze**, 1000 pontos), sua contagem de **Entradas** (começa 5/5, +1 a
cada hora), e uma lista única com todo mundo do seu tier — jogadores de
verdade e os bots que ainda estão "preenchendo vaga" (ver explicação
abaixo). Clique em **⚔️ Atacar** em qualquer linha (menos a sua).

## Como o sistema de Tiers funciona (resumo do que foi implementado)

- **6 tiers**: Bronze (1000 pts) → Prata (1200) → Ouro (1400) → Platina
  (1600) → Diamante (1800) → Lendário (2000, pontuação **oculta** — só
  mostra a posição, e depois de cada luta mostra "subiu/desceu N
  posições" em verde/vermelho).
- **Pontos por luta**: 3 a 10, calculado pela DISTÂNCIA DE POSIÇÃO entre
  os 2 lutadores dentro do tier (não pela diferença de pontos crua) —
  perto = ~5 pra ambos os lados; longe = quem tá na frente ganha pouco
  (3)/perde muito (10) e quem tá atrás ganha muito (10)/perde pouco (3).
- **Entradas**: até 5 guardadas, +1 por hora, cada ataque gasta 1 — o
  servidor (Edge Function) que controla isso, o cliente só mostra.
- **Bots**: 5 por tier, nomes fixos (Caçador Iniciante/Patrulheiro/
  Avançado/Elite/Chefe/Deus, do Bronze ao Lendário), somem conforme
  jogadores de verdade entram no tier (1 jogador → 5 bots, 2 → 4, 3 → 3...
  até sumir todo mundo). Não entram na contagem de promoção/rebaixamento
  nem mudam de força sozinhos — as stats deles são um primeiro chute
  (fácil de re-tunar com um `UPDATE public.pvp_bots ...` no SQL Editor).
- **Reset semanal** (sábado 21h Brasília, automático via `pg_cron`): tier
  com menos de 10 jogadores → os 3 melhores sobem 1 tier, ninguém desce;
  tier com 10+ → os 20% de cima sobem, os 20% de baixo descem. Todo mundo
  (subiu, ficou ou desceu) recomeça a semana com a pontuação BASE do tier
  em que ficou.

### Decisões que tomei sem você ter especificado (revise se quiser mudar)

- **Pontuação base do Lendário**: 2000 (seguindo a progressão de 200 em
  200 dos outros tiers — você não tinha dito esse número).
- **"10+ jogadores"**: tratei como "10 ou mais" indo pra regra dos 20%
  (você disse "menos de 10" pra regra dos 3 primeiros e "mais de 10" pra
  regra dos 20% — o caso exato de 10 jogadores eu decidi que cai na regra
  dos 20%, não na dos 3 primeiros).
- **Arredondamento dos 20%**: pra baixo (`floor`) — ex: 23 jogadores →
  4 sobem, 4 descem (20% de 23 = 4,6 → 4).
- **Segurança**: além do que já existia, tranquei o Supabase pra o
  cliente não conseguir editar `rating`/`tier`/`entradas` da própria
  linha diretamente (só nick/ícone/nível, que são cosméticos) — só a Edge
  Function (que roda com uma chave que o navegador nunca vê) pode mexer
  nesses campos agora. Isso não existia na v1 e era uma falha real.
- **Grupos por tier (Bronze–Diamante)**: cada tier é dividido em "salas"
  de até 100 jogadores de verdade (o jogador nunca vê esse número — é só
  particionamento interno, ver `migrations/0007_pvp_groups.sql`). Quando
  um grupo enche, o próximo jogador a entrar naquele tier abre um grupo
  novo, que começa com os mesmos 5 bots de sempre. O Lendário não tem
  grupo — todo mundo do tier compete no mesmo pool, sem limite de
  jogadores.
- **Lendário no reset semanal**: em vez da regra genérica de top/bottom
  20%, só os 200 primeiros (por posição) continuam no Lendário — todo o
  resto cai pro Diamante, seja qual for a porcentagem que isso representa.
  O Diamante continua promovendo pro Lendário pela regra genérica de
  sempre (top 3 ou top 20%), enchendo as vagas que sobraram.
- **Botão "Combate"**: em vez de atacar direto da lista do rank, o
  jogador clica em "⚔️ Combate" e recebe até 5 oponentes sorteados numa
  janela de ±15 posições ao redor da própria posição no grupo — pedido
  explícito do usuário. A prévia de pontos ganhos/perdidos é calculada no
  próprio navegador (mesma fórmula da Edge Function, ver
  `previewPvpAttackSwing` em `js/systems/pvp.js`) só pra não precisar de
  uma ida ao servidor pra mostrar; o valor real é sempre recalculado no
  servidor no momento do ataque.
- **Limitação que continua existindo**: o cliente ainda reporta as
  PRÓPRIAS stats de combate (DPS/HP/etc.) pro servidor por conta própria
  — um jogador tecnicamente ainda poderia mandar um valor mentiroso
  chamando a API diretamente (não pela tela do jogo). Resolver isso de
  verdade exigiria o servidor recalcular as stats a partir do
  inventário/skills reais do jogador, o que é um projeto bem maior (embutir
  toda a lógica de `systems/stats.js` no servidor). Pus um teto de sanidade
  na Edge Function (rejeita números absurdos) como um primeiro freio, mas
  não é uma prova completa contra isso.
- **Página "Ranks" (menu Outros)**: os 3 rankeamentos (Arena/Nível/
  Transcender) usam `pvp_profiles` como fonte — a ÚNICA fonte global de
  dados do jogo, já que o resto do save é só local no navegador. Um
  jogador que NUNCA abriu o jogo com internet (ou nunca sincronizou —
  a sincronização automática roda sozinha ao abrir o jogo, ver
  `PVP_AUTO_SYNC_INTERVAL_MS` em `js/main.js`) simplesmente não aparece em
  nenhum dos 3 ranks, mesmo tendo nível/transcendências altas — não tem
  como ranquear alguém que o servidor nunca viu.

## O que cada arquivo faz

| Arquivo | Papel |
|---|---|
| `migrations/0001_pvp_arena.sql` | Schema base + RLS |
| `migrations/0002_pvp_tiers.sql` | Tiers, bots, Entradas, reset semanal (pg_cron) |
| `migrations/0007_pvp_groups.sql` | Grupos de até 100 jogadores por tier + regra especial do Lendário no reset |
| `migrations/0008_pvp_ranks.sql` | Página "Ranks": rankeamentos globais de Arena/Nível/Transcender |
| `migrations/0010_pvp_mailbox.sql` | Correio: tabela + RLS |
| `migrations/0011_pvp_daily_weekly_rewards.sql` | Recompensa diária (por grupo) e semanal (por tier) da Arena, mandadas pro Correio |
| `functions/resolve-pvp-battle/index.ts` | Resolve 1 ataque (deploy como Edge Function) |
| `../js/systems/mailbox.js` | Cliente: buscar/resgatar/apagar mensagens do Correio |
| `../js/data/pvpConfig.js` | URL/chave do projeto + metadados dos tiers (nome/emoji/pontos-base) |
| `../js/systems/pvp.js` | Cliente: login anônimo, sincronizar stats, buscar o tier, atacar |
| `../js/ui/render.js` (`renderPvpTab`) | A tela da aba Arena PvP |
| `../js/main.js` (`refreshPvpTab`/`handlePvpAttack`) | Liga a UI ao `systems/pvp.js` |

## Como enviar uma mensagem pro Correio (manual, como Admin)

Sem tela de admin — você manda direto pelo SQL Editor, rodando como
`postgres` (ignora a RLS que bloqueia jogadores de inserir mensagem
sozinhos). Exemplos:

```sql
-- Aviso pra TODO MUNDO, sem item.
insert into public.pvp_mailbox (profile_id, title, body)
select id, '🔧 Correção de bug', 'Corrigimos um problema na Arena PvP. Bom jogo!'
from public.pvp_profiles;

-- Recompensa pra TODO MUNDO (ex: comemoração de marco do jogo).
insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, '🎉 Obrigado por jogar!', 'Uma lembrancinha por chegar até aqui.',
       'egg', 20
from public.pvp_profiles;

-- Recompensa só pra quem está no Lendário.
insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, '🏆 Prêmio especial', 'Você está entre os melhores do jogo!',
       'random_card', 1
from public.pvp_profiles where tier = 'lendario';
```

`reward_type`: `'none'` (padrão, sem item), `'card_fragment'`,
`'pet_fragment'`, `'egg'` ou `'random_card'` (nesse último `reward_amount`
é ignorado, sempre concede 1 carta aleatória). `reward2_type`/
`reward2_amount` (opcionais) dão uma 2ª recompensa na MESMA mensagem —
é assim que a recompensa diária da Arena manda fragmento de carta E de
mascote juntos.

## Próximos passos possíveis (ainda não implementados)

- Banner de "você foi promovido!"/"você caiu de tier!" depois do reset de
  sábado (hoje o jogador só percebe olhando o tier atual).
- Histórico de lutas (a tabela `pvp_matches` já guarda tudo, só falta uma
  tela pra mostrar).
- Recompensa/penalidade pro jogador que foi atacado (hoje só quem ataca
  ganha ouro).
- Itens/equipamentos/mascotes de verdade nos bots (hoje eles só têm
  números de DPS/HP/etc., sem inventário nenhum por trás — o jogo não
  usa isso pra nada além do cálculo de luta).
