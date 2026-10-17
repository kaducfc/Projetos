-- Códigos de recompensa: o jogador resgata um código no perfil e ganha ícones
-- exclusivos, efeitos no nome etc. Os códigos são criados pelo administrador
-- (painel → Ferramentas), podem ter número limitado de usos e validade, e cada
-- conta resgata o mesmo código uma vez só. Rodar depois da 0033. Rodar de novo
-- é seguro.
--
-- Recompensas (guardadas em site_recompensas):
--   tipo 'icone'  → chave 'exc-<nome>' (ícone exclusivo; a arte entra no site);
--   tipo 'efeito' → chave do efeito no nome (o desenho entra no site).
-- Só as funções abaixo mexem nessas tabelas (nada é lido nem escrito direto).

-- ------------------------------------------------------------------ tabelas
create table if not exists public.site_recompensas (
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('icone', 'efeito')),
  chave text not null check (chave ~ '^[a-z0-9-]{2,30}$'),
  origem text not null default 'codigo',
  criado timestamptz not null default now(),
  primary key (user_id, tipo, chave)
);

create table if not exists public.site_codigos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{4,32}$'),
  recompensas jsonb not null check (jsonb_typeof(recompensas) = 'array' and jsonb_array_length(recompensas) between 1 and 10),
  usos_max int check (usos_max is null or usos_max >= 1),
  usos int not null default 0,
  expira_em timestamptz,
  ativo boolean not null default true,
  nota text check (nota is null or char_length(nota) <= 200),
  criado timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

create table if not exists public.site_codigos_resgates (
  codigo_id uuid not null references public.site_codigos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resgatado timestamptz not null default now(),
  primary key (codigo_id, user_id)
);
create index if not exists site_codigos_resgates_user on public.site_codigos_resgates (user_id, resgatado desc);

-- Tentativas que não deram certo (contra quem fica chutando códigos).
create table if not exists public.site_codigos_tentativas (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quando timestamptz not null default now()
);
create index if not exists site_codigos_tentativas_user on public.site_codigos_tentativas (user_id, quando desc);

alter table public.site_recompensas enable row level security;
alter table public.site_codigos enable row level security;
alter table public.site_codigos_resgates enable row level security;
alter table public.site_codigos_tentativas enable row level security;
revoke all on public.site_recompensas, public.site_codigos, public.site_codigos_resgates, public.site_codigos_tentativas from anon, authenticated;
revoke all on sequence public.site_codigos_tentativas_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- utilidades
-- "abcd-ef12 3456" → "ABCDEF123456" (só letras e números, maiúsculas).
create or replace function public.site_codigo_normalizar(t text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Confere uma lista de recompensas [{tipo, chave}]; devolve a lista limpa.
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
    if tipo_ not in ('icone', 'efeito') or chave_ is null or chave_ !~ '^[a-z0-9-]{2,30}$' then
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

-- ------------------------------------------------------ jogador: resgatar
-- Devolve { ok: true, recompensas: [...], novas: [...] } ou { ok: false, erro }.
-- Erros de negócio voltam como resposta (e não como exceção) para a tentativa
-- errada ficar registrada.
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
    insert into site_recompensas (user_id, tipo, chave, origem)
    values (uid, r->>'tipo', r->>'chave', 'codigo')
    on conflict (user_id, tipo, chave) do nothing;
    get diagnostics inseriu = row_count;
    if inseriu > 0 then
      novas := novas || jsonb_build_array(r);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'recompensas', c.recompensas, 'novas', novas);
end;
$$;
revoke all on function public.site_resgatar_codigo(text) from public, anon;
grant execute on function public.site_resgatar_codigo(text) to authenticated;

-- O que a própria conta já ganhou.
create or replace function public.site_minhas_recompensas()
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
  return coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'chave', chave, 'origem', origem, 'criado', criado)
                                    order by criado) from site_recompensas where user_id = uid), '[]'::jsonb);
end;
$$;
revoke all on function public.site_minhas_recompensas() from public, anon;
grant execute on function public.site_minhas_recompensas() to authenticated;

