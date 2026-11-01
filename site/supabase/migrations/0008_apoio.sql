-- Apoio ao site (doação pelo Mercado Pago): só cosmético. Quem apoia com
-- qualquer valor ganha automaticamente o efeito "Reflexo" no nick.
--   * site_apoios: cada doação (pendente → aprovado/recusado/estornado). Quem
--     escreve aqui são as Edge Functions apoio-criar e apoio-webhook (com a
--     chave de serviço); cada conta só lê as próprias.
--   * site_profiles.apoio_total: soma das doações aprovadas (recalculada
--     sozinha, inclusive se um pagamento for estornado).
--   * site_admin_registrar_apoio: o administrador registra um apoio feito por
--     fora (ex.: Pix direto).
--   * O ranking passa a dizer quem é apoiador (efeito no nick).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em Run (depois do 0007). Rodar de novo é seguro.

create table if not exists public.site_apoios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  valor numeric(10, 2) not null check (valor >= 1 and valor <= 5000),
  valor_pago numeric(10, 2),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  origem text not null default 'mercadopago' check (origem in ('mercadopago', 'manual')),
  mp_preference_id text,
  mp_payment_id text unique,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create index if not exists site_apoios_user on public.site_apoios (user_id, criado desc);

alter table public.site_apoios enable row level security;
grant select on public.site_apoios to authenticated;
-- As Edge Functions (chave de serviço) gravam e atualizam as doações. Precisa
-- ser explícito: o projeto não libera tabelas novas automaticamente.
grant select, insert, update on public.site_apoios to service_role;
drop policy if exists "site_apoios dono le" on public.site_apoios;
create policy "site_apoios dono le" on public.site_apoios for select using (auth.uid() = user_id);

alter table public.site_profiles add column if not exists apoio_total numeric(10, 2) not null default 0;
alter table public.site_profiles add column if not exists apoiador_desde timestamptz;

-- Recalcula o total apoiado da conta sempre que uma doação muda.
create or replace function public.site_apoio_recalcular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  if uid is null then
    return new;
  end if;
  update site_profiles p set
    apoio_total = coalesce((select sum(coalesce(a.valor_pago, a.valor)) from site_apoios a
                             where a.user_id = uid and a.status = 'aprovado'), 0),
    apoiador_desde = coalesce(p.apoiador_desde,
                              (select min(a.atualizado) from site_apoios a where a.user_id = uid and a.status = 'aprovado'))
  where p.id = uid;
  return new;
end;
$$;
drop trigger if exists site_apoios_total on public.site_apoios;
create trigger site_apoios_total
  after insert or update or delete on public.site_apoios
  for each row execute function public.site_apoio_recalcular();

-- Administrador registra um apoio feito por fora do site (ex.: Pix direto).
create or replace function public.site_admin_registrar_apoio(nome text, quanto numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  total numeric;
begin
  if not site_is_admin() then
    raise exception 'not_admin';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(nome);
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  insert into site_apoios (user_id, valor, valor_pago, status, origem)
  values (alvo, quanto, quanto, 'aprovado', 'manual');
  select apoio_total into total from site_profiles where id = alvo;
  return jsonb_build_object('username', nome, 'total', total);
end;
$$;
revoke all on function public.site_admin_registrar_apoio(text, numeric) from public, anon;
grant execute on function public.site_admin_registrar_apoio(text, numeric) to authenticated;

-- Ranking dizendo quem é apoiador (efeito no nick).
create or replace function public.site_ranking(periodo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  ini date;
  uid uuid := auth.uid();
  lista jsonb;
  eu jsonb;
begin
  perform site_ranked_processar();
  ini := case periodo
    when 'diario' then hoje
    when 'semanal' then date_trunc('week', hoje)::date
    when 'mensal' then date_trunc('month', hoje)::date
    else null end;
  if ini is null then
    raise exception 'periodo_invalido';
  end if;

  create temp table if not exists _rank (user_id uuid, pontos int, dias int, pos int) on commit drop;
  truncate _rank;
  insert into _rank
  select user_id, sum(melhor)::int, count(*)::int,
         rank() over (order by sum(melhor) desc)::int
    from (
      select user_id, dia, max(score) as melhor
        from site_ranked_partidas
       where dia between ini and hoje
       group by user_id, dia
    ) d
   group by user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'pos', k.pos, 'username', p.username, 'avatar', p.avatar,
           'apoiador', p.apoio_total > 0,
           'elo', coalesce(r.elo, 'bronze'), 'pontos', k.pontos, 'dias', k.dias,
           'eu', k.user_id = uid) order by k.pos, p.username), '[]'::jsonb)
    into lista
    from (select * from _rank order by pos, user_id limit 100) k
    join site_profiles p on p.id = k.user_id
    left join site_ranked r on r.user_id = k.user_id;

  select jsonb_build_object('pos', k.pos, 'pontos', k.pontos, 'dias', k.dias)
    into eu from _rank k where k.user_id = uid;

  return jsonb_build_object('periodo', periodo, 'inicio', ini, 'fim', hoje,
                            'jogadores', (select count(*) from _rank),
                            'lista', lista, 'eu', eu);
end;
$$;
revoke all on function public.site_ranking(text) from public;
grant execute on function public.site_ranking(text) to anon, authenticated;
