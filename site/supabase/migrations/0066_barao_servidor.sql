-- Show do Barão no servidor: as perguntas e as respostas certas ficam aqui, no
-- banco, e o site só recebe uma pergunta de cada vez (sem a resposta certa).
-- Rodar depois da 0065. Depois, rodar também barao-banco/perguntas.sql (as
-- perguntas em si; esse arquivo NÃO fica no site). Rodar de novo é seguro.
--
--   * Visitantes (sem conta) jogam do mesmo jeito, só que a partida deles não vale PDR.
--   * Quem tem conta: a partida começada conta como uma das 5 do dia (site_rk_iniciar)
--     e, ao terminar, o servidor mesmo calcula o prêmio e lança o PDR.
--   * Prêmio, ajudas (Pinstouro, cartas do TF, Monstros do Vazio) e sorteios são todos
--     decididos aqui, então não dá para forjar resultado nem descobrir a resposta antes.
--   * Partidas de visitantes abandonadas (mais de 6 h sem mexer) são apagadas sozinhas
--     toda vez que alguém começa uma partida; as de contas, depois de 3 dias.

create table if not exists public.site_barao_perguntas (
  id int generated always as identity primary key,
  faixa int not null check (faixa between 1 and 4),   -- 1 fácil, 2 média, 3 difícil, 4 quase impossível
  cat text not null,
  q text not null unique,
  a text[] not null check (array_length(a, 1) = 4)     -- a[1] é a resposta certa
);
alter table public.site_barao_perguntas enable row level security;
revoke all on table public.site_barao_perguntas from anon, authenticated;
-- Sem políticas: ninguém lê direto, só as funções abaixo.

