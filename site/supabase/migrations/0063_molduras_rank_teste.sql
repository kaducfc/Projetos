-- Molduras de Rank (em teste): "rank" é uma moldura única que mostra a arte do elo
-- atual do jogador (shared/assets/molduras/elo-<elo>.webp) e troca sozinha quando ele
-- muda de elo. Por enquanto só as contas de administrador recebem "rank" (equipar em
-- Meu perfil → Moldura). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'rank', 'admin' from public.site_admins a
on conflict do nothing;
