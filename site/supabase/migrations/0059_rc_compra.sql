-- Venda de Rift Coins por dinheiro: pacotes de 1.000, 3.000, 5.000 e 10.000 RC.
--   Brasil (pt-BR): Mercado Pago em reais (R$ 10 / 25 / 40 / 70).
--   Outros idiomas: Stripe em dólar (US$ 7 / 17 / 27 / 47) ou euro (dólar convertido).
-- * site_rc_compras: cada pedido de compra (só o servidor mexe).
-- * site_rc_confirmar_compra: chamada pelos webhooks (chave de serviço). Aprovado credita
--   as moedas UMA vez; estorno tira de volta o que ainda houver no saldo.
-- * O painel (aba Apoio) passa a incluir as compras de RC (tipo "Rift Coins") nos totais,
--   com o filtro por tipo, e o botão Excluir também vale para elas (se não concluídas).
-- Rodar de novo é seguro.

create table if not exists public.site_rc_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rc int not null check (rc > 0),
  provedor text not null check (provedor in ('mercadopago', 'stripe')),
  moeda text not null check (moeda in ('BRL', 'USD', 'EUR')),
  valor numeric(10, 2) not null check (valor > 0),
  valor_brl numeric(10, 2),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  ext_id text,
  pagamento_id text unique,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create index if not exists site_rc_compras_user on public.site_rc_compras (user_id, criado desc);
alter table public.site_rc_compras enable row level security;
revoke all on public.site_rc_compras from anon, authenticated;
grant select, insert, update on public.site_rc_compras to service_role;