create table if not exists public.site_barao_partidas (
  id uuid primary key default gen_random_uuid(),   -- também é o "código" que o navegador guarda
  user_id uuid references auth.users(id) on delete cascade,  -- null = visitante
  ranked uuid,                    -- ingresso do dia (site_ranked_inicios.id); null = não vale PDR
  dia date,
  nivel int not null default 1,
  status text not null default 'jogando' check (status in ('jogando', 'acertou', 'fim')),
  pulos int not null default 2,
  carta_ordem text[] not null,    -- cor de cada carta, da posição 1 a 3 (segredo até uma ser virada)
  carta_usada jsonb,              -- { slot, id, tira }
  vazio boolean not null default false,
  usadas int[] not null default '{}',
  pergunta int,
  opcoes jsonb,                   -- as 4 alternativas, na ordem mostrada
  certa int,                      -- posição (0 a 3) da certa
  eliminadas int[] not null default '{}',
  votos jsonb,
  premio int,
  resultado text,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
alter table public.site_barao_partidas enable row level security;
revoke all on table public.site_barao_partidas from anon, authenticated;
create index if not exists site_barao_partidas_atualizado on public.site_barao_partidas (atualizado);

-- Prêmios das 11 perguntas (igual a PREMIOS em jogos/barao/js/logic.js).
create or replace function public.site_barao_premios()
returns int[] language sql immutable as $$
  select array[500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000];
$$;

-- Faixa de dificuldade da pergunta `n`: 1-3 fácil, 4-6 média, 7-10 difícil, 11 quase impossível.
create or replace function public.site_barao_faixa(n int)
returns int language sql immutable as $$
  select case when n <= 3 then 1 when n <= 6 then 2 when n <= 10 then 3 else 4 end;
$$;

-- Sorteia a pergunta do nível atual (sem repetir) e embaralha as 4 alternativas.
create or replace function public.site_barao_nova_pergunta(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas;
  q site_barao_perguntas;
  ordem int[];
  opc jsonb;
  cert int;
begin
  select * into p from site_barao_partidas where id = pid;
  select * into q from site_barao_perguntas
   where faixa = site_barao_faixa(p.nivel) and id <> all (p.usadas) order by random() limit 1;
  if q.id is null then
    select * into q from site_barao_perguntas where faixa = site_barao_faixa(p.nivel) order by random() limit 1;
  end if;
  if q.id is null then
    raise exception 'sem_perguntas';
  end if;
  select array_agg(x order by random()) into ordem from generate_series(1, 4) x;
  select jsonb_agg(q.a[t.o] order by t.ord) into opc from unnest(ordem) with ordinality t(o, ord);
  select t.ord - 1 into cert from unnest(ordem) with ordinality t(o, ord) where t.o = 1;
  update site_barao_partidas
     set pergunta = q.id, opcoes = opc, certa = cert, eliminadas = '{}', votos = null,
         usadas = p.usadas || q.id, atualizado = now()
   where id = pid;
end;
$$;
revoke all on function public.site_barao_nova_pergunta(uuid) from public, anon, authenticated;

-- O que a tela recebe. A resposta certa só vai depois de a pergunta ser respondida;
-- a cor de cada carta só depois de uma ser virada.
create or replace function public.site_barao_json(p public.site_barao_partidas)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'nivel', p.nivel, 'status', p.status, 'pulos', p.pulos, 'vazio', p.vazio,
    'cartaUsada', p.carta_usada,
    'cartaOrdem', case when p.carta_usada is not null then to_jsonb(p.carta_ordem) end,
    'pergunta', jsonb_build_object(
      'q', (select x.q from site_barao_perguntas x where x.id = p.pergunta),
      'opcoes', p.opcoes, 'eliminadas', to_jsonb(p.eliminadas), 'votos', p.votos,
      'certa', case when p.status <> 'jogando' then p.certa end),
    'premio', p.premio, 'resultado', p.resultado);
$$;
revoke all on function public.site_barao_json(public.site_barao_partidas) from public, anon, authenticated;

-- A partida do código `pid`, travada para alteração. Se a partida é de uma conta, só essa
-- conta mexe nela.
create or replace function public.site_barao_dono(pid uuid)
returns public.site_barao_partidas
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas;
begin
  select * into p from site_barao_partidas where id = pid for update;
  if p.id is null or (p.user_id is not null and p.user_id is distinct from auth.uid()) then
    raise exception 'sem_partida';
  end if;
  return p;
end;
$$;
revoke all on function public.site_barao_dono(uuid) from public, anon, authenticated;

-- Fim da partida com conta: o servidor mesmo lança o PDR (a partida valida só se tinha
-- ingresso do dia, foi começada hoje e a conta não está fora da ranqueada).
-- Devolve { valeu, pdr, numero } ou null.
create or replace function public.site_barao_fechar(p public.site_barao_partidas)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  usado uuid;
  b int;
  niv int;
  valor int;
  num int;
  gravou int;
begin
  if p.user_id is null or p.ranked is null or p.dia is distinct from hoje then
    return null;
  end if;
  if exists (select 1 from site_ranked_banidos where user_id = p.user_id) then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || p.user_id::text));
  update site_ranked_inicios i set usado_em = now()
   where i.id = p.ranked and i.user_id = p.user_id and i.dia = hoje and i.jogo = 'barao' and i.usado_em is null
  returning i.id into usado;
  if usado is null then
    return null;
  end if;
  select count(*) into num from site_ranked_inicios x
   where x.user_id = p.user_id and x.dia = hoje and x.jogo = 'barao'
     and x.criado <= (select criado from site_ranked_inicios where id = usado);
  niv := site_rk_nivel_de(p.user_id);
  b := site_rk_base_barao(p.premio);
  valor := site_rk_ajustar(b, niv);
  insert into site_rk_dia (user_id, dia, jogo, n, base, nivel, pdr, score)
  values (p.user_id, hoje, 'barao', num, b, niv, valor, p.premio)
  on conflict (user_id, dia, jogo, n) do nothing
  returning 1 into gravou;
  if gravou is null then
    return null;
  end if;
  perform site_rk_lancar(p.user_id, hoje, 'barao', 'partida', valor);
  return jsonb_build_object('valeu', true, 'pdr', valor, 'numero', num);
end;
$$;
revoke all on function public.site_barao_fechar(public.site_barao_partidas) from public, anon, authenticated;

