-- Simulador de Técnico: IDIOMAS e comunicação. Rode depois do 0150. Idempotente.
--  * Cada jogador tem um idioma nativo e, se for o caso, idiomas secundários. Os 60 Legados têm a ficha na tabela tc_idiomas (país de origem
--    conferido na Leaguepedia); os demais jogadores usam o idioma da região (tc_config 'idiomas' -> regioes), sem secundário.
--  * Entre dois titulares do mesmo time: mesmo idioma nativo = afinidade 1; sem o mesmo nativo mas com algum idioma em comum (nativo ou secundário
--    de um com o do outro) = 2/3; nada em comum = 0.
--  * Eficiência: cada titular ganha +0,5% (idiomas.eficiencia_pct) de Poder por afinidade com cada colega titular (até +2%).
--  * Sinergia: cada par de titulares soma 4 pontos (idiomas.sinergia_pontos) de afinidade à sinergia do time (a sinergia semanal continua valendo; o total fica limitado a 100).
-- Os idiomas secundários só foram preenchidos onde há fonte pública (Rookie fala chinês; Kaze, argentino, joga no Brasil): o resto pode ser ajustado em tc_idiomas.

create table if not exists public.tc_idiomas (
  nome text primary key,           -- nome do Legado em minúsculas
  pais text not null,
  nativo text not null,            -- ko, zh, pt, es, en ...
  sec text[] not null default '{}'
);
alter table public.tc_idiomas enable row level security;
revoke all on public.tc_idiomas from anon, authenticated;

insert into public.tc_idiomas (nome, pais, nativo, sec) values
    ('doran', 'Coreia do Sul', 'ko', array[]::text[]),
    ('oner', 'Coreia do Sul', 'ko', array[]::text[]),
    ('faker', 'Coreia do Sul', 'ko', array[]::text[]),
    ('peyz', 'Coreia do Sul', 'ko', array[]::text[]),
    ('keria', 'Coreia do Sul', 'ko', array[]::text[]),
    ('kiin', 'Coreia do Sul', 'ko', array[]::text[]),
    ('canyon', 'Coreia do Sul', 'ko', array[]::text[]),
    ('chovy', 'Coreia do Sul', 'ko', array[]::text[]),
    ('ruler', 'Coreia do Sul', 'ko', array[]::text[]),
    ('duro', 'Coreia do Sul', 'ko', array[]::text[]),
    ('zeus', 'Coreia do Sul', 'ko', array[]::text[]),
    ('kanavi', 'Coreia do Sul', 'ko', array[]::text[]),
    ('zeka', 'Coreia do Sul', 'ko', array[]::text[]),
    ('gumayusi', 'Coreia do Sul', 'ko', array[]::text[]),
    ('delight', 'Coreia do Sul', 'ko', array[]::text[]),
    ('siwoo', 'Coreia do Sul', 'ko', array[]::text[]),
    ('lucid', 'Coreia do Sul', 'ko', array[]::text[]),
    ('showmaker', 'Coreia do Sul', 'ko', array[]::text[]),
    ('smash', 'Coreia do Sul', 'ko', array[]::text[]),
    ('career', 'Coreia do Sul', 'ko', array[]::text[]),
    ('perfect', 'Coreia do Sul', 'ko', array[]::text[]),
    ('cuzz', 'Coreia do Sul', 'ko', array[]::text[]),
    ('bdd', 'Coreia do Sul', 'ko', array[]::text[]),
    ('jiwoo', 'Coreia do Sul', 'ko', array[]::text[]),
    ('effort', 'Coreia do Sul', 'ko', array[]::text[]),
    ('zest', 'Coreia do Sul', 'ko', array[]::text[]),
    ('feisty', 'Coreia do Sul', 'ko', array[]::text[]),
    ('tarzan', 'Coreia do Sul', 'ko', array[]::text[]),
    ('kael', 'Coreia do Sul', 'ko', array[]::text[]),
    ('theshy', 'Coreia do Sul', 'ko', array[]::text[]),
    ('rookie', 'Coreia do Sul', 'ko', array['zh']::text[]),
    ('viper', 'Coreia do Sul', 'ko', array[]::text[]),
    ('breathe', 'China', 'zh', array[]::text[]),
    ('shanks', 'China', 'zh', array[]::text[]),
    ('hope', 'China', 'zh', array[]::text[]),
    ('zuian', 'China', 'zh', array[]::text[]),
    ('tian', 'China', 'zh', array[]::text[]),
    ('creme', 'China', 'zh', array[]::text[]),
    ('jackeylove', 'China', 'zh', array[]::text[]),
    ('zhuo', 'China', 'zh', array[]::text[]),
    ('wei', 'China', 'zh', array[]::text[]),
    ('jiaqi', 'China', 'zh', array[]::text[]),
    ('meiko', 'China', 'zh', array[]::text[]),
    ('bin', 'China', 'zh', array[]::text[]),
    ('xun', 'China', 'zh', array[]::text[]),
    ('knight', 'China', 'zh', array[]::text[]),
    ('on', 'China', 'zh', array[]::text[]),
    ('curse', 'Brasil', 'pt', array[]::text[]),
    ('duduhh', 'Brasil', 'pt', array[]::text[]),
    ('ackerman', 'Brasil', 'pt', array[]::text[]),
    ('guigo', 'Brasil', 'pt', array[]::text[]),
    ('tatu', 'Brasil', 'pt', array[]::text[]),
    ('tutsz', 'Brasil', 'pt', array[]::text[]),
    ('ayu', 'Brasil', 'pt', array[]::text[]),
    ('jojo', 'Brasil', 'pt', array[]::text[]),
    ('xyno', 'Brasil', 'pt', array[]::text[]),
    ('sinatra', 'Brasil', 'pt', array[]::text[]),
    ('rabelo', 'Brasil', 'pt', array[]::text[]),
    ('uzent', 'Brasil', 'pt', array[]::text[]),
    ('kaze', 'Argentina', 'es', array['pt']::text[])
