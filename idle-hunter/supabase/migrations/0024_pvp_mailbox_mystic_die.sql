-- Adiciona 'mystic_die' (Dado Místico) como um tipo de recompensa válido
-- pro Correio (ver pvp_mailbox em 0010_pvp_mailbox.sql +
-- 0013_pvp_mailbox_currency.sql + 0020_pvp_mailbox_awakening_shard.sql) —
-- mesmo mecanismo de sempre, só mais um valor aceito no check constraint.
-- O cliente já sabe aplicar (ver applyMailReward em js/systems/mailbox.js)
-- e mostrar (mailRewardLineHtml em js/ui/render.js) esse tipo — só
-- faltava o banco aceitar a linha.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward_type_check
  check (reward_type in ('none', 'card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda', 'awakening_shard', 'mystic_die'));

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward2_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward2_type_check
  check (reward2_type is null or reward2_type in ('card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda', 'awakening_shard', 'mystic_die'));

-- ---------------------------------------------------------------
-- Envia 200 Dados Místicos pros jogadores de nick "KaduCFC" e "PageRox"
-- (busca case-insensitive, mesmo padrão de 0020) — roda só uma vez, na
-- hora que você colar isso. Se algum desses nicks ainda não tiver perfil
-- (nunca abriu a Arena/conectou), essa linha simplesmente não insere nada
-- pra ele (0 linhas afetadas) — sincronize a Arena pelo menos uma vez no
-- jogo primeiro pra criar o perfil.
-- ---------------------------------------------------------------
insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, '🎲 Presente', 'Você recebeu 200 Dados Místicos!', 'mystic_die', 200
from public.pvp_profiles
where nick ilike 'KaduCFC' or nick ilike 'PageRox';
