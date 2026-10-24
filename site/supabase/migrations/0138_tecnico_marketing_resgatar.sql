-- Marketing: a receita acumulada fica pendente (e continua subindo na tela) até ser resgatada.
--   * Abrir a tela do marketing NÃO credita mais nada: o "acumulando agora" continua de onde estava.
--   * O botão "Resgatar" credita o acumulado na hora (tc_marketing_resgatar).
--   * Ao entrar no jogo, o acumulado é creditado sozinho se já passaram 15 minutos desde o último crédito (proc_min_s = 900).
--   * Fechar contrato, melhorar o marketing e iniciar campanha continuam fechando o trecho (as regras mudam depois deles).
-- Rode depois da 0137; seguro rodar de novo.

update public.tc_config set valor = jsonb_set(valor, '{proc_min_s}', '900') where chave = 'marketing';
drop function if exists public.tc_marketing_estado();

create or replace function public.tc_marketing_estado(entrada boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  m tc_marketing;
  c jsonb := tc_mkt_cfg();
  agora timestamptz := now();
  aud numeric;
  taxa jsonb;
  pm numeric;
  limite int;
  nivel_max int := (c->'nivel_custo'->>'max')::int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  if entrada then perform tc_marketing_processar(o.id, false); end if; -- só ao entrar no jogo (e se passaram 15 min); abrir a tela do marketing não credita
  select * into o from tc_orgs where id = o.id;
  select * into m from tc_marketing where org_id = o.id;
  aud := tc_mkt_audiencia(o.id, m.nivel);
  taxa := tc_mkt_taxa(o.id, agora, aud);
  pm := (taxa->>'por_minuto')::numeric;
  limite := tc_mkt_limite(m.nivel);
  return jsonb_build_object(
    'agora', agora, 'creditos', o.creditos, 'divisao', o.divisao,
    'taxa', taxa || jsonb_build_object('por_hora', round(pm * 60, 1), 'por_dia', round(pm * 60 * 24)),
    'pendente', jsonb_build_object('segundos', round(extract(epoch from (agora - m.ultimo_proc))), 'valor', round(pm * least(extract(epoch from (agora - m.ultimo_proc)), (c->>'offline_max_h')::numeric * 3600) / 60),
                                   'ultimo', m.ultimo_proc, 'limite_h', (c->>'offline_max_h')::int),
    'fama', jsonb_build_object('valor', round(m.fama, 1), 'max', 1000, 'nivel', tc_fama_nivel(m.fama), 'niveis', c->'fama_niveis'),
    'marketing', jsonb_build_object('nivel', m.nivel, 'max', nivel_max, 'nome', c->'niveis_nomes'->>(m.nivel::text), 'bonus', (taxa->>'bonus_marketing')::numeric,
        'custo_proximo', case when m.nivel >= nivel_max then null else tc_mkt_custo_nivel(m.nivel) end,
        'proximo_nome', c->'niveis_nomes'->>((m.nivel + 1)::text),
        'proximo_bonus', least((c->>'mkt_bonus_max')::numeric, (c->>'mkt_bonus_nivel')::numeric * m.nivel),
        'limite_contratos', limite, 'limites', c->'limites', 'nomes', c->'niveis_nomes'),
    'contratos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'marca', p.marca, 'nome', (tc_mkt_marca(p.marca))->>'nome', 'categoria', (tc_mkt_marca(p.marca))->>'categoria',
                  'inicio', p.inicio, 'fim', p.fim, 'receita_min', p.receita_min, 'renovar_auto', p.renovar_auto, 'ativo', p.fim > agora) order by p.fim desc)
              from (select * from tc_patrocinios where org_id = o.id order by fim desc limit 30) p), '[]'::jsonb),
    'patrocinadores', coalesce((select jsonb_agg(x || jsonb_build_object(
          'estado', case when exists (select 1 from tc_patrocinios p where p.org_id = o.id and p.marca = x->>'id' and p.fim > agora) then 'ativo'
                         when tc_mkt_requisito(o.id, x) is not null then 'indisponivel'
                         when exists (select 1 from tc_patrocinios p where p.org_id = o.id and p.marca = x->>'id') then 'expirado' else 'disponivel' end,
          'motivo', tc_mkt_requisito(o.id, x)) order by array_position(array['local','regional','nacional','internacional','premium'], x->>'categoria'), (x->>'receita_min')::numeric)
        from jsonb_array_elements(c->'patrocinadores') x), '[]'::jsonb),
    'campanha_ativa', case when m.campanha is not null and m.campanha_fim > agora then jsonb_build_object('id', m.campanha, 'inicio', m.campanha_inicio, 'fim', m.campanha_fim, 'bonus', m.campanha_bonus) else null end,
    'campanhas', coalesce((select jsonb_agg(x || jsonb_build_object(
          'recarga_ate', case when coalesce((m.recargas->>(x->>'id'))::timestamptz, '-infinity') > agora then m.recargas->>(x->>'id') else null end,
          'requisito', case when m.fama < coalesce((x->'req'->>'fama')::numeric, 0) then 'Fama mínima: ' || (x->'req'->>'fama')
                            when m.nivel < coalesce((x->'req'->>'nivel')::int, 1) then 'Nível de marketing mínimo: ' || (x->'req'->>'nivel') else null end)
          order by (x->>'custo')::bigint) from jsonb_array_elements(c->'campanhas') x), '[]'::jsonb),
    'audiencia', jsonb_build_object('total', round(aud, 1), 'bonus', (taxa->>'bonus_audiencia')::numeric, 'cap', (c->'aud'->>'cap')::numeric,
        'jogadores', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'nome', j.nome, 'pos', j.pos, 'titular', j.slot is not null, 'fama', j.fama,
              'audiencia', round((10 * sqrt(j.fama) * case when j.slot is not null then 1 else (c->'aud'->>'peso_reserva')::numeric end * (1 + (c->'aud'->>'fator_nivel')::numeric * (m.nivel - 1)))::numeric, 1),
              'conta', (j.slot is not null or j.rn <= (c->'aud'->>'reservas_max')::int)) order by (j.slot is null), j.fama desc)
            from (select x.*, row_number() over (partition by (x.slot is not null) order by x.fama desc, x.id) rn from tc_jogadores x
                   where x.org_id = o.id and not exists (select 1 from tc_ofertas f where f.jogador_id = x.id)) j), '[]'::jsonb),
        'peso_reserva', (c->'aud'->>'peso_reserva')::numeric),
    'resumo', m.resumo);
end;
$$;
revoke all on function public.tc_marketing_estado(boolean) from public, anon;
grant execute on function public.tc_marketing_estado(boolean) to authenticated;

-- Resgatar: credita agora tudo o que o marketing acumulou desde o último resgate (limitado às horas offline do servidor).
create or replace function public.tc_marketing_resgatar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  r jsonb;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  r := tc_marketing_processar(o.id, true);
  update tc_marketing set resumo = null where org_id = o.id; -- resgatar na tela não gera o resumo "enquanto você estava fora"
  select creditos into o.creditos from tc_orgs where id = o.id;
  return jsonb_build_object('ok', true, 'total', coalesce((r->>'total')::bigint, 0), 'creditos', o.creditos);
end;
$$;
revoke all on function public.tc_marketing_resgatar() from public, anon;
grant execute on function public.tc_marketing_resgatar() to authenticated;
