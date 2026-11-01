-- Simulador de Técnico: Treinamento, Amistoso e Recrutar (gacha de jogadores Estrela).
-- Rode depois do 0097. Idempotente.
--
--  1. Estrelas saem do mercado oficial (só voltam se tc_config.estrelas_mercado = true).
--  2. Treinamento: cada atributo sobe aos poucos (sessões que levam horas e custam créditos). O Poder do jogador
--     nunca passa de (Poder inicial + 10) para jogadores comuns, (Poder inicial + 15) para Estrelas, nem de 100.
--  3. Amistoso: partida de treino contra outro time. Não vale campeonato. Até 5 amistosos por dia dão EXP aos
--     titulares; os demais não contam para nada. A experiência encurta as sessões de treino.
--  4. Recrutar: baús com RC que sorteiam Estrelas (comum, raro, épico, lendário e mítico). Baú básico e baú premium;
--     comprar 5 tem desconto. O sorteio e o pagamento são feitos aqui no servidor.

-- ---------------------------------------------------------------- configuração
insert into public.tc_config (chave, valor) values
  ('estrelas_mercado', 'false'::jsonb),
  ('treino', '{"horas": 6, "pontos": 3, "custo_base": 6000, "custo_por_ponto": 200, "simultaneos": 3,
               "bonus_comum": 10, "bonus_estrela": 15, "reducao_exp_max": 0.3, "exp_para_max": 200}'::jsonb),
  ('amistoso', '{"exp_por_dia": 5, "exp_ganho": 2, "max_dia": 50, "formato": 3}'::jsonb),
  ('gacha', '{"desconto_5": 0.15, "pity_a_cada": 10, "contrato_semanas": 12,
              "baus": {
                "basico":  {"nome": "Baú Básico",  "rc": 300,  "odds": {"comum": 55, "raro": 30, "epico": 12, "lendario": 2.7, "mitico": 0.3}},
                "premium": {"nome": "Baú Premium", "rc": 900,  "odds": {"comum": 20, "raro": 38, "epico": 28, "lendario": 11, "mitico": 3}}
              }}'::jsonb)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------- colunas
alter table public.tc_jogadores add column if not exists raridade text check (raridade in ('comum', 'raro', 'epico', 'lendario', 'mitico'));
alter table public.tc_jogadores add column if not exists poder_inicial int check (poder_inicial between 1 and 100);

-- Raridade das Estrelas atuais (só preenche quem ainda não tem)
update public.tc_jogadores j set raridade = r.r
  from (values ('Faker', 'mitico'),
               ('Chovy', 'lendario'), ('Keria', 'lendario'), ('Canyon', 'lendario'), ('Ruler', 'lendario'), ('Zeus', 'lendario'),
               ('Oner', 'epico'), ('Peyz', 'epico'), ('Gumayusi', 'epico'), ('Zeka', 'epico'), ('Kiin', 'epico'),
               ('Kanavi', 'raro'), ('Doran', 'raro'), ('Delight', 'raro'),
               ('Duro', 'comum')) as r(nome, r)
 where j.nome = r.nome and not j.ficticio and j.raridade is null;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.tc_treinos (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  jogador_id bigint not null references public.tc_jogadores(id) on delete cascade,
  atributo text not null check (atributo in ('mec', 'rotas', 'macro', 'tf', 'mental')),
  pontos int not null check (pontos > 0),
  custo bigint not null check (custo >= 0),
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  status text not null default 'andamento' check (status in ('andamento', 'concluido')),
  aplicados int,
  chave text,
  user_id uuid
);
create unique index if not exists tc_treinos_um_andamento on public.tc_treinos (jogador_id) where status = 'andamento';
create unique index if not exists tc_treinos_chave on public.tc_treinos (user_id, chave) where chave is not null;
create index if not exists tc_treinos_org on public.tc_treinos (org_id, status, fim);
alter table public.tc_treinos enable row level security;
revoke all on public.tc_treinos from anon, authenticated;
revoke all on sequence public.tc_treinos_id_seq from anon, authenticated;

