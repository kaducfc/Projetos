-- Painel do administrador: ficha completa de um jogador (pelo nick).
-- Rodar depois da 0029. Só administradores; só leitura.
--
-- site_admin_jogador(nome): se o nick existir, devolve a conta, a ranqueada,
-- as partidas, os jogos diários, as doações, a atividade recente e os saves.
-- Se não existir, devolve só sugestões de nicks parecidos.

create or replace function public.site_admin_jogador(nome text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  hoje date := site_hoje_br();
  alvo uuid;
  q text := trim(coalesce(nome, ''));
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if char_length(q) < 2 then
    raise exception 'nome_curto';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(q);
  if alvo is null then
    return jsonb_build_object(
      'encontrado', false,
      'sugestoes', coalesce((select jsonb_agg(username order by username) from (
        select username from site_profiles
         where username ilike replace(replace(q, '_', '\_'), '%', '\%') || '%'
            or username ilike '%' || replace(replace(q, '_', '\_'), '%', '\%') || '%'
         order by (username ilike q || '%') desc, username limit 8) s), '[]'::jsonb));
  end if;
  return jsonb_build_object(
    'encontrado', true,
    'hoje', hoje,
    -- Conta
    'conta', (select jsonb_build_object(
        'id', p.id, 'username', p.username, 'criada', p.created_at, 'avatar', p.avatar,
        'nick_trocado_em', p.username_changed_at, 'apoio_total', p.apoio_total, 'apoiador_desde', p.apoiador_desde,
        'email', u.email, 'ultimo_acesso', u.last_sign_in_at,
        'login', coalesce(u.raw_app_meta_data->'providers', to_jsonb(array[u.raw_app_meta_data->>'provider'])),
        'admin', exists (select 1 from site_admins a where a.user_id = p.id))
      from site_profiles p left join auth.users u on u.id = p.id where p.id = alvo),
    'banido', (select jsonb_build_object('motivo', b.motivo, 'desde', b.criado)
                 from site_ranked_banidos b where b.user_id = alvo),
    -- Ranqueada
    'ranqueada', (select jsonb_build_object('pts', r.pts, 'elo', site_rk_elo(r.pts, r.topo), 'ultima_atividade', r.ultima_atividade,
                                            'desde', r.criado)
                    from site_rk r where r.user_id = alvo),
    'vagas_hoje', jsonb_build_object(
      'carreira-no-rift', (select count(*) from site_ranked_inicios where user_id = alvo and dia = hoje and jogo = 'carreira-no-rift'),
      'cblol', (select count(*) from site_ranked_inicios where user_id = alvo and dia = hoje and jogo = 'cblol')),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('criado', l.criado, 'dia', l.dia, 'jogo', l.jogo, 'motivo', l.motivo,
                                                               'delta', l.delta, 'antes', l.antes, 'depois', l.depois) order by l.id desc)
                             from (select * from site_rk_lanc where user_id = alvo order by id desc limit 40) l), '[]'::jsonb),
    -- Partidas ranqueadas dos últimos 30 dias (mesmo formato da vigilância).
    'partidas', coalesce((select jsonb_agg(x order by x.criado desc) from (
      select d.dia, d.criado, d.jogo, d.n, d.base, d.pdr, d.score,
             r.summary->>'resultado' as resultado,
             (r.summary->>'vitorias')::int as vitorias,
             (r.summary->>'invicto')::boolean as invicto,
             (r.summary->>'peakOvr')::int as ovr,
             sd.status as status,
             case when sd.user_id is not null then jsonb_array_length(sd.chutes) end as chutes,
             case when sd.user_id is not null then jsonb_array_length(sd.dicas) end as dicas,
             e.media, e.reinicios,
             (select min((q2->>'pontos')::int) from jsonb_array_elements(e.rodadas) q2) as pior_rodada,
             case
               when d.jogo in ('cblol', 'carreira-no-rift') then extract(epoch from (i.usado_em - i.criado))::int
               when sd.user_id is not null then extract(epoch from (sd.terminado - sd.criado))::int
               when e.user_id is not null then extract(epoch from (e.terminado - e.criado))::int
             end as duracao_s
        from site_rk_dia d
        left join site_game_results r on r.id = d.result_id and d.jogo in ('cblol', 'carreira-no-rift')
        left join site_ranked_inicios i on i.result_id = d.result_id and d.jogo in ('cblol', 'carreira-no-rift')
        left join site_diario sd on sd.user_id = d.user_id and sd.dia = d.dia and sd.jogo = d.jogo and d.jogo in ('runetermo', 'campeao')
        left join site_escala e on e.user_id = d.user_id and e.dia = d.dia and d.jogo = 'escala'
       where d.user_id = alvo and d.dia >= hoje - 29
       order by d.criado desc limit 300) x), '[]'::jsonb),
    -- Todas as partidas jogadas (ranqueadas ou não), por jogo.
    'jogos', coalesce((select jsonb_object_agg(game_id, jsonb_build_object('partidas', n, 'melhor', melhor, 'ultima', ultima))
                         from (select game_id, count(*) as n, max(score) as melhor, max(played_at) as ultima
                                 from site_game_results where user_id = alvo group by game_id) g), '{}'::jsonb),
    'ultimas', coalesce((select jsonb_agg(jsonb_build_object('quando', t.played_at, 'jogo', t.game_id, 'nota', t.score,
                                                             'texto', left(t.summary->>'text', 160),
                                                             'ranqueada', t.summary ? 'ranked') order by t.played_at desc)
                           from (select * from site_game_results where user_id = alvo order by played_at desc limit 15) t), '[]'::jsonb),
    -- Runetermo e Campeão Oculto (últimos 14 dias) e Na Medida
    'diarios', coalesce((select jsonb_agg(jsonb_build_object('dia', s.dia, 'jogo', s.jogo, 'status', s.status,
                                                             'chutes', jsonb_array_length(s.chutes), 'dicas', jsonb_array_length(s.dicas),
                                                             'pdr', s.pdr) order by s.dia desc, s.jogo)
                           from site_diario s where s.user_id = alvo and s.dia >= hoje - 13), '[]'::jsonb),
    'escala', coalesce((select jsonb_agg(jsonb_build_object('dia', s.dia, 'status', s.status, 'media', s.media, 'pdr', s.pdr,
                                                            'reinicios', s.reinicios) order by s.dia desc)
                          from site_escala s where s.user_id = alvo and s.dia >= hoje - 13), '[]'::jsonb),
    -- Doações
    'apoios', coalesce((select jsonb_agg(jsonb_build_object('criado', a.criado, 'valor', a.valor, 'valor_pago', a.valor_pago,
                                                            'status', a.status, 'origem', a.origem) order by a.criado desc)
                          from (select * from site_apoios where user_id = alvo order by criado desc limit 20) a), '[]'::jsonb),
    -- Atividade no site
    'atividade', jsonb_build_object(
      'eventos', (select count(*) from site_events where user_id = alvo),
      'aparelhos', (select count(distinct device) from site_events where user_id = alvo),
      'primeiro', (select min(created_at) from site_events where user_id = alvo),
      'ultimo', (select max(created_at) from site_events where user_id = alvo),
      'recentes', coalesce((select jsonb_agg(jsonb_build_object('quando', v.created_at, 'tipo', v.kind, 'jogo', v.game_id) order by v.created_at desc)
                              from (select * from site_events where user_id = alvo order by created_at desc limit 15) v), '[]'::jsonb)),
    -- Progresso guardado na nuvem
    'saves', coalesce((select jsonb_agg(jsonb_build_object('jogo', s.game_id, 'atualizado', s.updated_at, 'bytes', pg_column_size(s.data)) order by s.updated_at desc)
                         from site_game_saves s where s.user_id = alvo), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_admin_jogador(text) from public, anon;
grant execute on function public.site_admin_jogador(text) to authenticated;
