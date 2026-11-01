-- Simulador de Técnico: campanhas de marketing mais vantajosas. Rode depois do 0159. Idempotente.
--  * ANTES o bônus da campanha somava só à receita BASE do clube (poucas dezenas de créditos por minuto): +18% de ~25/min não pagava os 80.000 gastos.
--  * AGORA o bônus da campanha multiplica TODA a receita do período (clube, bônus comerciais e patrocinadores):
--      por minuto = (base x (1 + bônusMarketing + bônusAudiência) + patrocinadores) x (1 + bônusCampanha)
--  * Valores novos (custo / duração / recarga / bônus): redes sociais 2.500 / 6h / 12h / +40% · influenciadores 18.000 / 12h / 24h / +55%
--    nacional 60.000 / 24h / 48h / +50% · internacional 200.000 / 48h / 96h / +55%. O retorno cresce com os patrocinadores e o nível de marketing.

update public.tc_config set valor = jsonb_set(valor, '{campanhas}', $json$[
  {"id": "redes_sociais", "nome": "Campanha nas redes sociais", "custo": 2500, "duracao_h": 6, "recarga_h": 12, "bonus": 0.40, "req": {"fama": 0, "nivel": 1}, "efeito": "+40% da receita por 6h"},
  {"id": "influenciadores", "nome": "Campanha com influenciadores", "custo": 18000, "duracao_h": 12, "recarga_h": 24, "bonus": 0.55, "req": {"fama": 100, "nivel": 5}, "efeito": "+55% da receita por 12h"},
  {"id": "nacional", "nome": "Campanha nacional", "custo": 60000, "duracao_h": 24, "recarga_h": 48, "bonus": 0.50, "req": {"fama": 250, "nivel": 10}, "efeito": "+50% da receita por 24h"},
  {"id": "internacional", "nome": "Campanha internacional", "custo": 200000, "duracao_h": 48, "recarga_h": 96, "bonus": 0.55, "req": {"fama": 650, "nivel": 15}, "efeito": "+55% da receita por 48h"}
]$json$::jsonb) where chave = 'marketing';