create table if not exists public.tc_amistosos (
  id bigserial primary key,
  org_a bigint not null references public.tc_orgs(id) on delete cascade,
  org_b bigint not null references public.tc_orgs(id) on delete cascade,
  dia date not null,
  resultado jsonb not null,
  deu_exp boolean not null default false,
  chave text,
  user_id uuid,
  criado timestamptz not null default now()
);
create index if not exists tc_amistosos_org_dia on public.tc_amistosos (org_a, dia, id);
create unique index if not exists tc_amistosos_chave on public.tc_amistosos (user_id, chave) where chave is not null;
alter table public.tc_amistosos enable row level security;
revoke all on public.tc_amistosos from anon, authenticated;
revoke all on sequence public.tc_amistosos_id_seq from anon, authenticated;

create table if not exists public.tc_gacha (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  user_id uuid not null,
  bau text not null,
  qtd int not null check (qtd in (1, 5)),
  custo_rc bigint not null check (custo_rc > 0),
  resultado jsonb not null,
  chave text not null,
  criado timestamptz not null default now()
);
create unique index if not exists tc_gacha_chave on public.tc_gacha (user_id, chave);
alter table public.tc_gacha enable row level security;
revoke all on public.tc_gacha from anon, authenticated;
revoke all on sequence public.tc_gacha_id_seq from anon, authenticated;

-- Contador de "garantia": aberturas seguidas sem épico ou melhor, por técnico e baú.
create table if not exists public.tc_gacha_pity (
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  bau text not null,
  sem_epico int not null default 0,
  primary key (org_id, bau)
);
alter table public.tc_gacha_pity enable row level security;
revoke all on public.tc_gacha_pity from anon, authenticated;

