-- Correio (menu Outros) — mensagens do "Admin" (você, via SQL Editor) pro
-- jogador: aviso de atualização/bug, ou recompensa (fragmento de carta,
-- fragmento de mascote, ovo, ou 1 carta aleatória). Também é onde as
-- recompensas AUTOMÁTICAS da Arena (diária/semanal, ver
-- 0011_pvp_daily_weekly_rewards.sql) chegam pro jogador.
--
-- Cada mensagem pode ter até 2 recompensas (ex: a diária da Arena dá
-- fragmento de carta E fragmento de mascote na MESMA mensagem — reward2_*
-- é a 2ª, fica null/0 se a mensagem só tem 1 recompensa ou nenhuma).
-- reward_type/reward2_type = 'none' (mensagem sem item, um aviso comum),
-- 'card_fragment', 'pet_fragment', 'egg' ou 'random_card' (amount
-- ignorado nesse último, sempre concede 1 carta aleatória — a escolha de
-- QUAL carta e a aplicação de fato no save local é feita pelo cliente, ver
-- js/systems/mailbox.js claimMailReward; o Supabase só guarda "o que"
-- prometeu, não aplica nada sozinho, já que inventário/materiais vivem
-- 100% no save local, não no servidor).
--
-- IMPORTANTE sobre confiança: assim como hunter_level/transcend_count (ver
-- 0002/0008), resgatar aqui é um update direto que o PRÓPRIO cliente faz
-- (marca claimed=true) — não passa por Edge Function. Um jogador
-- tecnicamente poderia chamar a API direto e tentar marcar como resgatada
-- uma mensagem que não é dele, mas a RLS abaixo (profile_id = auth.uid())
-- impede isso; ele não pode inserir mensagem nova pra si mesmo (sem
-- policy de insert pra "authenticated" — só você, via SQL Editor/postgres,
-- ou os crons, que rodam com privilégio de superusuário e ignoram RLS).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

create table if not exists public.pvp_mailbox (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.pvp_profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  reward_type text not null default 'none'
    check (reward_type in ('none', 'card_fragment', 'pet_fragment', 'egg', 'random_card')),
  reward_amount integer not null default 0,
  reward2_type text
    check (reward2_type is null or reward2_type in ('card_fragment', 'pet_fragment', 'egg', 'random_card')),
  reward2_amount integer not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pvp_mailbox_profile_idx on public.pvp_mailbox (profile_id, created_at desc);

alter table public.pvp_mailbox enable row level security;

drop policy if exists "users read their own mail" on public.pvp_mailbox;
create policy "users read their own mail" on public.pvp_mailbox
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "users claim their own mail" on public.pvp_mailbox;
create policy "users claim their own mail" on public.pvp_mailbox
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Pedido explícito do usuário: não pode deletar mensagem com item ainda
-- não resgatado. Mensagem sem recompensa (reward_type/reward2_type =
-- 'none'/null) pode ser apagada a qualquer momento.
drop policy if exists "users delete claimed or rewardless mail" on public.pvp_mailbox;
create policy "users delete claimed or rewardless mail" on public.pvp_mailbox
  for delete to authenticated using (
    profile_id = auth.uid()
    and (claimed = true or (reward_type = 'none' and reward2_type is null))
  );

-- O GRANT padrão do Supabase pra tabela nova dá INSERT/UPDATE completo pra
-- "authenticated" — sem revogar isso, um jogador poderia se auto-enviar
-- "correio" com recompensa (INSERT) ou reescrever o título/corpo/valor da
-- recompensa da própria mensagem (UPDATE completo). Só a coluna "claimed"
-- fica liberada pro update — é a única coisa que resgatar de fato precisa
-- mudar.
revoke insert on public.pvp_mailbox from authenticated;
revoke update on public.pvp_mailbox from authenticated;
grant update (claimed) on public.pvp_mailbox to authenticated;
