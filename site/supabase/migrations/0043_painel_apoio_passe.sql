-- Painel, aba Apoio: as compras do Passe Premium entram junto com as doações (mesmos
-- totais, gráficos, "quem mais apoiou" e lista), com um filtro para ver só doações ou só o
-- Passe. Cada compra do passe conta pelo valor em reais (`valor_brl`: R$ 15 no Mercado Pago;
-- no Stripe, US$ 10 na cotação do momento da compra, a mesma usada nas doações em dólar).
-- Quem compra o passe NÃO vira apoiador (não ganha o efeito dourado nem entra nos 100
-- primeiros): o passe só soma nos números do painel.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em Run
-- (depois da 0042). Rodar de novo é seguro.

alter table public.site_passe_compras add column if not exists valor_brl numeric(10, 2);
update public.site_passe_compras set valor_brl = valor where valor_brl is null and moeda = 'BRL';

-- Troca a versão antiga (só com `days`) pela nova (com o filtro de tipo).
drop function if exists public.site_admin_apoios(int);

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
            'passe', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'passe'), 0), 'n', count(*) filter (where tipo = 'passe'))),
          'periodo', jsonb_build_object(
            'doacao', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'doacao' and criado >= since), 0), 'n', count(*) filter (where tipo = 'doacao' and criado >= since)),
            'passe', jsonb_build_object('arrecadado', coalesce(sum(quanto) filter (where tipo = 'passe' and criado >= since), 0), 'n', count(*) filter (where tipo = 'passe' and criado >= since))))
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
