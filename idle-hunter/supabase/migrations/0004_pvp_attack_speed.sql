-- Arena PvP — velocidade de ataque no snapshot, necessária pra estimar
-- QUANTOS golpes aconteceram na luta (e daí quantos críticos/esquivas de
-- verdade, não só a % de chance — ver resolve-pvp-battle).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo ("if not exists").

alter table public.pvp_snapshots
  add column if not exists attack_speed_per_sec numeric not null default 1;
