-- Correio — prazo de validade padrão de 30 dias pra qualquer mensagem
-- (avisos do Admin e recompensas automáticas da Arena, ver
-- 0010_pvp_mailbox.sql/0011_pvp_daily_weekly_rewards.sql). Passado o
-- prazo, a mensagem é apagada sozinha — MESMO que tenha item ainda não
-- resgatado (diferente da regra de exclusão manual do jogador, que
-- bloqueia apagar com item pendente; a expiração automática ignora isso
-- de propósito, é o comportamento pedido).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

alter table public.pvp_mailbox
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

create index if not exists pvp_mailbox_expires_idx on public.pvp_mailbox (expires_at);

create or replace function public.run_mailbox_cleanup()
returns void
language sql
as $$
  delete from public.pvp_mailbox where expires_at < now();
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pvp-mailbox-cleanup') then
    perform cron.unschedule('pvp-mailbox-cleanup');
  end if;
end $$;

-- Roda 1x por dia (00:30 UTC, meia hora depois da recompensa diária —
-- não precisa ser exato, só não competir com o insert em massa dela).
select cron.schedule(
  'pvp-mailbox-cleanup',
  '30 0 * * *',
  $$select public.run_mailbox_cleanup();$$
);
