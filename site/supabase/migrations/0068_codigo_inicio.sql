-- Códigos de recompensa com hora de início (`inicia_em`). Rodar depois da 0067. Rodar de novo é seguro.
--
-- Código da Final do CBLOL 2026 (RIFTFINALCBLOL2026): vale a partir de 10/10/2026, 0h (Brasília),
-- só para os 1000 primeiros que resgatarem; depois disso responde "esgotado". Dá o ícone e o efeito
-- "Final CBLOL 2026" (os dois só aparecem no perfil de quem resgatou).

alter table public.site_codigos add column if not exists inicia_em timestamptz;

-- Igual à 0038, mais: antes de `inicia_em` o código responde 'codigo_nao_comecou'.
create or replace function public.site_resgatar_codigo(codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  norm text := site_codigo_normalizar(codigo);
  c site_codigos;
  falhas int;
  r jsonb;
  novas jsonb := '[]'::jsonb;
  inseriu int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('codigo:' || uid::text));
  delete from site_codigos_tentativas where quando < now() - interval '1 day';
  select count(*) into falhas from site_codigos_tentativas where user_id = uid and quando > now() - interval '10 minutes';
  if falhas >= 8 then
    return jsonb_build_object('ok', false, 'erro', 'muitas_tentativas');
  end if;
  if char_length(norm) < 4 or char_length(norm) > 32 then
    insert into site_codigos_tentativas (user_id) values (uid);
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  select * into c from site_codigos x where x.codigo = norm for update;
  if c.id is null then
    insert into site_codigos_tentativas (user_id) values (uid);
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  if exists (select 1 from site_codigos_resgates g where g.codigo_id = c.id and g.user_id = uid) then
    return jsonb_build_object('ok', false, 'erro', 'ja_resgatado');
  end if;
  if c.inicia_em is not null and c.inicia_em > now() then
    -- Ainda não começou: não conta como tentativa errada (todo mundo espera a hora).
    return jsonb_build_object('ok', false, 'erro', 'codigo_nao_comecou');
  end if;
  if not c.ativo or (c.expira_em is not null and c.expira_em <= now()) then
    insert into site_codigos_tentativas (user_id) values (uid);
    return jsonb_build_object('ok', false, 'erro', 'codigo_encerrado');
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    insert into site_codigos_tentativas (user_id) values (uid);
    return jsonb_build_object('ok', false, 'erro', 'codigo_esgotado');
  end if;
  insert into site_codigos_resgates (codigo_id, user_id) values (c.id, uid);
  update site_codigos set usos = usos + 1 where id = c.id;
  for r in select * from jsonb_array_elements(c.recompensas) loop
    if r->>'tipo' = 'moeda' then
      perform site_moedas_mexer(uid, (r->>'chave')::bigint, 'codigo', c.codigo);
      novas := novas || jsonb_build_array(r);
    else
      insert into site_recompensas (user_id, tipo, chave, origem)
      values (uid, r->>'tipo', r->>'chave', 'codigo')
      on conflict (user_id, tipo, chave) do nothing;
      get diagnostics inseriu = row_count;
      if inseriu > 0 then
        novas := novas || jsonb_build_array(r);
      end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'recompensas', c.recompensas, 'novas', novas);
end;
$$;
revoke all on function public.site_resgatar_codigo(text) from public, anon;
grant execute on function public.site_resgatar_codigo(text) to authenticated;

insert into public.site_codigos (codigo, recompensas, usos_max, inicia_em, nota)
values ('RIFTFINALCBLOL2026',
        '[{"tipo":"icone","chave":"exc-los-furia"},{"tipo":"efeito","chave":"lj-negativo"}]'::jsonb,
        1000, timestamptz '2026-10-10 00:00:00-03', 'Final do CBLOL 2026: 1000 primeiros')
on conflict (codigo) do update
  set recompensas = excluded.recompensas, usos_max = excluded.usos_max, inicia_em = excluded.inicia_em, ativo = true,
      nota = excluded.nota;