on conflict (nome) do nothing;

insert into public.tc_config (chave, valor) values
  ('idiomas', '{"eficiencia_pct": 0.5, "sec_fracao": 0.6667, "sinergia_pontos": 4,
               "regioes": {"BR": "pt", "KR": "ko", "CN": "zh", "EU": "en", "NA": "en", "VN": "vi", "JP": "ja", "LAN": "es", "LAS": "es", "TR": "tr"}}'::jsonb)
on conflict (chave) do nothing;

-- Ficha de idiomas de um jogador: Legado (pela tabela) ou, para os demais, o idioma da região.
create or replace function public.tc_idiomas_do(j tc_jogadores)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('nativo', i.nativo, 'sec', to_jsonb(i.sec), 'pais', i.pais) from tc_idiomas i where i.nome = lower(j.nome) and not j.ficticio),
    jsonb_build_object('nativo', coalesce(((tc_cfg('idiomas'))->'regioes')->>j.regiao, 'en'), 'sec', '[]'::jsonb, 'pais', j.regiao));
$$;
revoke all on function public.tc_idiomas_do(tc_jogadores) from public, anon, authenticated;

-- Afinidade entre duas fichas: 1 (mesmo nativo), 2/3 (algum idioma em comum) ou 0.
create or replace function public.tc_afinidade(a jsonb, b jsonb)
returns double precision language sql stable security definer set search_path = public as $$
  select case
    when a->>'nativo' = b->>'nativo' then 1.0
    when exists (select 1 from (select a->>'nativo' as l union select jsonb_array_elements_text(a->'sec')) x
                  where x.l in (select b->>'nativo' union select jsonb_array_elements_text(b->'sec'))) then ((tc_cfg('idiomas'))->>'sec_fracao')::double precision
    else 0.0 end;
