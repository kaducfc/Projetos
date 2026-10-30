-- Mercado oficial com rotação: poucos jogadores à venda por vez (7 a 10), trocados a cada 12 horas, e com Poder
-- compatível com o do time (média dos titulares): de -5 a +8 em relação a essa média.
-- Cada conta recebe a sua própria oferta, guardada por janela de 12 h: não muda enquanto a janela dura, a não ser
-- pelos jogadores que forem comprados. A contratação no mercado oficial só vale para jogadores da oferta atual.
-- Rode DEPOIS da 0116.

insert into public.tc_config (chave, valor) values ('mercado_oficial', $json$
{"horas": 12, "min": 7, "max": 10, "abaixo": 5, "acima": 8, "poder_padrao": 50}
$json$::jsonb) on conflict (chave) do nothing;

create table if not exists public.tc_mercado_rot (
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  janela bigint not null,
  ref numeric not null,
  ids bigint[] not null default '{}',
  criado timestamptz not null default now(),
  primary key (org_id, janela)
);
alter table public.tc_mercado_rot enable row level security;
revoke all on public.tc_mercado_rot from anon, authenticated;

-- Referência de Poder do time: média dos titulares (no posto em que jogam); sem titulares, média do elenco; sem elenco, o padrão.
create or replace function public.tc_mercado_ref(oid bigint)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  r numeric;
begin
  select avg(tc_poder_efetivo(j, j.slot)) into r from tc_jogadores j where j.org_id = oid and j.slot is not null;
  if r is null then select avg(tc_poder(j)) into r from tc_jogadores j where j.org_id = oid; end if;
  return round(coalesce(r, ((tc_cfg('mercado_oficial'))->>'poder_padrao')::numeric), 1);
end;
$$;
revoke all on function public.tc_mercado_ref(bigint) from public, anon, authenticated;

create or replace function public.tc_mercado_janela()
returns bigint language sql stable security definer set search_path = public as $$
  select floor(extract(epoch from now()) / (((tc_cfg('mercado_oficial'))->>'horas')::numeric * 3600))::bigint;
$$;
revoke all on function public.tc_mercado_janela() from public, anon, authenticated;

-- Oferta da janela atual (cria na primeira consulta). Devolve os ids dos jogadores à venda.
-- Não cria jogadores novos (cada fictício tem a sua foto única): escolhe entre os livres, os da faixa de Poder primeiro e, se faltarem, os mais próximos dela.
create or replace function public.tc_mercado_oferta(oid bigint)
returns bigint[] language plpgsql security definer set search_path = public as $$
declare
  c jsonb := tc_cfg('mercado_oficial');
  jan bigint := tc_mercado_janela();
  ref numeric := tc_mercado_ref(oid);
  lo numeric := ref - (c->>'abaixo')::numeric;
  hi numeric := ref + (c->>'acima')::numeric;
  n int;
  ids bigint[];
begin
  perform pg_advisory_xact_lock(85117, (oid % 2147483647)::int);
  select r.ids into ids from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  if ids is not null then return ids; end if;
  delete from tc_mercado_rot where org_id = oid and janela < jan - 1;
  n := (c->>'min')::int + (abs(hashtextextended('n:' || jan::text || ':' || oid::text, 0)) % ((c->>'max')::int - (c->>'min')::int + 1))::int;
  perform tc_reabastecer();
  -- escolha: primeiro os que estão na faixa, variando as posições; se faltar, os mais próximos da faixa
  select coalesce(array_agg(x.id order by x.ordem), '{}') into ids from (
    select s.id, row_number() over (order by s.fora, s.rn, s.h) as ordem
      from (
        select j.id,
               (case when tc_poder(j) between lo and hi then 0 else 1 end) as fora,
               row_number() over (partition by (tc_poder(j) between lo and hi), j.pos
                                  order by case when tc_poder(j) between lo and hi then 0 else least(abs(tc_poder(j) - lo), abs(tc_poder(j) - hi)) end,
                                           hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 0)) as rn,
               hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 1) as h
          from tc_jogadores j where j.org_id is null and j.ficticio
      ) s
  ) x where x.ordem <= n;
  insert into tc_mercado_rot (org_id, janela, ref, ids) values (oid, jan, ref, ids) on conflict (org_id, janela) do nothing;
  return ids;
end;
$$;
revoke all on function public.tc_mercado_oferta(bigint) from public, anon, authenticated;

create or replace function public.tc_mercado_oficial(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  oid bigint;
  oferta bigint[];
  r jsonb;
begin
  perform tc_exigir(uid);
  select id into oid from tc_orgs where user_id = uid;
  if oid is null then return '[]'::jsonb; end if;
  oferta := tc_mercado_oferta(oid);
  select coalesce(jsonb_agg(x.j order by x.ord1 desc, x.id), '[]'::jsonb) into r
  from (
    select tc_jogador_json(j) as j, j.id,
           case coalesce(f->>'ordem', 'poder')
             when 'poder' then tc_poder(j) when 'potencial' then j.potencial::double precision
             when 'fama' then j.fama::double precision when 'preco' then -tc_preco(tc_poder(j), j.potencial, j.fama, j.idade)::double precision
             when 'idade' then -j.idade::double precision else tc_poder(j) end as ord1
      from tc_jogadores j
     where j.id = any (oferta) and j.org_id is null
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
  ) x;
  return r;
end;
$$;
revoke all on function public.tc_mercado_oficial(jsonb) from public, anon;
grant execute on function public.tc_mercado_oficial(jsonb) to authenticated;

-- Quando a oferta troca e qual é a faixa de Poder dela.
create or replace function public.tc_mercado_rotacao()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  oid bigint;
  c jsonb := tc_cfg('mercado_oficial');
  jan bigint := tc_mercado_janela();
  h numeric := (c->>'horas')::numeric;
  ref numeric;
  ate timestamptz := to_timestamp((jan + 1) * h * 3600);
begin
  perform tc_exigir(uid);
  select id into oid from tc_orgs where user_id = uid;
  if oid is null then raise exception 'sem_org'; end if;
  perform tc_mercado_oferta(oid);
  select r.ref into ref from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  return jsonb_build_object('proxima', ate, 'restante_s', greatest(0, round(extract(epoch from (ate - now())))), 'horas', h,
    'ref', ref, 'min', ref - (c->>'abaixo')::numeric, 'max', ref + (c->>'acima')::numeric);
end;
$$;
revoke all on function public.tc_mercado_rotacao() from public, anon;
grant execute on function public.tc_mercado_rotacao() to authenticated;

-- Contratação do mercado oficial: só jogadores da oferta atual (as demais regras continuam iguais à 0106).
create or replace function public.tc_contratar(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  preco bigint;
  sal int;
  ant jsonb;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then
    raise exception 'chave_invalida';
  end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  -- Pedido repetido: devolve o resultado anterior.
  select jsonb_build_object('ja_feito', true, 'jogador', jogador_id) into ant from tc_transf where user_id = uid and chave = chave_;
  if ant is not null then return ant; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.org_id is not null then raise exception 'jogador_indisponivel'; end if;
  if not (j.id = any (tc_mercado_oferta(o.id))) then raise exception 'fora_da_oferta'; end if; -- só vale para quem está à venda na rotação atual
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then
    raise exception 'elenco_cheio';
  end if;
  preco := tc_preco_jogador(j);
  if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
  sal := tc_salario(preco);
  perform tc_creditos_mexer(o.id, -preco, 'contratacao', j.id::text);
  update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, 'contratacao', preco, sal, null, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar(bigint, int, text) to authenticated;
