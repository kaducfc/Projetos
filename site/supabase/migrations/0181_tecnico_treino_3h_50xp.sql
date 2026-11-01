-- Simulador de Técnico: o treino de atributo agora dura 3 horas (antes 6) e custa 50 de XP (antes a barra inteira, 100).
-- A barra de XP continua indo de 0 a 100: o que passa de 50 fica guardado. Rode depois da 0180. Idempotente.
update public.tc_config set valor = valor || '{"horas": 3, "exp_custo": 50}'::jsonb where chave = 'treino';

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
  xp_custo int := coalesce((cfg->>'exp_custo')::int, 100);
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
  if j.exp < xp_custo then raise exception 'xp_insuficiente'; end if; -- só treina com XP suficiente para a sessão
  custo := tc_treino_custo(atual);
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(o.id, -custo, 'treino', j.id::text);
  update tc_jogadores set exp = exp - xp_custo where id = j.id; -- a sessão gasta o XP (a barra segue de 0 a 100)
  insert into tc_treinos (org_id, jogador_id, atributo, pontos, custo, fim, chave, user_id)
  values (o.id, j.id, atributo_, (cfg->>'pontos')::int, custo, now() + make_interval(secs => round(tc_treino_horas(j) * 3600)::int), chave_, uid)
  returning * into t;
  return jsonb_build_object('ok', true, 'fim', t.fim, 'custo', custo, 'pontos', t.pontos);
end;
$$;
revoke all on function public.tc_treinar(bigint, text, text) from public, anon;
grant execute on function public.tc_treinar(bigint, text, text) to authenticated;
