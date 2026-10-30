-- Painel: seção "Apoio" (quem doou, quanto, totais, métricas e a lista de
-- doações para filtrar). Só responde para administradores (site_admins).
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0008). Só cria a função do painel; rodar de novo é seguro.

create or replace function public.site_admin_apoios(days int default 30)
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
    with a as (
      select a.*, coalesce(a.valor_pago, a.valor) as quanto,
             (a.criado at time zone tz)::date as dia
        from site_apoios a
    ),
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
                 per.status, per.origem, per.mp_payment_id
            from per left join site_profiles p on p.id = per.user_id
           order by per.criado desc
           limit 1000) l)
    )
  );
end;
$$;
revoke all on function public.site_admin_apoios(int) from public, anon;
grant execute on function public.site_admin_apoios(int) to authenticated;
