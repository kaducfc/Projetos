-- Estornos: aviso no painel (aba Apoio e Visão geral) quando uma doação, o Passe Premium
-- ou uma compra de Rift Coins é estornada, para o administrador verificar a situação do
-- jogador (e decidir banir ou cobrar de volta).
-- * estorno_visto: marca o estorno como já verificado (some do aviso).
-- * site_admin_estornos(): lista os estornos ainda não verificados, com o que a pessoa
--   já aproveitou (moedas não recuperadas; recompensas premium já resgatadas).
-- * site_admin_estorno_visto(tipo, id): marca como verificado.
-- Rodar de novo é seguro.

alter table public.site_apoios add column if not exists estorno_visto timestamptz;
alter table public.site_passe_compras add column if not exists estorno_visto timestamptz;
alter table public.site_rc_compras add column if not exists estorno_visto timestamptz;

create or replace function public.site_admin_estornos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  return coalesce((
    select jsonb_agg(x order by x.quando desc) from (
      -- Doações estornadas
      select 'doacao'::text as tipo, a.id, p.username, coalesce(a.valor_pago, a.valor) as valor,
             a.atualizado as quando, a.origem as provedor, null::int as rc, null::bigint as saldo,
             null::bigint as rc_retiradas, null::int as resgates_premium, null::boolean as premium_ativo
        from site_apoios a left join site_profiles p on p.id = a.user_id
       where a.status = 'estornado' and a.estorno_visto is null
      union all
      -- Passe Premium estornado: quantas recompensas premium ele já tinha resgatado
      select 'passe', c.id, p.username, coalesce(c.valor_brl, c.valor), c.atualizado, c.provedor, null, null, null,
             (select count(*)::int from site_passe_resgates r join site_passe_niveis n on n.passe = r.passe and n.nivel = r.nivel
               where r.user_id = c.user_id and r.passe = c.passe and n.trilha = 'premium'),
             coalesce((select g.premium from site_passe_progresso g where g.user_id = c.user_id and g.passe = c.passe), false)
        from site_passe_compras c left join site_profiles p on p.id = c.user_id
       where c.status = 'estornado' and c.estorno_visto is null
      union all
      -- Compra de Rift Coins estornada: quanto foi recuperado do saldo e quanto já foi gasto
      select 'rc', r.id, p.username, coalesce(r.valor_brl, r.valor), r.atualizado, r.provedor, r.rc,
             coalesce((select cr.saldo from site_carteira cr where cr.user_id = r.user_id), 0),
             coalesce((select -sum(l.delta) from site_moedas_lanc l where l.user_id = r.user_id and l.motivo = 'estorno' and l.ref = 'rc:' || r.id::text), 0),
             null, null
        from site_rc_compras r left join site_profiles p on p.id = r.user_id
       where r.status = 'estornado' and r.estorno_visto is null
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.site_admin_estornos() from public, anon;
grant execute on function public.site_admin_estornos() to authenticated;

create or replace function public.site_admin_estorno_visto(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if p_tipo = 'doacao' then
    update site_apoios set estorno_visto = now() where id = p_id and status = 'estornado';
  elsif p_tipo = 'passe' then
    update site_passe_compras set estorno_visto = now() where id = p_id and status = 'estornado';
  elsif p_tipo = 'rc' then
    update site_rc_compras set estorno_visto = now() where id = p_id and status = 'estornado';
  else
    raise exception 'tipo_invalido';
  end if;
end;
$$;
revoke all on function public.site_admin_estorno_visto(text, uuid) from public, anon;
grant execute on function public.site_admin_estorno_visto(text, uuid) to authenticated;