$$;
revoke all on function public.tc_afinidade(jsonb, jsonb) from public, anon, authenticated;

-- Soma da afinidade de um titular com os outros titulares do mesmo time (0 a 4).
create or replace function public.tc_afinidade_titular(j tc_jogadores)
returns double precision language sql stable security definer set search_path = public as $$
  select coalesce(sum(tc_afinidade(tc_idiomas_do(j), tc_idiomas_do(o))), 0)
    from tc_jogadores o where j.org_id is not null and j.slot is not null and o.org_id = j.org_id and o.slot is not null and o.id <> j.id;
$$;
revoke all on function public.tc_afinidade_titular(tc_jogadores) from public, anon, authenticated;

-- Pontos de sinergia que a comunicação soma ao time (cada par de titulares conta uma vez).
create or replace function public.tc_sinergia_idiomas(oid bigint)
returns double precision language sql stable security definer set search_path = public as $$
  select coalesce(sum(tc_afinidade_titular(j)), 0) / 2 * ((tc_cfg('idiomas'))->>'sinergia_pontos')::double precision
    from tc_jogadores j where j.org_id = oid and j.slot is not null;
$$;
revoke all on function public.tc_sinergia_idiomas(bigint) from public, anon, authenticated;

-- Poder em campo: Poder individual na vaga, penalidade de posição, Estrelas e a eficiência da comunicação com os colegas (a forma não vale mais: peso 0).
create or replace function public.tc_poder_efetivo(j tc_jogadores, vaga text)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j, vaga);
begin
  if vaga <> j.pos and not (vaga = any (j.pos2)) then
    p := p * ((tc_cfg('fora_posicao'))::text)::double precision;
  end if;
  p := p + (j.forma - 50) * ((tc_cfg('forma'))->>'peso')::double precision;
  p := p * (1 + j.estrelas * ((tc_cfg('estrelas_jogador'))->>'bonus_pct')::double precision / 100);
  p := p * (1 + tc_afinidade_titular(j) * ((tc_cfg('idiomas'))->>'eficiencia_pct')::double precision / 100);
  return least(125, greatest(1, p));
end;
$$;
revoke all on function public.tc_poder_efetivo(tc_jogadores, text) from public, anon, authenticated;

create or replace function public.tc_poder_org(oid bigint)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  soma double precision := 0;
  v text;
  j tc_jogadores;
  sin double precision;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    select * into j from tc_jogadores where org_id = oid and slot = v;
    soma := soma + case when j.id is null then 1 else tc_poder_efetivo(j, v) end;
  end loop;
  select least(100, coalesce(sinergia, 0) + tc_sinergia_idiomas(oid)) into sin from tc_orgs where id = oid;
  return least(125, soma / 5 + coalesce(sin, 0) / 100.0 * ((tc_cfg('sinergia'))->>'max_bonus')::double precision);
end;
$$;
revoke all on function public.tc_poder_org(bigint) from public, anon, authenticated;

-- Para a tela: idiomas dos titulares, afinidade entre eles e o que a comunicação soma.
create or replace function public.tc_idiomas_info()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return null; end if;
  return jsonb_build_object(
    'sinergia_semanal', o.sinergia,
    'sinergia_idiomas', round(tc_sinergia_idiomas(o.id)::numeric, 1),
    'sinergia_total', round(least(100, o.sinergia + tc_sinergia_idiomas(o.id))::numeric, 1),
    'eficiencia_pct', ((tc_cfg('idiomas'))->>'eficiencia_pct')::numeric,
    'titulares', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'nome', j.nome, 'pos', j.slot, 'idioma', tc_idiomas_do(j),
                    'afinidade', round(tc_afinidade_titular(j)::numeric, 2)) order by array_position(array['top', 'selva', 'meio', 'atirador', 'suporte'], j.slot))
                  from tc_jogadores j where j.org_id = o.id and j.slot is not null), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_idiomas_info() from public, anon;
grant execute on function public.tc_idiomas_info() to authenticated;
