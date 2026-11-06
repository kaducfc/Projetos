-- Arena PvP — dano de mascote no snapshot, pra alimentar as estatísticas
-- pós-combate (ver resolve-pvp-battle e js/ui/render.js pvpResultContentHtml).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo ("if not exists").

alter table public.pvp_snapshots
  add column if not exists pet_dps numeric not null default 0;
