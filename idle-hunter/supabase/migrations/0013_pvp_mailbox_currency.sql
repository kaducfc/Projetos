-- Correio — permite mandar Ouro e Esmeralda como recompensa também (além
-- de fragmento de carta/mascote, ovo e carta aleatória), pra você poder
-- mandar moeda pros jogadores manualmente pelo SQL Editor.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward_type_check
  check (reward_type in ('none', 'card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda'));

alter table public.pvp_mailbox drop constraint if exists pvp_mailbox_reward2_type_check;
alter table public.pvp_mailbox add constraint pvp_mailbox_reward2_type_check
  check (reward2_type is null or reward2_type in ('card_fragment', 'pet_fragment', 'egg', 'random_card', 'gold', 'esmeralda'));
