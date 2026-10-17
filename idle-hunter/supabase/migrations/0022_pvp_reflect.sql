-- Reflexo de Dano (ver reflectChance em js/systems/stats.js, concedido por
-- carta — ex: Caeloryx, Tier God) agora também funciona na Arena PvP contra
-- outros jogadores. Regra pedida pelo usuário: diferente do PvE (que
-- reflete o ATAQUE TOTAL do monstro, sem descontar armadura/resistência —
-- ver main.js tick()), na Arena o reflexo é baseado no dano que o
-- ADVERSÁRIO causou DEPOIS de todos os cálculos (crítico/esquiva/armadura
-- já aplicados) — ver resolve-pvp-battle abaixo.
--
-- Como aplicar:
-- 1) Cole este arquivo inteiro no SQL Editor do painel Supabase
--    (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
--    rodar de novo.
-- 2) Depois, abra Edge Functions > resolve-pvp-battle no painel Supabase,
--    substitua o conteúdo INTEIRO pelo novo
--    supabase/functions/resolve-pvp-battle/index.ts e clique em Deploy —
--    sem isso, o passo 1 sozinho não muda nada (a função antiga ainda não
--    sabe ler essa coluna nova).

alter table public.pvp_snapshots
  add column if not exists reflect_percent numeric not null default 0;

alter table public.pvp_bots
  add column if not exists reflect_percent numeric not null default 0;
