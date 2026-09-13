-- Adiciona 'awakening_shard' (Fragmento do Despertar) como um tipo de
-- recompensa válido pro Correio (ver pvp_mailbox em 0010_pvp_mailbox.sql +
-- 0013_pvp_mailbox_currency.sql) — mesmo mecanismo de sempre (gold/
-- esmeralda/card_fragment/etc), só mais um valor aceito no check
-- constraint. O cliente já sabe aplicar (ver applyMailReward em
-- js/systems/mailbox.js) e mostrar (mailRewardLineHtml em
-- js/ui/render.js) esse tipo — só faltava o banco aceitar a linha.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward_type_check
  check (reward_type in ('none', 'card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda', 'awakening_shard'));

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward2_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward2_type_check
  check (reward2_type is null or reward2_type in ('card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda', 'awakening_shard'));

-- ---------------------------------------------------------------
-- Envia 1 Fragmento do Despertar pro jogador de nick "KaduCFC" (busca
-- case-insensitive, ver isNickAvailable em js/systems/pvp.js pro mesmo
-- padrão) — roda só uma vez, na hora que você colar isso. Se não existir
-- nenhum perfil com esse nick ainda (ele nunca abriu a Arena/conectou),
-- essa parte simplesmente não insere nada (0 linhas afetadas) — sincronize
-- a Arena pelo menos uma vez no jogo primeiro pra criar o perfil.
-- ---------------------------------------------------------------
insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, '🌌 Presente', 'Você recebeu 1 Fragmento do Despertar!', 'awakening_shard', 1
from public.pvp_profiles
where nick ilike 'KaduCFC';
