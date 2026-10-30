-- Passe de Batalha (primeira temporada: "Halloween 2026").
--   * 15 níveis; cada nível pede 100 abóboras (progresso acumulado) e tem UMA
--     recompensa, em uma de duas trilhas que se alternam: nível 1 premium, 2 grátis,
--     3 premium… até o 15, premium. Quem não tem o passe premium resgata só os
--     níveis da trilha grátis; quem tem, resgata todos.
--   * Abóboras: cada partida concluída (qualquer jogo, ranqueada ou não, ganhando
--     ou perdendo) dá 5 abóboras, até 150 por dia (zera à meia-noite de Brasília).
--     Vale para quem está conectado: é um gatilho em site_game_results, a mesma
--     tabela que a ranqueada já usa; visitantes não geram resultado no servidor.
--   * Recompensas (site_passe_niveis): 'moeda' (Rift Coins), 'efeito' e 'icone'.
--     Dá para trocar a recompensa de cada nível por SQL ou pelo painel.
--   * Enquanto o passe não é público (publico = false), só administradores
--     acumulam abóboras e resgatam (fase de teste, aba Teste do painel).
--   * Quem tem o passe premium: coluna `premium` (por enquanto o administrador
--     liga na ficha; a compra entra depois).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em
-- Run (depois da 0038). Rodar de novo é seguro (não apaga progresso nem
-- recompensas já configuradas).

create table if not exists public.site_passes (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  nome text not null,
  niveis int not null default 15 check (niveis between 1 and 100),
  abobora_por_nivel int not null default 100 check (abobora_por_nivel >= 1),
  abobora_por_partida int not null default 5 check (abobora_por_partida >= 1),
  limite_dia int not null default 150 check (limite_dia >= 1),
  publico boolean not null default false,
  inicio date,
  fim date,
  criado timestamptz not null default now()
);

create table if not exists public.site_passe_niveis (
  passe text not null references public.site_passes(id) on delete cascade,
  nivel int not null check (nivel >= 1),
  trilha text not null check (trilha in ('gratis', 'premium')),
  tipo text not null check (tipo in ('moeda', 'efeito', 'icone')),
  chave text not null check (chave ~ '^[a-z0-9-]{1,30}$'),
  primary key (passe, nivel)
);

create table if not exists public.site_passe_progresso (
  user_id uuid not null references auth.users(id) on delete cascade,
  passe text not null references public.site_passes(id) on delete cascade,
  abobora bigint not null default 0 check (abobora >= 0),
  premium boolean not null default false,
  premium_desde timestamptz,
  primary key (user_id, passe)
);

create table if not exists public.site_passe_dia (
  user_id uuid not null references auth.users(id) on delete cascade,
  passe text not null references public.site_passes(id) on delete cascade,
  dia date not null,
  abobora int not null default 0 check (abobora >= 0),
  primary key (user_id, passe, dia)
);

create table if not exists public.site_passe_resgates (
  user_id uuid not null references auth.users(id) on delete cascade,
  passe text not null references public.site_passes(id) on delete cascade,
  nivel int not null,
  resgatado timestamptz not null default now(),
  primary key (user_id, passe, nivel)
);

alter table public.site_passes enable row level security;
alter table public.site_passe_niveis enable row level security;
alter table public.site_passe_progresso enable row level security;
alter table public.site_passe_dia enable row level security;
alter table public.site_passe_resgates enable row level security;
revoke all on public.site_passes, public.site_passe_niveis, public.site_passe_progresso, public.site_passe_dia, public.site_passe_resgates from anon, authenticated;

-- ------------------------------------------------------- primeira temporada
insert into public.site_passes (id, nome) values ('halloween-2026', 'Halloween 2026') on conflict (id) do nothing;
-- Níveis ímpares: premium; pares: grátis. Por enquanto 500 RC em todos, menos o
-- último (efeito do Halloween). Só entram se o nível ainda não existir.
insert into public.site_passe_niveis (passe, nivel, trilha, tipo, chave)
select 'halloween-2026', n,
       case when n % 2 = 1 then 'premium' else 'gratis' end,
       case when n = 15 then 'efeito' else 'moeda' end,
       case when n = 15 then 'hw-neon' else '500' end
  from generate_series(1, 15) n