-- ----------------------------------------------------------- jogar
-- Começa uma partida (visitante ou conta). Devolve { estado, ranked }.
create or replace function public.site_barao_comecar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  tok uuid;
  novo uuid;
  p site_barao_partidas;
  ordem text[];
begin
  -- Limpeza: partidas de visitantes paradas há mais de 6 h e de contas há mais de 3 dias.
  delete from site_barao_partidas
   where (user_id is null and atualizado < now() - interval '6 hours')
      or (user_id is not null and atualizado < now() - interval '3 days');
  ordem := array(select x from unnest(array['azul', 'vermelha', 'dourada']) x order by random());
  if uid is not null then
    r := site_rk_iniciar('barao');
    tok := nullif(r->>'token', '')::uuid;
  end if;
  insert into site_barao_partidas (user_id, ranked, dia, carta_ordem)
  values (uid, tok, site_hoje_br(), ordem) returning id into novo;
  perform site_barao_nova_pergunta(novo);
  select * into p from site_barao_partidas where id = novo;
  return jsonb_build_object('estado', site_barao_json(p), 'ranked', r);
end;
$$;
revoke all on function public.site_barao_comecar() from public;
grant execute on function public.site_barao_comecar() to anon, authenticated;

-- Retoma uma partida (null se não existe mais).
create or replace function public.site_barao_estado(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas;
begin
  select * into p from site_barao_partidas where id = pid;
  if p.id is null or (p.user_id is not null and p.user_id is distinct from auth.uid()) then
    return null;
  end if;
  return site_barao_json(p);
end;
$$;
revoke all on function public.site_barao_estado(uuid) from public;
grant execute on function public.site_barao_estado(uuid) to anon, authenticated;

-- Resposta: `indice` é a posição (0 a 3) da alternativa escolhida.
create or replace function public.site_barao_responder(pid uuid, indice int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
  prem int[] := site_barao_premios();
  acertou boolean;
  rk jsonb;
begin
  if p.status <> 'jogando' then
    raise exception 'estado_invalido';
  end if;
  if indice is null or indice < 0 or indice > 3 or indice = any (p.eliminadas) then
    raise exception 'opcao_invalida';
  end if;
  acertou := indice = p.certa;
  if acertou and p.nivel >= 11 then
    update site_barao_partidas set status = 'fim', resultado = 'ganhou', premio = prem[11], atualizado = now() where id = p.id;
  elsif acertou then
    update site_barao_partidas set status = 'acertou', premio = prem[p.nivel], atualizado = now() where id = p.id;
  else
    -- Errar vale o degrau abaixo do que o jogador já tinha (nada nas duas primeiras).
    update site_barao_partidas set status = 'fim', resultado = 'errou',
           premio = case when p.nivel >= 3 then prem[p.nivel - 2] else 0 end, atualizado = now() where id = p.id;
  end if;
  select * into p from site_barao_partidas where id = pid;
  if p.status = 'fim' then
    rk := site_barao_fechar(p);
  end if;
  return jsonb_build_object('acertou', acertou, 'estado', site_barao_json(p), 'ranqueada', rk);
end;
$$;
revoke all on function public.site_barao_responder(uuid, int) from public;
grant execute on function public.site_barao_responder(uuid, int) to anon, authenticated;

-- Depois de acertar: a próxima pergunta.
create or replace function public.site_barao_proxima(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
begin
  if p.status <> 'acertou' then
    raise exception 'estado_invalido';
  end if;
  update site_barao_partidas set nivel = p.nivel + 1, status = 'jogando', atualizado = now() where id = pid;
  perform site_barao_nova_pergunta(pid);
  select * into p from site_barao_partidas where id = pid;
  return jsonb_build_object('estado', site_barao_json(p));
end;
$$;
revoke all on function public.site_barao_proxima(uuid) from public;
grant execute on function public.site_barao_proxima(uuid) to anon, authenticated;

-- Parar: leva o prêmio da pergunta anterior.
create or replace function public.site_barao_parar(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
  prem int[] := site_barao_premios();
  rk jsonb;
begin
  if p.status <> 'jogando' or p.nivel < 2 then
    raise exception 'estado_invalido';
  end if;
  update site_barao_partidas set status = 'fim', resultado = 'parou', premio = prem[p.nivel - 1], atualizado = now() where id = pid;
  select * into p from site_barao_partidas where id = pid;
  rk := site_barao_fechar(p);
  return jsonb_build_object('estado', site_barao_json(p), 'ranqueada', rk);
end;
$$;
revoke all on function public.site_barao_parar(uuid) from public;
grant execute on function public.site_barao_parar(uuid) to anon, authenticated;

-- Pinstouro: troca a pergunta por outra do mesmo nível (não avança). 2 por partida; nunca na última.
create or replace function public.site_barao_pular(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
begin
  if p.status <> 'jogando' or p.pulos <= 0 or p.nivel >= 11 then
    raise exception 'ajuda_indisponivel';
  end if;
  update site_barao_partidas set pulos = p.pulos - 1 where id = pid;
  perform site_barao_nova_pergunta(pid);
  select * into p from site_barao_partidas where id = pid;
  return jsonb_build_object('estado', site_barao_json(p));
end;
$$;
revoke all on function public.site_barao_pular(uuid) from public;
grant execute on function public.site_barao_pular(uuid) to anon, authenticated;

-- Carta do Twisted Fate: `slot` (0 a 2) é a carta virada para baixo escolhida. Só uma carta
-- por partida; a cor decide quantas alternativas erradas somem (azul 1, vermelha 2, dourada 3).
create or replace function public.site_barao_carta(pid uuid, slot int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
  cor text;
  tira int;
  sorteadas int[];
begin
  if p.status <> 'jogando' or p.carta_usada is not null or p.nivel >= 11 or slot is null or slot < 0 or slot > 2 then
    raise exception 'ajuda_indisponivel';
  end if;
  cor := p.carta_ordem[slot + 1];
  tira := case cor when 'azul' then 1 when 'vermelha' then 2 else 3 end;
  select array_agg(i) into sorteadas from (
    select i from generate_series(0, 3) i
     where i <> p.certa and i <> all (p.eliminadas) order by random() limit tira) x;
  update site_barao_partidas
     set eliminadas = p.eliminadas || coalesce(sorteadas, '{}'),
         carta_usada = jsonb_build_object('slot', slot, 'id', cor, 'tira', tira), atualizado = now()
   where id = pid;
  select * into p from site_barao_partidas where id = pid;
  return jsonb_build_object('estado', site_barao_json(p));
end;
$$;
revoke all on function public.site_barao_carta(uuid, int) from public;
grant execute on function public.site_barao_carta(uuid, int) to anon, authenticated;

-- Monstros do Vazio: três votos; cada um acerta com mais chance nas perguntas fáceis.
create or replace function public.site_barao_vazio(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_barao_partidas := site_barao_dono(pid);
  chance numeric;
  erradas int[];
  v jsonb := '[]'::jsonb;
  m text;
begin
  if p.status <> 'jogando' or p.vazio or p.nivel >= 11 then
    raise exception 'ajuda_indisponivel';
  end if;
  chance := case site_barao_faixa(p.nivel) when 1 then 0.9 when 2 then 0.76 else 0.58 end;
  erradas := array(select i from generate_series(0, 3) i where i <> p.certa and i <> all (p.eliminadas));
  foreach m in array array['chogath', 'khazix', 'velkoz'] loop
    v := v || jsonb_build_array(jsonb_build_object('id', m,
      'voto', case when random() < chance or coalesce(array_length(erradas, 1), 0) = 0 then p.certa
                   else erradas[1 + floor(random() * array_length(erradas, 1))::int] end));
  end loop;
  update site_barao_partidas set votos = v, vazio = true, atualizado = now() where id = pid;
  select * into p from site_barao_partidas where id = pid;
  return jsonb_build_object('estado', site_barao_json(p));
end;
$$;
revoke all on function public.site_barao_vazio(uuid) from public;
grant execute on function public.site_barao_vazio(uuid) to anon, authenticated;