-- ---------------------------------------------------------------- 1. Estrelas fora do mercado oficial
create or replace function public.tc_mercado_oficial(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim int := 24;
  off int := greatest(0, coalesce((f->>'pagina')::int, 0)) * 24;
  r jsonb;
  estrelas boolean := coalesce(((tc_cfg('estrelas_mercado'))::text)::boolean, false);
begin
  perform tc_exigir(uid);
  perform tc_reabastecer();
  select coalesce(jsonb_agg(x.j order by x.ord1 desc, x.id), '[]'::jsonb) into r
  from (
    select tc_jogador_json(j) as j, j.id,
           case coalesce(f->>'ordem', 'poder')
             when 'poder' then tc_poder(j) when 'potencial' then j.potencial::double precision
             when 'fama' then j.fama::double precision when 'preco' then -tc_preco(tc_poder(j), j.potencial, j.fama, j.idade)::double precision
             when 'idade' then -j.idade::double precision else tc_poder(j) end as ord1
      from tc_jogadores j
     where j.org_id is null
       and (estrelas or j.ficticio)
       and (f->>'pos' is null or f->>'pos' = '' or j.pos = f->>'pos' or f->>'pos' = any (j.pos2))
       and (f->>'poder_min' is null or tc_poder(j) >= (f->>'poder_min')::double precision)
       and (f->>'poder_max' is null or tc_poder(j) <= (f->>'poder_max')::double precision)
       and (f->>'pot_min' is null or j.potencial >= (f->>'pot_min')::int)
       and (f->>'idade_max' is null or j.idade <= (f->>'idade_max')::int)
       and (f->>'fama_min' is null or j.fama >= (f->>'fama_min')::int)
       and (f->>'preco_max' is null or tc_preco(tc_poder(j), j.potencial, j.fama, j.idade) <= (f->>'preco_max')::bigint)
       and (f->>'busca' is null or f->>'busca' = '' or j.nome ilike '%' || replace(replace(f->>'busca', '%', ''), '_', '') || '%')
       and (f->>'mec_min' is null or j.mec >= (f->>'mec_min')::int)
       and (f->>'rotas_min' is null or j.rotas >= (f->>'rotas_min')::int)
       and (f->>'macro_min' is null or j.macro >= (f->>'macro_min')::int)
       and (f->>'tf_min' is null or j.tf >= (f->>'tf_min')::int)
       and (f->>'mental_min' is null or j.mental >= (f->>'mental_min')::int)
     order by 3 desc, j.id
     limit lim offset off) x;
  return r;
end;
$$;
revoke all on function public.tc_mercado_oficial(jsonb) from public, anon;
grant execute on function public.tc_mercado_oficial(jsonb) to authenticated;

-- A compra direta de Estrela por RC fica fechada enquanto elas estiverem só no baú.
create or replace function public.tc_contratar_estrela(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  cfg jsonb := tc_cfg('estrelas');
  preco bigint;
  sal int;
  ant jsonb;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select jsonb_build_object('ja_feito', true, 'jogador', jogador_id) into ant from tc_transf where user_id = uid and chave = chave_;
  if ant is not null then return ant; end if;
  if not coalesce(((tc_cfg('estrelas_mercado'))::text)::boolean, false)
     or not coalesce((cfg->>'venda_rc')::boolean, false) then raise exception 'estrela_venda_fechada'; end if;
  if semanas is null or semanas < (el->>'contrato_min')::int or semanas > (el->>'contrato_max')::int then
    raise exception 'contrato_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.ficticio then raise exception 'nao_e_estrela'; end if;
  if j.org_id is not null then raise exception 'jogador_indisponivel'; end if;
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then raise exception 'elenco_cheio'; end if;
  preco := tc_estrela_preco_rc(j);
  if preco is null or preco <= 0 then raise exception 'estrela_venda_fechada'; end if;
  perform site_moedas_mexer(uid, -preco, 'tecnico_estrela', left('estrela:' || j.id::text, 200));
  sal := tc_salario(tc_preco_jogador(j));
  perform set_config('tc.estrela_liberada', j.id::text, true);
  update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = tc_semana_global() + semanas where id = j.id;
  perform set_config('tc.estrela_liberada', '', true);
  insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, 'contratacao', preco, 'rc', sal, tc_semana_global() + semanas, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco_rc', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar_estrela(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar_estrela(bigint, int, text) to authenticated;

-- ---------------------------------------------------------------- 2. Treinamento
create or replace function public.tc_treino_limite(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select least(100, coalesce(j.poder_inicial, round(tc_poder(j))::int)
                    + case when j.ficticio then ((tc_cfg('treino'))->>'bonus_comum')::int else ((tc_cfg('treino'))->>'bonus_estrela')::int end);
$$;
revoke all on function public.tc_treino_limite(tc_jogadores) from public, anon, authenticated;

-- Aplica os treinos que terminaram. Sobe os pontos do atributo, sem deixar o Poder passar do limite do jogador.
create or replace function public.tc_treino_processar(oid bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  t tc_treinos;
  j tc_jogadores;
  j2 tc_jogadores;
  lim int;
  pts int;
  atual int;
  feitos int := 0;
begin
  for t in select * from tc_treinos where org_id = oid and status = 'andamento' and fim <= now() order by id for update loop
    select * into j from tc_jogadores where id = t.jogador_id for update;
    pts := 0;
    if j.id is not null and j.org_id = oid then
      lim := tc_treino_limite(j);
      atual := case t.atributo when 'mec' then j.mec when 'rotas' then j.rotas when 'macro' then j.macro when 'tf' then j.tf else j.mental end;
      pts := least(t.pontos, 100 - atual);
      while pts > 0 loop
        j2 := j;
        if t.atributo = 'mec' then j2.mec := j.mec + pts;
        elsif t.atributo = 'rotas' then j2.rotas := j.rotas + pts;
        elsif t.atributo = 'macro' then j2.macro := j.macro + pts;
        elsif t.atributo = 'tf' then j2.tf := j.tf + pts;
        else j2.mental := j.mental + pts; end if;
        exit when round(tc_poder(j2)) <= lim;
        pts := pts - 1;
      end loop;
      if pts > 0 then
        update tc_jogadores set
          mec = case when t.atributo = 'mec' then mec + pts else mec end,
          rotas = case when t.atributo = 'rotas' then rotas + pts else rotas end,
          macro = case when t.atributo = 'macro' then macro + pts else macro end,
          tf = case when t.atributo = 'tf' then tf + pts else tf end,
          mental = case when t.atributo = 'mental' then mental + pts else mental end
         where id = j.id;
      end if;
    end if;
    update tc_treinos set status = 'concluido', aplicados = pts where id = t.id;
    if j.id is not null then
      perform tc_avisar(oid, 'Treino concluído: ' || j.nome || case when pts > 0 then ' ganhou +' || pts::text || ' de ' else ' não evoluiu em ' end
                             || case t.atributo when 'mec' then 'Mecânica' when 'rotas' then 'Fase de rotas' when 'macro' then 'Macro' when 'tf' then 'Teamfight' else 'Mental' end || '.');
    end if;
    feitos := feitos + 1;
  end loop;
  return feitos;
end;
$$;
revoke all on function public.tc_treino_processar(bigint) from public, anon, authenticated;

-- Custo de uma sessão: sobe com o valor atual do atributo.
create or replace function public.tc_treino_custo(valor int)
returns bigint language sql stable security definer set search_path = public as $$
  select (((tc_cfg('treino'))->>'custo_base')::bigint + ((tc_cfg('treino'))->>'custo_por_ponto')::bigint * valor);
$$;
revoke all on function public.tc_treino_custo(int) from public, anon, authenticated;

-- Duração em horas: a experiência do jogador encurta as sessões (até `reducao_exp_max`).
create or replace function public.tc_treino_horas(j tc_jogadores)
returns double precision language sql stable security definer set search_path = public as $$
  select ((tc_cfg('treino'))->>'horas')::double precision
         * (1 - least(((tc_cfg('treino'))->>'reducao_exp_max')::double precision,
                      ((tc_cfg('treino'))->>'reducao_exp_max')::double precision * j.exp / ((tc_cfg('treino'))->>'exp_para_max')::double precision));
$$;
revoke all on function public.tc_treino_horas(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_treino_estado()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('treino');
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  perform tc_treino_processar(o.id);
  return jsonb_build_object(
    'config', cfg,
    'creditos', (select creditos from tc_orgs where id = o.id),
    'agora', now(),
    'jogadores', coalesce((select jsonb_agg(
        tc_jogador_json(j) || jsonb_build_object(
          'limite', tc_treino_limite(j),
          'poder_inicial', coalesce(j.poder_inicial, round(tc_poder(j))::int),
          'horas', round(tc_treino_horas(j)::numeric, 1),
          'custos', jsonb_build_object('mec', tc_treino_custo(j.mec), 'rotas', tc_treino_custo(j.rotas), 'macro', tc_treino_custo(j.macro), 'tf', tc_treino_custo(j.tf), 'mental', tc_treino_custo(j.mental)),
          'treino', (select jsonb_build_object('id', t.id, 'atributo', t.atributo, 'pontos', t.pontos, 'fim', t.fim) from tc_treinos t where t.jogador_id = j.id and t.status = 'andamento'))
        order by (j.slot is null), j.pos, j.id)
      from tc_jogadores j where j.org_id = o.id), '[]'::jsonb),
    'em_andamento', (select count(*) from tc_treinos where org_id = o.id and status = 'andamento'));
end;
$$;
revoke all on function public.tc_treino_estado() from public, anon;
grant execute on function public.tc_treino_estado() to authenticated;

create or replace function public.tc_treinar(jogador bigint, atributo_ text, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('treino');
  atual int;
  custo bigint;
  t tc_treinos;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  if atributo_ is null or atributo_ not in ('mec', 'rotas', 'macro', 'tf', 'mental') then raise exception 'atributo_invalido'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into t from tc_treinos where user_id = uid and chave = chave_;
  if t.id is not null then return jsonb_build_object('ja_feito', true, 'fim', t.fim); end if;
  perform tc_treino_processar(o.id);
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  if (select count(*) from tc_treinos where org_id = o.id and status = 'andamento') >= (cfg->>'simultaneos')::int then raise exception 'treinos_demais'; end if;
  atual := case atributo_ when 'mec' then j.mec when 'rotas' then j.rotas when 'macro' then j.macro when 'tf' then j.tf else j.mental end;
  if atual >= 100 then raise exception 'atributo_no_maximo'; end if;
  if j.poder_inicial is null then
    update tc_jogadores set poder_inicial = round(tc_poder(j))::int where id = j.id;
    select * into j from tc_jogadores where id = j.id;
  end if;
  if round(tc_poder(j)) >= tc_treino_limite(j) then raise exception 'treino_limite_atingido'; end if;
  custo := tc_treino_custo(atual);
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(o.id, -custo, 'treino', j.id::text);
  insert into tc_treinos (org_id, jogador_id, atributo, pontos, custo, fim, chave, user_id)
  values (o.id, j.id, atributo_, (cfg->>'pontos')::int, custo, now() + make_interval(secs => round(tc_treino_horas(j) * 3600)::int), chave_, uid)
  returning * into t;
  return jsonb_build_object('ok', true, 'fim', t.fim, 'custo', custo, 'pontos', t.pontos);
end;
$$;
revoke all on function public.tc_treinar(bigint, text, text) from public, anon;
grant execute on function public.tc_treinar(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------- 3. Amistoso
create or replace function public.tc_amistoso_oponentes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  meu double precision;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  meu := tc_poder_org(o.id);
  return coalesce((select jsonb_agg(x.j order by x.dif, x.id) from (
      select jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla, 'escudo', g.escudo, 'cor1', g.cor1, 'cor2', g.cor2,
                                'divisao', g.divisao, 'tecnico', g.user_id is not null, 'poder', round(tc_poder_org(g.id)::numeric, 1)) as j,
             abs(tc_poder_org(g.id) - meu) as dif, g.id
        from tc_orgs g where g.id <> o.id and tc_elenco_completo(g.id) order by 2, 3 limit 40) x), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_amistoso_oponentes() from public, anon;
grant execute on function public.tc_amistoso_oponentes() to authenticated;

create or replace function public.tc_amistoso(oponente bigint, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  g tc_orgs;
  cfg jsonb := tc_cfg('amistoso');
  hoje date := site_hoje_br();
  feitos int;
  a tc_amistosos;
  r jsonb;
  exp_ok boolean;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into a from tc_amistosos where user_id = uid and chave = chave_;
  if a.id is not null then return jsonb_build_object('ja_feito', true, 'id', a.id, 'resultado', a.resultado, 'exp', a.deu_exp); end if;
  select * into g from tc_orgs where id = oponente;
  if g.id is null or g.id = o.id then raise exception 'oponente_invalido'; end if;
  if not tc_elenco_completo(o.id) then raise exception 'elenco_incompleto'; end if;
  if not tc_elenco_completo(g.id) then raise exception 'oponente_sem_elenco'; end if;
  select count(*) into feitos from tc_amistosos where org_a = o.id and dia = hoje;
  if feitos >= (cfg->>'max_dia')::int then raise exception 'amistoso_limite_dia'; end if;
  exp_ok := feitos < (cfg->>'exp_por_dia')::int;
  insert into tc_amistosos (org_a, org_b, dia, resultado, deu_exp, chave, user_id) values (o.id, g.id, hoje, '{}'::jsonb, exp_ok, chave_, uid) returning * into a;
  r := tc_simular(o.id, g.id, (cfg->>'formato')::int, 'amistoso:' || a.id::text);
  r := r || jsonb_build_object('poder_a', round(tc_poder_org(o.id)::numeric, 1), 'poder_b', round(tc_poder_org(g.id)::numeric, 1));
  update tc_amistosos set resultado = r where id = a.id;
  if exp_ok then
    update tc_jogadores set exp = exp + (cfg->>'exp_ganho')::int where org_id = o.id and slot is not null;
  end if;
  return jsonb_build_object('ok', true, 'id', a.id, 'resultado', r, 'exp', exp_ok, 'exp_ganho', case when exp_ok then (cfg->>'exp_ganho')::int else 0 end,
                            'feitos_hoje', feitos + 1, 'com_exp_restantes', greatest(0, (cfg->>'exp_por_dia')::int - feitos - 1),
                            'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla));
end;
$$;
revoke all on function public.tc_amistoso(bigint, text) from public, anon;
grant execute on function public.tc_amistoso(bigint, text) to authenticated;

create or replace function public.tc_amistosos_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('amistoso');
  hoje date := site_hoje_br();
  feitos int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  select count(*) into feitos from tc_amistosos where org_a = o.id and dia = hoje;
  return jsonb_build_object(
    'feitos_hoje', feitos, 'exp_por_dia', (cfg->>'exp_por_dia')::int, 'exp_ganho', (cfg->>'exp_ganho')::int,
    'com_exp_restantes', greatest(0, (cfg->>'exp_por_dia')::int - feitos),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'exp', h.deu_exp, 'a', (h.resultado->>'a')::int, 'b', (h.resultado->>'b')::int,
                         'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla)) order by h.id desc)
                         from (select * from tc_amistosos where org_a = o.id order by id desc limit 30) h join tc_orgs g on g.id = h.org_b), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_amistosos_historico() from public, anon;
grant execute on function public.tc_amistosos_historico() to authenticated;

-- ---------------------------------------------------------------- 4. Recrutar (baús)
create or replace function public.tc_recrutar_info()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('gacha');
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  return jsonb_build_object(
    'config', cfg,
    'saldo_rc', coalesce((select saldo from site_carteira where user_id = uid), 0),
    'elenco', (select count(*) from tc_jogadores where org_id = o.id),
    'elenco_max', ((tc_cfg('elenco'))->>'max')::int,
    'estrelas', jsonb_build_object(
      'total', (select count(*) from tc_jogadores where not ficticio),
      'livres', (select count(*) from tc_jogadores where not ficticio and org_id is null),
      'por_raridade', coalesce((select jsonb_object_agg(r, n) from (select raridade as r, count(*) filter (where org_id is null) as n from tc_jogadores where not ficticio and raridade is not null group by raridade) q), '{}'::jsonb)),
    'garantia', coalesce((select jsonb_object_agg(bau, sem_epico) from tc_gacha_pity where org_id = o.id), '{}'::jsonb),
    'minhas_estrelas', coalesce((select jsonb_agg(tc_jogador_json(j) order by j.id) from tc_jogadores j where j.org_id = o.id and not j.ficticio), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_recrutar_info() from public, anon;
grant execute on function public.tc_recrutar_info() to authenticated;

-- Sorteia a raridade de uma abertura. `garantido` força épico ou melhor (sem mexer na proporção entre eles).
create or replace function public.tc_gacha_raridade(odds jsonb, garantido boolean)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  ordem text[] := array['comum', 'raro', 'epico', 'lendario', 'mitico'];
  r text;
  total double precision := 0;
  x double precision;
  acc double precision := 0;
begin
  foreach r in array ordem loop
    if garantido and r in ('comum', 'raro') then continue; end if;
    total := total + coalesce((odds->>r)::double precision, 0);
  end loop;
  x := random() * total;
  foreach r in array ordem loop
    if garantido and r in ('comum', 'raro') then continue; end if;
    acc := acc + coalesce((odds->>r)::double precision, 0);
    if x < acc then return r; end if;
  end loop;
  return case when garantido then 'epico' else 'comum' end;
end;
$$;
revoke all on function public.tc_gacha_raridade(jsonb, boolean) from public, anon, authenticated;

create or replace function public.tc_recrutar(bau_ text, qtd_ int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('gacha');
  b jsonb;
  ordem text[] := array['comum', 'raro', 'epico', 'lendario', 'mitico'];
  preco bigint;
  g tc_gacha;
  j tc_jogadores;
  rar text;
  achada text;
  sem int;
  pity int := (cfg->>'pity_a_cada')::int;
  semana int := tc_semana_global();
  sal int;
  itens jsonb := '[]'::jsonb;
  i int;
  k int;
  ofs int;
  gid bigint;
  saldo_novo bigint;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  if qtd_ is null or qtd_ not in (1, 5) then raise exception 'quantidade_invalida'; end if;
  b := cfg->'baus'->bau_;
  if b is null then raise exception 'bau_invalido'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into g from tc_gacha where user_id = uid and chave = chave_;
  if g.id is not null then return jsonb_build_object('ja_feito', true, 'itens', g.resultado, 'preco_rc', g.custo_rc); end if;
  if (select count(*) from tc_jogadores where org_id = o.id) + qtd_ > ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if;
  perform pg_advisory_xact_lock(85098); -- uma abertura por vez: duas pessoas nunca sorteiam a mesma Estrela
  if (select count(*) from tc_jogadores where not ficticio and org_id is null) < qtd_ then raise exception 'sem_estrelas'; end if;
  preco := case when qtd_ = 5 then round((b->>'rc')::numeric * 5 * (1 - (cfg->>'desconto_5')::numeric)) else (b->>'rc')::bigint end;
  select coalesce(sem_epico, 0) into sem from tc_gacha_pity where org_id = o.id and bau = bau_;
  sem := coalesce(sem, 0);
  perform site_moedas_mexer(uid, -preco, 'tecnico_bau', left(bau_ || ':x' || qtd_::text, 200)); -- falta de saldo desfaz tudo
  for i in 1..qtd_ loop
    rar := tc_gacha_raridade(b->'odds', sem + 1 >= pity);
    -- se a raridade sorteada acabou, procura a mais próxima que ainda tem Estrela livre
    achada := null;
    ofs := array_position(ordem, rar);
    for k in 0..4 loop
      foreach achada in array array[ordem[ofs - k], ordem[ofs + k]] loop
        continue when achada is null;
        exit when exists (select 1 from tc_jogadores where not ficticio and org_id is null and raridade = achada);
        achada := null;
      end loop;
      exit when achada is not null;
    end loop;
    if achada is null then raise exception 'sem_estrelas'; end if;
    select * into j from tc_jogadores where not ficticio and org_id is null and raridade = achada order by random() limit 1 for update;
    sal := tc_salario(tc_preco_jogador(j));
    perform set_config('tc.estrela_liberada', j.id::text, true);
    update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = semana + (cfg->>'contrato_semanas')::int where id = j.id;
    perform set_config('tc.estrela_liberada', '', true);
    insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
    values (j.id, o.id, 'contratacao', round(preco::numeric / qtd_)::bigint, 'rc', sal, semana + (cfg->>'contrato_semanas')::int, null, uid);
    select * into j from tc_jogadores where id = j.id;
    itens := itens || jsonb_build_array(jsonb_build_object('raridade', achada, 'sorteada', rar, 'jogador', tc_jogador_json(j)));
    sem := case when array_position(ordem, achada) >= 3 then 0 else sem + 1 end;
  end loop;
  insert into tc_gacha_pity (org_id, bau, sem_epico) values (o.id, bau_, sem)
    on conflict (org_id, bau) do update set sem_epico = excluded.sem_epico;
  insert into tc_gacha (org_id, user_id, bau, qtd, custo_rc, resultado, chave) values (o.id, uid, bau_, qtd_, preco, itens, chave_) returning id into gid;
  select c.saldo into saldo_novo from site_carteira c where c.user_id = uid;
  return jsonb_build_object('ok', true, 'id', gid, 'itens', itens, 'preco_rc', preco, 'saldo_rc', coalesce(saldo_novo, 0), 'garantia', sem);
end;
$$;
revoke all on function public.tc_recrutar(text, int, text) from public, anon;
grant execute on function public.tc_recrutar(text, int, text) to authenticated;

-- ---------------------------------------------------------------- JSON do jogador com raridade
create or replace function public.tc_jogador_json(j tc_jogadores, ver_pot boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j);
begin
  return jsonb_build_object(
    'id', j.id, 'nome', j.nome, 'ficticio', j.ficticio, 'genero', j.genero, 'pos', j.pos, 'pos2', to_jsonb(j.pos2),
    'idade', j.idade, 'regiao', j.regiao, 'retrato', j.retrato,
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama,
    'potencial', case when ver_pot then j.potencial else null end,
    'forma', j.forma, 'exp', j.exp, 'poder', round(p)::int,
    'org_id', j.org_id, 'slot', j.slot, 'salario', j.salario, 'contrato_fim', j.contrato_fim,
    'preco', tc_preco(p, j.potencial, j.fama, j.idade),
    'estrela', not j.ficticio,
    'raridade', j.raridade,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;
