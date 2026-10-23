-- Premiação em RC dos rankings semanal e mensal.
-- A semana vai de segunda a domingo e o mês do dia 1 ao último dia (calendário de Brasília). Quando o período fecha
-- (o ranking "zera"), os 5 primeiros recebem RC. A entrega é preguiçosa: acontece na primeira chamada de
-- site_rk_processar (rankings, ranqueada) depois da virada, e roda uma única vez por período.

create table if not exists public.site_rk_premios_cfg (
  periodo text primary key check (periodo in ('semanal', 'mensal')),
  premios jsonb not null
);
insert into public.site_rk_premios_cfg (periodo, premios) values
  ('semanal', '{"1":1000,"2":700,"3":500,"4":500,"5":500}'),
  ('mensal',  '{"1":3000,"2":2000,"3":1000,"4":1000,"5":1000}')
on conflict (periodo) do nothing;

create table if not exists public.site_rk_premios (
  periodo text not null,
  inicio date not null,
  pos int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rc int not null,
  pdr int not null,
  criado timestamptz not null default now(),
  primary key (periodo, inicio, pos)
);
create index if not exists site_rk_premios_user on public.site_rk_premios (user_id, criado desc);

-- Primeiro período ainda não premiado. Começa no período atual: o que já passou não é pago retroativamente.
create table if not exists public.site_rk_premios_proc (
  periodo text primary key,
  proximo date not null
);
insert into public.site_rk_premios_proc (periodo, proximo) values
  ('semanal', date_trunc('week', site_hoje_br()::timestamp)::date),
  ('mensal', date_trunc('month', site_hoje_br()::timestamp)::date)
on conflict (periodo) do nothing;

alter table public.site_rk_premios_cfg enable row level security;
alter table public.site_rk_premios enable row level security;
alter table public.site_rk_premios_proc enable row level security;

create or replace function public.site_rk_premiar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  per text;
  cfg jsonb;
  atual date;
  prox date;
  ini date;
  fim date;
  r record;
  pago int := 0;
  voltas int;
begin
  if not pg_try_advisory_xact_lock(hashtext('rk:premiar')) then
    return 0;
  end if;
  foreach per in array array['semanal', 'mensal'] loop
    select premios into cfg from site_rk_premios_cfg where periodo = per;
    select proximo into prox from site_rk_premios_proc where periodo = per;
    if cfg is null or prox is null then
      continue;
    end if;
    atual := case per when 'semanal' then date_trunc('week', hoje::timestamp)::date
                      else date_trunc('month', hoje::timestamp)::date end;
    voltas := 0;
    while prox < atual and voltas < 60 loop
      ini := prox;
      prox := case per when 'semanal' then ini + 7 else (ini + interval '1 month')::date end;
      fim := prox - 1;
      voltas := voltas + 1;
      for r in
        select t.user_id, t.pdr, t.pos
          from (select l.user_id, sum(l.delta)::int as pdr,
                       row_number() over (order by sum(l.delta) desc, max(l.criado), l.user_id)::int as pos
                  from site_rk_lanc l
                 where l.dia between ini and fim and l.motivo <> 'admin'
                   and not exists (select 1 from site_ranked_banidos b where b.user_id = l.user_id)
                 group by l.user_id
                having sum(l.delta) > 0) t
         where t.pos <= 5
      loop
        if coalesce((cfg ->> r.pos::text)::int, 0) > 0 then
          insert into site_rk_premios (periodo, inicio, pos, user_id, rc, pdr)
          values (per, ini, r.pos, r.user_id, (cfg ->> r.pos::text)::int, r.pdr)
          on conflict do nothing;
          if found then
            perform site_moedas_mexer(r.user_id, (cfg ->> r.pos::text)::bigint, 'rank_' || per, ini::text);
            pago := pago + 1;
          end if;
        end if;
      end loop;
      update site_rk_premios_proc set proximo = prox where periodo = per;
    end loop;
  end loop;
  return pago;
end;
$$;
revoke all on function public.site_rk_premiar() from public, anon, authenticated;

-- Encaixa a premiação no processamento diário (idempotente: só renomeia a original uma vez).
do $$
begin
  if to_regprocedure('public.site_rk_processar_base()') is null then
    alter function public.site_rk_processar() rename to site_rk_processar_base;
    revoke all on function public.site_rk_processar_base() from public, anon, authenticated;
  end if;
end;
$$;

create or replace function public.site_rk_processar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  n := site_rk_processar_base();
  begin
    perform site_rk_premiar();
  exception when others then
    null; -- a premiação nunca pode derrubar o ranking; tenta de novo na próxima chamada
  end;
  return n;
end;
$$;
revoke all on function public.site_rk_processar() from public, anon;
grant execute on function public.site_rk_processar() to authenticated;

-- Tabela de prêmios para a tela do ranking, mais o último prêmio recebido por quem está logado.
create or replace function public.site_rk_premios_info()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  uid uuid := auth.uid();
begin
  return jsonb_build_object(
    'semanal', (select jsonb_build_object('premios', premios, 'fim', (date_trunc('week', hoje::timestamp)::date + 6))
                  from site_rk_premios_cfg where periodo = 'semanal'),
    'mensal', (select jsonb_build_object('premios', premios, 'fim', ((date_trunc('month', hoje::timestamp) + interval '1 month')::date - 1))
                 from site_rk_premios_cfg where periodo = 'mensal'),
    'ultimos', case when uid is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('periodo', x.periodo, 'inicio', x.inicio, 'pos', x.pos, 'rc', x.rc) order by x.criado desc)
        from (select * from site_rk_premios where user_id = uid order by criado desc limit 5) x), '[]'::jsonb) end);
end;
$$;
revoke all on function public.site_rk_premios_info() from public;
grant execute on function public.site_rk_premios_info() to anon, authenticated;
