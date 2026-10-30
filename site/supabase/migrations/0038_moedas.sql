-- Rift Coins: a moeda do site (RC). Cada conta tem uma carteira; tudo que entra
-- ou sai fica registrado em um extrato. Por enquanto as moedas vêm de códigos de
-- recompensa e de ajustes do administrador; depois entram o passe de batalha e a
-- loja de efeitos/ícones.
--   * site_carteira: o saldo de cada conta (separado do perfil, que é público:
--     só a própria conta enxerga o seu saldo).
--   * site_moedas_lanc: extrato (quanto entrou/saiu, saldo depois, motivo).
--   * Ninguém escreve direto nas tabelas: só as funções abaixo.
--   * Códigos de recompensa passam a aceitar { "tipo": "moeda", "chave": "250" }
--     (= 250 Rift Coins, uma vez por conta).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em
-- Run (depois da 0037). Rodar de novo é seguro.

create table if not exists public.site_carteira (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saldo bigint not null default 0 check (saldo >= 0),
  atualizado timestamptz not null default now()
);

create table if not exists public.site_moedas_lanc (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null check (delta <> 0),
  saldo bigint not null check (saldo >= 0),
  motivo text not null check (char_length(motivo) between 1 and 40),
  ref text check (ref is null or char_length(ref) <= 200),
  criado timestamptz not null default now()
);
create index if not exists site_moedas_lanc_user on public.site_moedas_lanc (user_id, id desc);

alter table public.site_carteira enable row level security;
alter table public.site_moedas_lanc enable row level security;
revoke all on public.site_carteira, public.site_moedas_lanc from anon, authenticated;
revoke all on sequence public.site_moedas_lanc_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- interno
-- Soma (ou tira) moedas e registra no extrato. Só outras funções chamam.
create or replace function public.site_moedas_mexer(uid uuid, delta bigint, motivo text, ref text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  novo bigint;
begin
  if delta = 0 then
    raise exception 'quantidade_invalida';
  end if;
  insert into site_carteira (user_id, saldo) values (uid, 0) on conflict (user_id) do nothing;
  begin
    update site_carteira set saldo = saldo + delta, atualizado = now() where user_id = uid returning saldo into novo;
  exception when check_violation then
    raise exception 'saldo_insuficiente';
  end;
  insert into site_moedas_lanc (user_id, delta, saldo, motivo, ref) values (uid, delta, novo, motivo, ref);
  return novo;
end;
$$;
revoke all on function public.site_moedas_mexer(uuid, bigint, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- jogador
create or replace function public.site_minha_carteira()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return jsonb_build_object('saldo', coalesce((select c.saldo from site_carteira c where c.user_id = uid), 0));
end;
$$;
revoke all on function public.site_minha_carteira() from public, anon;
grant execute on function public.site_minha_carteira() to authenticated;

create or replace function public.site_moedas_extrato(limite int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('delta', x.delta, 'saldo', x.saldo, 'motivo', x.motivo, 'ref', x.ref, 'criado', x.criado) order by x.id desc)
                     from (select * from site_moedas_lanc l where l.user_id = uid order by l.id desc limit greatest(1, least(coalesce(limite, 20), 100))) x), '[]'::jsonb);
end;
$$;
revoke all on function public.site_moedas_extrato(int) from public, anon;
grant execute on function public.site_moedas_extrato(int) to authenticated;

-- ---------------------------------------------------- códigos de recompensa
-- Aceita também { tipo: 'moeda', chave: '<quantidade>' } (1 a 1.000.000).
create or replace function public.site_recompensas_validar(lista jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  r jsonb;
  out jsonb := '[]'::jsonb;
  tipo_ text;
  chave_ text;
begin
  if lista is null or jsonb_typeof(lista) <> 'array' or jsonb_array_length(lista) not between 1 and 10 then
    raise exception 'recompensas_invalidas';
  end if;
  for r in select * from jsonb_array_elements(lista) loop
    tipo_ := r->>'tipo';
    chave_ := lower(trim(r->>'chave'));
    if tipo_ = 'moeda' then
      if chave_ is null or chave_ !~ '^[0-9]{1,7}$' or chave_::bigint not between 1 and 1000000 then
        raise exception 'moedas_invalidas';
      end if;
      chave_ := chave_::bigint::text;
    elsif tipo_ not in ('icone', 'efeito') or chave_ is null or chave_ !~ '^[a-z0-9-]{2,30}$' then
      raise exception 'recompensas_invalidas';
    end if;
    -- Ícone de código precisa ser dos exclusivos (os outros todo mundo já tem).
    if tipo_ = 'icone' and chave_ !~ '^exc-' then
      raise exception 'icone_precisa_comecar_com_exc';
    end if;
    out := out || jsonb_build_array(jsonb_build_object('tipo', tipo_, 'chave', chave_));
  end loop;
  return out;
end;
$$;

-- Igual à 0034, mais: recompensa 'moeda' soma na carteira (e vai para o extrato).
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

-- ------------------------------------------------------------ administrador
-- Dá (quantidade positiva) ou tira (negativa) moedas de uma conta. Fica no extrato.
create or replace function public.site_admin_moedas(nome text, qtd bigint, nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  novo bigint;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if qtd is null or qtd = 0 or abs(qtd) > 1000000000 then
    raise exception 'quantidade_invalida';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(trim(nome));
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  novo := site_moedas_mexer(alvo, qtd, 'admin', nullif(left(trim(coalesce(nota, '')), 200), ''));
  return jsonb_build_object('username', trim(nome), 'saldo', novo);
end;
$$;
revoke all on function public.site_admin_moedas(text, bigint, text) from public, anon;
grant execute on function public.site_admin_moedas(text, bigint, text) to authenticated;

-- Saldo e extrato de um jogador (ficha do painel).
create or replace function public.site_admin_moedas_jogador(nome text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(trim(nome));
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  return jsonb_build_object(
    'saldo', coalesce((select c.saldo from site_carteira c where c.user_id = alvo), 0),
    'extrato', coalesce((select jsonb_agg(jsonb_build_object('delta', x.delta, 'saldo', x.saldo, 'motivo', x.motivo, 'ref', x.ref, 'criado', x.criado) order by x.id desc)
                           from (select * from site_moedas_lanc l where l.user_id = alvo order by l.id desc limit 20) x), '[]'::jsonb));
end;
$$;
revoke all on function public.site_admin_moedas_jogador(text) from public, anon;
grant execute on function public.site_admin_moedas_jogador(text) to authenticated;