-- ---------------------------------------------- ícones exclusivos (servidor)
-- Igual à 0014, mais: 'icone:exc-…' só vale para quem ganhou o ícone.
create or replace function public.site_set_avatar(icone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  selos jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if icone is not null and icone !~ '^(mascote|icone:[a-z0-9-]{2,30})$' then
    raise exception 'invalid_avatar';
  end if;
  if icone in ('icone:apoiador', 'icone:pioneiro') then
    selos := site_meus_selos();
    if not (selos->>(substr(icone, 7)))::boolean then
      raise exception 'icone_bloqueado';
    end if;
  end if;
  if icone like 'icone:exc-%' and not exists (
    select 1 from site_recompensas r where r.user_id = uid and r.tipo = 'icone' and r.chave = substr(icone, 7)
  ) then
    raise exception 'icone_bloqueado';
  end if;
  update site_profiles set avatar = icone where id = uid;
  return icone;
end;
$$;
revoke all on function public.site_set_avatar(text) from public, anon;
grant execute on function public.site_set_avatar(text) to authenticated;

-- ------------------------------------------------------ administrador: códigos
-- Cria um código. Sem `codigo`, gera um aleatório (16 letras/números, 64 bits).
create or replace function public.site_admin_codigo_criar(
  recompensas jsonb,
  codigo text default null,
  usos_max int default null,
  expira_em timestamptz default null,
  nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := site_codigo_normalizar(codigo);
  lista jsonb;
  novo site_codigos;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  lista := site_recompensas_validar(recompensas);
  if usos_max is not null and usos_max < 1 then
    raise exception 'usos_invalidos';
  end if;
  if norm = '' then
    -- Gerado: 16 caracteres hexadecimais de dois UUIDs aleatórios.
    loop
      norm := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
      exit when not exists (select 1 from site_codigos x where x.codigo = norm);
    end loop;
  elsif char_length(norm) < 4 or char_length(norm) > 32 then
    raise exception 'codigo_invalido';
  elsif exists (select 1 from site_codigos x where x.codigo = norm) then
    raise exception 'codigo_ja_existe';
  end if;
  insert into site_codigos (codigo, recompensas, usos_max, expira_em, nota, criado_por)
  values (norm, lista, usos_max, expira_em, nullif(trim(nota), ''), auth.uid())
  returning * into novo;
  return jsonb_build_object('id', novo.id, 'codigo', novo.codigo);
end;
$$;
revoke all on function public.site_admin_codigo_criar(jsonb, text, int, timestamptz, text) from public, anon;
grant execute on function public.site_admin_codigo_criar(jsonb, text, int, timestamptz, text) to authenticated;

create or replace function public.site_admin_codigos()
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
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'codigo', c.codigo, 'recompensas', c.recompensas, 'usos', c.usos, 'usos_max', c.usos_max,
      'expira_em', c.expira_em, 'ativo', c.ativo, 'nota', c.nota, 'criado', c.criado,
      'status', case when not c.ativo then 'desativado'
                     when c.expira_em is not null and c.expira_em <= now() then 'expirado'
                     when c.usos_max is not null and c.usos >= c.usos_max then 'esgotado'
                     else 'ativo' end) order by c.criado desc)
    from site_codigos c), '[]'::jsonb);
end;
$$;
revoke all on function public.site_admin_codigos() from public, anon;
grant execute on function public.site_admin_codigos() to authenticated;

create or replace function public.site_admin_codigo_ativar(id uuid, ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  update site_codigos c set ativo = site_admin_codigo_ativar.ativo where c.id = site_admin_codigo_ativar.id;
end;
$$;
revoke all on function public.site_admin_codigo_ativar(uuid, boolean) from public, anon;
grant execute on function public.site_admin_codigo_ativar(uuid, boolean) to authenticated;

-- Quem resgatou um código.
create or replace function public.site_admin_codigo_resgates(id uuid)
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
  return coalesce((select jsonb_agg(jsonb_build_object('username', p.username, 'resgatado', g.resgatado) order by g.resgatado desc)
                     from site_codigos_resgates g join site_profiles p on p.id = g.user_id
                    where g.codigo_id = site_admin_codigo_resgates.id), '[]'::jsonb);
end;
$$;
revoke all on function public.site_admin_codigo_resgates(uuid) from public, anon;
grant execute on function public.site_admin_codigo_resgates(uuid) to authenticated;

-- Recompensas e códigos de um jogador (ficha do painel).
create or replace function public.site_admin_recompensas_jogador(nome text)
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
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'chave', chave, 'origem', origem, 'criado', criado) order by criado)
                               from site_recompensas where user_id = alvo), '[]'::jsonb),
    'codigos', coalesce((select jsonb_agg(jsonb_build_object('codigo', c.codigo, 'resgatado', g.resgatado, 'nota', c.nota) order by g.resgatado desc)
                           from site_codigos_resgates g join site_codigos c on c.id = g.codigo_id where g.user_id = alvo), '[]'::jsonb));
end;
$$;
revoke all on function public.site_admin_recompensas_jogador(text) from public, anon;
grant execute on function public.site_admin_recompensas_jogador(text) to authenticated;

-- Dar ou tirar uma recompensa de um jogador na mão (sem código).
create or replace function public.site_admin_recompensa(nome text, tipo text, chave text, dar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  lista jsonb;
  chave_ text;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(trim(nome));
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  lista := site_recompensas_validar(jsonb_build_array(jsonb_build_object('tipo', tipo, 'chave', chave)));
  chave_ := lista->0->>'chave';
  if dar then
    insert into site_recompensas (user_id, tipo, chave, origem) values (alvo, tipo, chave_, 'admin')
    on conflict (user_id, tipo, chave) do nothing;
  else
    delete from site_recompensas r where r.user_id = alvo and r.tipo = site_admin_recompensa.tipo and r.chave = chave_;
    -- Se o ícone tirado estava em uso, volta para a inicial do nome.
    if tipo = 'icone' then
      update site_profiles set avatar = null where id = alvo and avatar = 'icone:' || chave_;
    end if;
  end if;
  return jsonb_build_object('username', (select username from site_profiles where id = alvo), 'tipo', tipo, 'chave', chave_, 'dar', dar);
end;
$$;
revoke all on function public.site_admin_recompensa(text, text, text, boolean) from public, anon;
grant execute on function public.site_admin_recompensa(text, text, text, boolean) to authenticated;