create or replace function public.site_rc_confirmar_compra(cid uuid default null, novo_status text default null, pag text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c site_rc_compras;
  saldo_atual bigint;
begin
  if novo_status not in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado') then
    raise exception 'status_invalido';
  end if;
  if cid is not null then
    select * into c from site_rc_compras where id = cid for update;
  elsif pag is not null then
    select * into c from site_rc_compras where pagamento_id = pag for update;
  end if;
  if c.id is null then
    return 'nao_encontrada';
  end if;
  if novo_status = 'aprovado' then
    if c.status = 'aprovado' then
      return 'ok'; -- aviso repetido: não credita de novo
    end if;
    if c.status = 'estornado' then
      return 'ignorado';
    end if;
    update site_rc_compras set status = 'aprovado', pagamento_id = coalesce(pag, pagamento_id), atualizado = now() where id = c.id;
    perform site_moedas_mexer(c.user_id, c.rc, 'compra', 'rc:' || c.id::text);
  elsif novo_status = 'estornado' then
    if c.status <> 'aprovado' then
      return 'ignorado';
    end if;
    update site_rc_compras set status = 'estornado', atualizado = now() where id = c.id;
    select saldo into saldo_atual from site_carteira where user_id = c.user_id;
    if coalesce(saldo_atual, 0) > 0 then
      perform site_moedas_mexer(c.user_id, -least(saldo_atual, c.rc), 'estorno', 'rc:' || c.id::text);
    end if;
  else
    if c.status in ('aprovado', 'estornado') then
      return 'ignorado';
    end if;
    update site_rc_compras set status = novo_status, atualizado = now() where id = c.id;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.site_rc_confirmar_compra(uuid, text, text) from public, anon, authenticated;
grant execute on function public.site_rc_confirmar_compra(uuid, text, text) to service_role;

-- Excluir pagamento não concluído (agora também compras de RC).
create or replace function public.site_admin_apoio_excluir(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if p_tipo = 'passe' then
    delete from site_passe_compras where id = p_id and status in ('pendente', 'recusado', 'cancelado');
  elsif p_tipo = 'rc' then
    delete from site_rc_compras where id = p_id and status in ('pendente', 'recusado', 'cancelado');
  elsif p_tipo = 'doacao' then
    delete from site_apoios where id = p_id and status in ('pendente', 'recusado', 'cancelado');
  else
    raise exception 'tipo_invalido';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'nao_excluivel';
  end if;
end;
$$;
revoke all on function public.site_admin_apoio_excluir(text, uuid) from public, anon;
grant execute on function public.site_admin_apoio_excluir(text, uuid) to authenticated;

-- Painel: totais incluem doações, Passe Premium e compras de Rift Coins.
create or replace function public.site_admin_apoios(days int default 30, so_tipo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  today date := (now() at time zone tz)::date;
  since timestamptz;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  days := least(greatest(coalesce(days, 30), 1), 365);
  since := ((today - (days - 1))::timestamp) at time zone tz;

  return (
    with todas as (
      select a.id, a.user_id, a.valor, a.valor_pago, a.status, a.origem, a.mp_payment_id, a.criado, a.atualizado,
             'doacao'::text as tipo, coalesce(a.valor_pago, a.valor) as quanto, (a.criado at time zone tz)::date as dia
        from site_apoios a
      union all
      select c.id, c.user_id, coalesce(c.valor_brl, c.valor), case when c.status = 'aprovado' then coalesce(c.valor_brl, c.valor) end,
             c.status, c.provedor, c.pagamento_id, c.criado, c.atualizado,
             'passe'::text, coalesce(c.valor_brl, c.valor), (c.criado at time zone tz)::date
        from site_passe_compras c
      union all
      select r.id, r.user_id, coalesce(r.valor_brl, r.valor), case when r.status = 'aprovado' then coalesce(r.valor_brl, r.valor) end,
             r.status, r.provedor, r.pagamento_id, r.criado, r.atualizado,
             'rc'::text, coalesce(r.valor_brl, r.valor), (r.criado at time zone tz)::date
        from site_rc_compras r
    ),
    a as (select * from todas where so_tipo is null or tipo = so_tipo),
    ok as (select * from a where status = 'aprovado'),
    per as (select * from a where criado >= since),
    okp as (select * from ok where criado >= since),
    -- Primeira doação aprovada de cada conta (para contar apoiadores novos).
    primeira as (select user_id, min(criado) as quando from ok where user_id is not null group by user_id),
    serie as (
      select d::date as dia from generate_series(today - (days - 1), today, interval '1 day') d
    )
    select jsonb_build_object(
      'dias', days,
      'tipo', so_tipo,
      -- Quanto veio de cada coisa (sempre sem o filtro), para a linha de resumo do painel.
      'por_tipo', (select jsonb_build_object(
          'total', jsonb_build_object(
            'doacao', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'doacao'), 0), 'n', count(*) filter (where tipo = 'doacao')),
            'passe', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'passe'), 0), 'n', count(*) filter (where tipo = 'passe')),
            'rc', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'rc'), 0), 'n', count(*) filter (where tipo = 'rc'))),
          'periodo', jsonb_build_object(
            'doacao', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'doacao' and criado >= since), 0), 'n', count(*) filter (where tipo = 'doacao' and criado >= since)),
            'passe', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'passe' and criado >= since), 0), 'n', count(*) filter (where tipo = 'passe' and criado >= since)),
            'rc', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'rc' and criado >= since), 0), 'n', count(*) filter (where tipo = 'rc' and criado >= since))))
          from todas where status = 'aprovado'),
      'total', jsonb_build_object(
        'arrecadado', (select coalesce(sum(quanto), 0) from ok),
        'doacoes', (select count(*) from ok),
        'apoiadores', (select count(distinct user_id) from ok),
        'ticket_medio', (select round(avg(quanto), 2) from ok),
        'maior', (select max(quanto) from ok),
        'estornado', (select coalesce(sum(quanto), 0) from a where status = 'estornado')
      ),
      'hoje', jsonb_build_object(
        'arrecadado', (select coalesce(sum(quanto), 0) from ok where dia = today),
        'doacoes', (select count(*) from ok where dia = today)
      ),
      'periodo', jsonb_build_object(
        'arrecadado', (select coalesce(sum(quanto), 0) from okp),
        'doacoes', (select count(*) from okp),
        'apoiadores', (select count(distinct user_id) from okp),
        'novos', (select count(*) from primeira where quando >= since),
        'ticket_medio', (select round(avg(quanto), 2) from okp),
        'maior', (select max(quanto) from okp),
        'tentativas', (select count(*) from per),
        'conversao_pct', (select round(100.0 * count(*) filter (where status in ('aprovado', 'estornado'))
                                  / nullif(count(*) filter (where origem = 'mercadopago'), 0), 1)
                            from per where origem = 'mercadopago'),
        'status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                     from (select status, count(*) as n from per group by status) s),
        'origem', (select coalesce(jsonb_object_agg(origem, v), '{}'::jsonb)
                     from (select origem, sum(quanto) as v from okp group by origem) s),
        'faixas', (select coalesce(jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n) order by ordem), '[]'::jsonb) from (
            select case when quanto < 10 then 1 when quanto < 25 then 2 when quanto < 50 then 3
                        when quanto < 100 then 4 else 5 end as ordem,
                   case when quanto < 10 then 'Até R$ 9' when quanto < 25 then 'R$ 10 a 24'
                        when quanto < 50 then 'R$ 25 a 49' when quanto < 100 then 'R$ 50 a 99'
                        else 'R$ 100 ou mais' end as faixa,
                   count(*) as n
              from okp group by 1, 2) f)
      ),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object(
          'dia', s.dia,
          'valor', (select coalesce(sum(quanto), 0) from ok where ok.dia = s.dia),
          'doacoes', (select count(*) from ok where ok.dia = s.dia)) order by s.dia), '[]'::jsonb)
        from serie s),
      -- Quem mais apoiou (desde sempre).
      'top', (select coalesce(jsonb_agg(t order by t.total desc, t.desde), '[]'::jsonb) from (
          select p.username, p.avatar, sum(ok.quanto) as total, count(*) as doacoes,
                 min(ok.criado) as desde, max(ok.criado) as ultima
            from ok join site_profiles p on p.id = ok.user_id
           group by p.id, p.username, p.avatar
           order by total desc, desde
           limit 20) t),
      -- Doações do período (todas as situações), da mais nova para a mais velha.
      'lista', (select coalesce(jsonb_agg(l order by l.criado desc), '[]'::jsonb) from (
          select per.id, per.criado, per.atualizado, p.username, per.valor, per.valor_pago,
                 per.status, per.origem, per.mp_payment_id, per.tipo
            from per left join site_profiles p on p.id = per.user_id
           order by per.criado desc
           limit 1000) l)
    )
  );
end;
$$;
revoke all on function public.site_admin_apoios(int, text) from public, anon;
grant execute on function public.site_admin_apoios(int, text) to authenticated;