-- Taxa por minuto mostrada na tela.
create or replace function public.tc_mkt_taxa(oid bigint, agora timestamptz, aud numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c jsonb := tc_mkt_cfg();
  m tc_marketing;
  div text;
  base_f numeric; base_d numeric; base numeric;
  bm numeric; ba numeric; ba_extra numeric; bc numeric;
  pat numeric;
begin
  select * into m from tc_marketing where org_id = oid;
  select divisao into div from tc_orgs where id = oid;
  base_f := (c->>'base_por_fama')::numeric * m.fama;
  base_d := case when div = 'principal' then (c->>'base_divisao_principal')::numeric else 0 end;
  base := (c->>'base_inicial')::numeric + base_f + base_d;
  bm := least((c->>'mkt_bonus_max')::numeric, (c->>'mkt_bonus_nivel')::numeric * (m.nivel - 1));
  select coalesce(sum(p.bonus_aud), 0), coalesce(sum(p.receita_min), 0) into ba_extra, pat from tc_patrocinios p where p.org_id = oid and p.inicio <= agora and p.fim > agora;
  ba := least((c->'aud'->>'cap')::numeric, (c->'aud'->>'coef')::numeric * aud) + ba_extra;
  bc := case when m.campanha is not null and m.campanha_inicio <= agora and m.campanha_fim > agora then m.campanha_bonus else 0 end;
  return jsonb_build_object('base', base, 'base_inicial', (c->>'base_inicial')::numeric, 'base_fama', round(base_f, 3), 'base_divisao', base_d,
    'bonus_marketing', bm, 'bonus_audiencia', ba, 'bonus_campanha', bc, 'patrocinadores', pat,
    'por_minuto', (base * (1 + bm + ba) + pat) * (1 + bc), 'audiencia', round(aud, 2));
end;
$$;
revoke all on function public.tc_mkt_taxa(bigint, timestamptz, numeric) from public, anon, authenticated;

-- Crédito da receita (online/offline), com a campanha multiplicando tudo.
create or replace function public.tc_marketing_processar(oid bigint, forcar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c jsonb := tc_mkt_cfg();
  m tc_marketing;
  agora timestamptz := now();
  t0 timestamptz; t1 timestamptz := now();
  decorrido numeric;
  aud_now numeric; aud_win numeric;
  div text;
  base numeric; bm numeric; ba_cap numeric;
  pontos timestamptz[];
  a timestamptz; b timestamptz; mid timestamptz;
  i int;
  dur numeric;
  pat numeric; extra numeric; camp numeric; ba numeric;
  r_clube numeric := 0; r_bonus numeric := 0; r_pat numeric := 0; seg numeric := 0;
  total numeric; inteiro bigint;
  res jsonb;
  s record;
  marca jsonb;
begin
  perform tc_marketing_garantir(oid);
  select * into m from tc_marketing where org_id = oid for update; -- trava: duas chamadas simultâneas não processam o mesmo trecho
  if m.org_id is null then return null; end if;
  decorrido := extract(epoch from (agora - m.ultimo_proc));
  if decorrido < 0 then decorrido := 0; end if;
  if decorrido < (c->>'proc_min_s')::numeric and not forcar then return null; end if;
  if decorrido < 1 then return null; end if;
  perform tc_fama_astros(oid);
  select * into m from tc_marketing where org_id = oid;
  t0 := greatest(m.ultimo_proc, agora - make_interval(hours => (c->>'offline_max_h')::int));
  aud_now := tc_mkt_audiencia(oid, m.nivel);
  aud_win := least(m.aud_snap, aud_now); -- sem ganho retroativo por contratar e sem render por quem já saiu
  select divisao into div from tc_orgs where id = oid;
  base := (c->>'base_inicial')::numeric + (c->>'base_por_fama')::numeric * m.fama + case when div = 'principal' then (c->>'base_divisao_principal')::numeric else 0 end;
  bm := least((c->>'mkt_bonus_max')::numeric, (c->>'mkt_bonus_nivel')::numeric * (m.nivel - 1));
  ba_cap := (c->'aud'->>'cap')::numeric;
  pontos := array[t0, t1];
  pontos := pontos || array(select p.fim from tc_patrocinios p where p.org_id = oid and p.fim > t0 and p.fim < t1)
                   || array(select p.inicio from tc_patrocinios p where p.org_id = oid and p.inicio > t0 and p.inicio < t1);
  if m.campanha_fim is not null and m.campanha_fim > t0 and m.campanha_fim < t1 then pontos := pontos || m.campanha_fim; end if;
  if m.campanha_inicio is not null and m.campanha_inicio > t0 and m.campanha_inicio < t1 then pontos := pontos || m.campanha_inicio; end if;
  pontos := array(select distinct x from unnest(pontos) x order by x);
  for i in 1..array_length(pontos, 1) - 1 loop
    a := pontos[i]; b := pontos[i + 1]; mid := a + (b - a) / 2;
    dur := extract(epoch from (b - a)) / 60.0;
    select coalesce(sum(p.receita_min), 0), coalesce(sum(p.bonus_aud), 0) into pat, extra from tc_patrocinios p where p.org_id = oid and p.inicio <= mid and p.fim > mid;
    camp := case when m.campanha is not null and m.campanha_inicio <= mid and m.campanha_fim > mid then m.campanha_bonus else 0 end;
    ba := least(ba_cap, (c->'aud'->>'coef')::numeric * aud_win) + extra;
    r_clube := r_clube + base * dur;
    r_bonus := r_bonus + (base * (bm + ba) + camp * (base * (1 + bm + ba) + pat)) * dur;
    r_pat := r_pat + pat * dur;
    seg := seg + dur;
  end loop;
  total := r_clube + r_bonus + r_pat + m.resto;
  inteiro := floor(total);
  res := jsonb_build_object('minutos', round(seg, 1), 'receita_clube', round(r_clube), 'bonus_comercial', round(r_bonus), 'patrocinadores', round(r_pat),
                            'total', inteiro, 'limitado', decorrido > (c->>'offline_max_h')::numeric * 3600, 'segundos_fora', round(decorrido));
  if inteiro > 0 then
    perform tc_creditos_mexer(oid, inteiro, 'mkt_receita', 'idle:' || round(seg)::text || 'min');
  end if;
  update tc_marketing set ultimo_proc = agora, resto = total - inteiro, aud_snap = aud_now,
         campanha = case when campanha_fim is not null and campanha_fim <= agora then null else campanha end,
         campanha_bonus = case when campanha_fim is not null and campanha_fim <= agora then 0 else campanha_bonus end,
         resumo = case when decorrido >= (c->>'resumo_min_s')::numeric and inteiro > 0 then
                  jsonb_build_object('minutos', round(coalesce((resumo->>'minutos')::numeric, 0) + seg, 1),
                    'receita_clube', coalesce((resumo->>'receita_clube')::numeric, 0) + round(r_clube),
                    'bonus_comercial', coalesce((resumo->>'bonus_comercial')::numeric, 0) + round(r_bonus),
                    'patrocinadores', coalesce((resumo->>'patrocinadores')::numeric, 0) + round(r_pat),
                    'total', coalesce((resumo->>'total')::numeric, 0) + inteiro, 'limitado', coalesce((resumo->>'limitado')::boolean, false) or decorrido > (c->>'offline_max_h')::numeric * 3600)
                  else resumo end
   where org_id = oid;
  -- renovação automática: só se ainda cumprir os requisitos e houver saldo; senão o contrato simplesmente expira
  for s in select * from tc_patrocinios p where p.org_id = oid and p.renovar_auto and not p.renovado and p.fim <= agora order by p.id loop
    update tc_patrocinios set renovado = true where id = s.id;
    begin
      perform tc_patrocinio_contratar_int(oid, s.marca, true, true);
    exception when others then
      perform tc_avisar(oid, 'A renovação automática do patrocínio ' || s.marca || ' não foi feita: ' || sqlerrm || '.');
    end;
  end loop;
  return res;
end;
$$;
revoke all on function public.tc_marketing_processar(bigint, boolean) from public, anon, authenticated;