on conflict (passe, nivel) do nothing;

-- ------------------------------------------------------------------ interno
create or replace function public.site_passe_acessivel(p site_passes, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p.id is not null
     and (p.inicio is null or p.inicio <= site_hoje_br())
     and (p.fim is null or p.fim >= site_hoje_br())
     and (p.publico or exists (select 1 from site_admins a where a.user_id = uid));
$$;
revoke all on function public.site_passe_acessivel(site_passes, uuid) from public, anon, authenticated;

-- Soma abóboras respeitando o limite do dia. Devolve quantas entraram.
create or replace function public.site_passe_dar_aboboras(uid uuid, pid text, qtd int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_passes;
  hoje date := site_hoje_br();
  atual int;
  dar int;
begin
  select * into p from site_passes where id = pid;
  if p.id is null or qtd <= 0 then
    return 0;
  end if;
  perform pg_advisory_xact_lock(hashtext('passe:' || uid::text));
  insert into site_passe_dia (user_id, passe, dia, abobora) values (uid, pid, hoje, 0)
  on conflict (user_id, passe, dia) do nothing;
  select abobora into atual from site_passe_dia where user_id = uid and passe = pid and dia = hoje;
  dar := least(qtd, p.limite_dia - atual);
  if dar <= 0 then
    return 0;
  end if;
  update site_passe_dia set abobora = abobora + dar where user_id = uid and passe = pid and dia = hoje;
  insert into site_passe_progresso (user_id, passe, abobora) values (uid, pid, dar)
  on conflict (user_id, passe) do update set abobora = site_passe_progresso.abobora + dar;
  return dar;
end;
$$;
revoke all on function public.site_passe_dar_aboboras(uuid, text, int) from public, anon, authenticated;

-- Cada partida concluída (linha nova em site_game_results) dá abóboras.
create or replace function public.site_passe_ao_concluir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_passes;
begin
  for p in select * from site_passes loop
    if site_passe_acessivel(p, new.user_id) then
      perform site_passe_dar_aboboras(new.user_id, p.id, p.abobora_por_partida);
    end if;
  end loop;
  return new;
exception when others then
  -- Nunca atrapalha o registro da partida.
  return new;
end;
$$;
revoke all on function public.site_passe_ao_concluir() from public, anon, authenticated;
drop trigger if exists site_passe_on_result on public.site_game_results;
create trigger site_passe_on_result
  after insert on public.site_game_results
  for each row execute function public.site_passe_ao_concluir();

-- ------------------------------------------------------------------ jogador
-- Situação do passe para a conta conectada (visitante não tem).
create or replace function public.site_passe_estado(pid text default 'halloween-2026')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p site_passes;
  prog site_passe_progresso;
  hoje int;
  nivel int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into p from site_passes where id = pid;
  if p.id is null or not site_passe_acessivel(p, uid) then
    raise exception 'passe_indisponivel';
  end if;
  select * into prog from site_passe_progresso where user_id = uid and passe = pid;
  select coalesce(d.abobora, 0) into hoje from site_passe_dia d where d.user_id = uid and d.passe = pid and d.dia = site_hoje_br();
  nivel := least(p.niveis, floor(coalesce(prog.abobora, 0)::numeric / p.abobora_por_nivel)::int);
  return jsonb_build_object(
    'passe', jsonb_build_object('id', p.id, 'nome', p.nome, 'niveis', p.niveis, 'abobora_por_nivel', p.abobora_por_nivel,
                                'abobora_por_partida', p.abobora_por_partida, 'limite_dia', p.limite_dia, 'publico', p.publico),
    'abobora', coalesce(prog.abobora, 0),
    'nivel', nivel,
    'premium', coalesce(prog.premium, false),
    'hoje', coalesce(hoje, 0),
    'niveis', coalesce((select jsonb_agg(jsonb_build_object(
        'nivel', n.nivel, 'trilha', n.trilha, 'tipo', n.tipo, 'chave', n.chave,
        'exige', n.nivel * p.abobora_por_nivel,
        'resgatado', exists (select 1 from site_passe_resgates r where r.user_id = uid and r.passe = pid and r.nivel = n.nivel))
        order by n.nivel) from site_passe_niveis n where n.passe = pid and n.nivel <= p.niveis), '[]'::jsonb));
end;
$$;
revoke all on function public.site_passe_estado(text) from public, anon;
grant execute on function public.site_passe_estado(text) to authenticated;

-- Resgata a recompensa de um nível (precisa ter as abóboras; trilha premium
-- precisa do passe premium; cada nível uma vez só).
create or replace function public.site_passe_resgatar(pid text, nivel_ int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p site_passes;
  n site_passe_niveis;
  prog site_passe_progresso;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('passe-resgate:' || uid::text));
  select * into p from site_passes where id = pid;
  if p.id is null or not site_passe_acessivel(p, uid) then
    raise exception 'passe_indisponivel';
  end if;
  select * into n from site_passe_niveis x where x.passe = pid and x.nivel = nivel_ and x.nivel <= p.niveis;
  if n.passe is null then
    raise exception 'nivel_invalido';
  end if;
  select * into prog from site_passe_progresso where user_id = uid and passe = pid;
  if coalesce(prog.abobora, 0) < n.nivel * p.abobora_por_nivel then
    raise exception 'nivel_bloqueado';
  end if;
  if n.trilha = 'premium' and not coalesce(prog.premium, false) then
    raise exception 'precisa_premium';
  end if;
  begin
    insert into site_passe_resgates (user_id, passe, nivel) values (uid, pid, nivel_);
  exception when unique_violation then
    raise exception 'ja_resgatado';
  end;
  if n.tipo = 'moeda' then
    perform site_moedas_mexer(uid, n.chave::bigint, 'passe', pid || ':' || n.nivel);
  else
    insert into site_recompensas (user_id, tipo, chave, origem) values (uid, n.tipo, n.chave, 'passe')
    on conflict (user_id, tipo, chave) do nothing;
  end if;
  return jsonb_build_object('nivel', n.nivel, 'tipo', n.tipo, 'chave', n.chave);
end;
$$;
revoke all on function public.site_passe_resgatar(text, int) from public, anon;
grant execute on function public.site_passe_resgatar(text, int) to authenticated;

-- ------------------------------------------------------------ administrador
-- Mexe no progresso de um jogador (teste e suporte): abóboras (+/-), premium,
-- zerar tudo. Dar abóboras por aqui não conta no limite do dia.
create or replace function public.site_admin_passe(nome text, acao text, valor bigint default 0, pid text default 'halloween-2026')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  r site_passe_progresso;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if not exists (select 1 from site_passes where id = pid) then
    raise exception 'passe_indisponivel';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(trim(nome));
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  insert into site_passe_progresso (user_id, passe) values (alvo, pid) on conflict (user_id, passe) do nothing;
  if acao = 'aboboras' then
    update site_passe_progresso set abobora = greatest(0, abobora + valor) where user_id = alvo and passe = pid;
  elsif acao = 'premium' then
    update site_passe_progresso set premium = (valor <> 0), premium_desde = case when valor <> 0 then coalesce(premium_desde, now()) else null end where user_id = alvo and passe = pid;
  elsif acao = 'zerar' then
    update site_passe_progresso set abobora = 0 where user_id = alvo and passe = pid;
    delete from site_passe_dia where user_id = alvo and passe = pid;
    delete from site_passe_resgates where user_id = alvo and passe = pid;
  else
    raise exception 'acao_invalida';
  end if;
  select * into r from site_passe_progresso where user_id = alvo and passe = pid;
  return jsonb_build_object('abobora', r.abobora, 'premium', r.premium);
end;
$$;
revoke all on function public.site_admin_passe(text, text, bigint, text) from public, anon;
grant execute on function public.site_admin_passe(text, text, bigint, text) to authenticated;

-- Publica (ou volta para teste) o passe.
create or replace function public.site_admin_passe_publicar(pid text, publico_ boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  update site_passes set publico = publico_ where id = pid;
end;
$$;
revoke all on function public.site_admin_passe_publicar(text, boolean) from public, anon;
grant execute on function public.site_admin_passe_publicar(text, boolean) to authenticated;
