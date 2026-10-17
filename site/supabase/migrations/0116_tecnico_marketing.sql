-- Simulador de Técnico: Central de Marketing e Patrocínios (economia passiva/idle). Rode depois do 0115. Idempotente.
--
-- ARQUITETURA (reaproveita o que já existe):
--   * Saldo: tc_orgs.creditos, sempre mexido por tc_creditos_mexer (que grava o extrato em tc_fin). Não há segundo saldo.
--   * RC e Rank do site NÃO são tocados em nenhuma função deste arquivo.
--   * Tudo que vale (receita, custos, requisitos, fama) é calculado aqui no servidor; o navegador só pede ações e mostra o estado.
--   * Parâmetros de balanceamento: tc_config.marketing (um único JSON, veja os comentários abaixo).
--
-- RECEITA (por minuto):   receita = base × (1 + bônusMarketing + bônusAudiência + bônusCampanha) + patrocinadores
--   base            = base_inicial + base_por_fama × fama do clube (+ base_divisao_principal na divisão principal)
--   bônusMarketing  = min(mkt_bonus_max, mkt_bonus_nivel × (nível − 1))                      [aditivo, sobre a base]
--   bônusAudiência  = min(aud.cap, aud.coef × audiência)                                    [aditivo, sobre a base]
--     audiência     = Σ titulares 10×√fama + Σ 5 melhores reservas 10×√fama × peso_reserva, × (1 + fator_nivel × (nível − 1))
--                     (a raiz comprime as fámas altas: um astro vale ~2x um jogador comum, não 4x; cada jogador conta uma vez)
--   bônusCampanha   = bônus da campanha ativa                                                [aditivo, sobre a base]
--   patrocinadores  = soma da receita fixa dos contratos ativos (NÃO é multiplicada por nada: evita inflação)
-- OFFLINE: ao processar, conta no máximo offline_max_h horas (8) desde o último processamento, usando o relógio do servidor.
--   A janela é cortada nos instantes reais de fim de contrato/campanha. A audiência usada é o MENOR valor entre o último
--   processamento e o atual: vender um astro tira a contribuição dele e comprar um não rende retroativamente.
--   O instante do último processamento sempre avança até agora: o excedente além de 8h é perdido, e nunca se conta o mesmo trecho 2x.

insert into public.tc_config (chave, valor) values ('marketing', $json$
{
  "base_inicial": 10, "base_por_fama": 0.03, "base_divisao_principal": 6,
  "mkt_bonus_nivel": 0.04, "mkt_bonus_max": 0.8,
  "aud": {"coef": 0.0006, "cap": 0.45, "peso_reserva": 0.25, "reservas_max": 5, "fator_nivel": 0.01},
  "offline_max_h": 8, "proc_min_s": 300, "resumo_min_s": 900,
  "nivel_custo": {"base": 6000, "mult": 1.33, "max": 20, "fama_por_nivel": 5},
  "limites": [{"nivel": 1, "max": 1}, {"nivel": 3, "max": 2}, {"nivel": 6, "max": 3}, {"nivel": 10, "max": 4}, {"nivel": 15, "max": 5}, {"nivel": 20, "max": 6}],
  "niveis_nomes": {"1": "Divulgação básica", "2": "Redes sociais organizadas", "3": "Produção regular de conteúdo", "4": "Parcerias locais", "5": "Campanhas com influenciadores",
    "6": "Assessoria de imprensa", "7": "Equipe comercial profissional", "8": "Loja oficial do clube", "9": "Transmissões próprias", "10": "Campanhas nacionais",
    "11": "Embaixadores da marca", "12": "Estúdio próprio de conteúdo", "13": "Programa de sócios-torcedores", "14": "Licenciamento de produtos", "15": "Marketing internacional",
    "16": "Escritório comercial no exterior", "17": "Documentários e eventos", "18": "Grandes campanhas publicitárias", "19": "Parcerias globais", "20": "Estrutura comercial de elite"},
  "fama_niveis": [{"min": 0, "nome": "Clube desconhecido", "beneficio": "Patrocinadores locais"}, {"min": 100, "nome": "Clube regional", "beneficio": "Patrocinadores regionais"},
    {"min": 250, "nome": "Clube reconhecido", "beneficio": "Patrocinadores nacionais e campanha nacional"}, {"min": 450, "nome": "Organização nacional", "beneficio": "Patrocinadores internacionais"},
    {"min": 650, "nome": "Organização internacional", "beneficio": "Patrocinadores premium e campanha internacional"}, {"min": 850, "nome": "Marca lendária", "beneficio": "Todas as parcerias"}],
  "fama_eventos": {
    "vitoria": {"pontos": 2, "cap": 250}, "promocao": {"pontos": 25, "cap": 100},
    "liga": {"principal": [20, 12, 8, 4], "acesso": [10, 6, 4, 2], "cap": 200},
    "internacional": {"participacao": 12, "final": 30, "titulo": 60, "cap": 300},
    "marketing": {"cap": 120}, "astro": {"fama_min": 70, "pontos": 4, "cap": 80}, "patrocinio": {"cap": 60}
  },
  "patrocinadores": [
    {"id": "nexus_energy", "nome": "Nexus Energy", "ramo": "Bebidas energéticas", "categoria": "local", "receita_min": 5, "duracao_h": 72, "custo": 3000, "req": {"fama": 0, "nivel": 1}},
    {"id": "pizzaria_barao", "nome": "Pizzaria do Barão", "ramo": "Alimentação", "categoria": "local", "receita_min": 6, "duracao_h": 72, "custo": 4000, "req": {"fama": 20, "nivel": 1}},
    {"id": "rift_cafe", "nome": "Rift Café", "ramo": "Cafeteria gamer", "categoria": "local", "receita_min": 4, "duracao_h": 48, "custo": 1800, "req": {"fama": 0, "nivel": 1}},
    {"id": "hextech_systems", "nome": "Hextech Systems", "ramo": "Periféricos e tecnologia", "categoria": "regional", "receita_min": 12, "duracao_h": 120, "custo": 9000, "req": {"fama": 100, "nivel": 3}},
    {"id": "riftwear", "nome": "RiftWear", "ramo": "Roupas e uniformes", "categoria": "regional", "receita_min": 14, "duracao_h": 120, "custo": 11000, "req": {"fama": 120, "nivel": 3}, "bonus_fama": 6},
    {"id": "dragao_dourado", "nome": "Dragão Dourado", "ramo": "Equipamentos gamer", "categoria": "regional", "receita_min": 11, "duracao_h": 96, "custo": 8000, "req": {"fama": 100, "nivel": 3}, "bonus_aud": 0.02},
    {"id": "aurora_telecom", "nome": "Aurora Telecom", "ramo": "Telecomunicações", "categoria": "nacional", "receita_min": 30, "duracao_h": 168, "custo": 32000, "req": {"fama": 250, "nivel": 6, "divisao": "principal"}},
    {"id": "barao_prime", "nome": "Barão Prime", "ramo": "Serviços digitais", "categoria": "nacional", "receita_min": 34, "duracao_h": 168, "custo": 38000, "req": {"fama": 280, "nivel": 6, "divisao": "principal"}, "bonus_fama": 10},
    {"id": "runeterra_media", "nome": "Runeterra Media", "ramo": "Mídia e entretenimento", "categoria": "nacional", "receita_min": 28, "duracao_h": 144, "custo": 28000, "req": {"fama": 250, "nivel": 6}, "bonus_aud": 0.03},
    {"id": "zaun_motors", "nome": "Zaun Motors", "ramo": "Veículos elétricos", "categoria": "internacional", "receita_min": 70, "duracao_h": 240, "custo": 95000, "req": {"fama": 450, "nivel": 10, "divisao": "principal"}},
    {"id": "noxus_bank", "nome": "Noxus Bank", "ramo": "Serviços financeiros", "categoria": "internacional", "receita_min": 78, "duracao_h": 240, "custo": 110000, "req": {"fama": 480, "nivel": 10, "divisao": "principal"}, "bonus_fama": 15},
    {"id": "piltover_labs", "nome": "Piltover Labs", "ramo": "Tecnologia avançada", "categoria": "internacional", "receita_min": 66, "duracao_h": 216, "custo": 88000, "req": {"fama": 450, "nivel": 10}, "bonus_aud": 0.04},
    {"id": "arcane_global", "nome": "Arcane Global", "ramo": "Streaming mundial", "categoria": "premium", "receita_min": 150, "duracao_h": 336, "custo": 260000, "req": {"fama": 650, "nivel": 15, "divisao": "principal", "titulares": 5}},
    {"id": "celestial_air", "nome": "Celestial Air", "ramo": "Aviação", "categoria": "premium", "receita_min": 165, "duracao_h": 336, "custo": 300000, "req": {"fama": 700, "nivel": 15, "divisao": "principal", "titulares": 5}, "bonus_fama": 25, "bonus_aud": 0.05}
  ],
  "campanhas": [
    {"id": "redes_sociais", "nome": "Campanha nas redes sociais", "custo": 4000, "duracao_h": 6, "recarga_h": 12, "bonus": 0.05, "req": {"fama": 0, "nivel": 1}, "efeito": "+5% de audiência por 6h"},
    {"id": "influenciadores", "nome": "Campanha com influenciadores", "custo": 20000, "duracao_h": 12, "recarga_h": 24, "bonus": 0.10, "req": {"fama": 100, "nivel": 5}, "efeito": "+10% de audiência por 12h"},
    {"id": "nacional", "nome": "Campanha nacional", "custo": 80000, "duracao_h": 24, "recarga_h": 48, "bonus": 0.18, "req": {"fama": 250, "nivel": 10}, "efeito": "+18% de audiência por 24h"},
    {"id": "internacional", "nome": "Campanha internacional", "custo": 250000, "duracao_h": 48, "recarga_h": 96, "bonus": 0.30, "req": {"fama": 650, "nivel": 15}, "efeito": "+30% de audiência por 48h"}
  ]
}
$json$::jsonb) on conflict (chave) do nothing;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.tc_marketing (
  org_id bigint primary key references public.tc_orgs(id) on delete cascade,
  nivel int not null default 1 check (nivel between 1 and 20),
  fama numeric not null default 0 check (fama between 0 and 1000),
  ultimo_proc timestamptz not null default now(),
  resto numeric not null default 0,
  aud_snap numeric not null default 0,
  campanha text, campanha_inicio timestamptz, campanha_fim timestamptz, campanha_bonus numeric not null default 0,
  recargas jsonb not null default '{}'::jsonb,
  resumo jsonb,
  criado timestamptz not null default now()
);
create table if not exists public.tc_patrocinios (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  marca text not null,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  receita_min numeric not null check (receita_min >= 0),
  bonus_aud numeric not null default 0,
  custo bigint not null,
  renovar_auto boolean not null default false,
  renovado boolean not null default false,
  criado timestamptz not null default now()
);
create index if not exists tc_patrocinios_org on public.tc_patrocinios (org_id, fim);
create table if not exists public.tc_fama_eventos (
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  chave text not null,
  categoria text not null,
  pontos numeric not null,
  criado timestamptz not null default now(),
  primary key (org_id, chave)
);
alter table public.tc_marketing enable row level security;
alter table public.tc_patrocinios enable row level security;
alter table public.tc_fama_eventos enable row level security;
revoke all on public.tc_marketing, public.tc_patrocinios, public.tc_fama_eventos from anon, authenticated;
revoke all on sequence public.tc_patrocinios_id_seq from anon, authenticated;

create or replace function public.tc_mkt_cfg()
returns jsonb language sql stable security definer set search_path = public as $$ select tc_cfg('marketing'); $$;
revoke all on function public.tc_mkt_cfg() from public, anon, authenticated;

create or replace function public.tc_marketing_garantir(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from tc_orgs where id = oid and user_id is not null) then
    insert into tc_marketing (org_id, aud_snap) values (oid, tc_mkt_audiencia(oid, 1)) on conflict (org_id) do nothing;
  end if;
end;
$$;
revoke all on function public.tc_marketing_garantir(bigint) from public, anon, authenticated;

-- Audiência do elenco: cada jogador conta uma vez (titulares inteiros, as melhores reservas com peso menor). Fama comprimida por raiz.
create or replace function public.tc_mkt_audiencia(oid bigint, nivel int)
returns numeric language sql stable security definer set search_path = public as $$
  with cfg as (select tc_mkt_cfg()->'aud' a),
  p as (select j.id, j.slot, j.fama from tc_jogadores j where j.org_id = oid and not exists (select 1 from tc_ofertas f where f.jogador_id = j.id)),
  r as (select p.*, row_number() over (partition by (p.slot is not null) order by p.fama desc, p.id) rn from p)
  select coalesce(sum(10 * sqrt(r.fama) * case when r.slot is not null then 1 else (select (a->>'peso_reserva')::numeric from cfg) end), 0)
         * (1 + (select (a->>'fator_nivel')::numeric from cfg) * (greatest(nivel, 1) - 1))
    from r where r.slot is not null or r.rn <= (select (a->>'reservas_max')::int from cfg);
$$;
revoke all on function public.tc_mkt_audiencia(bigint, int) from public, anon, authenticated;

-- ---------------------------------------------------------------- fama do clube
create or replace function public.tc_fama_evento(oid bigint, chave_ text, categoria_ text, pontos_ numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  cap numeric;
  usado numeric;
  dar numeric;
  atual numeric;
begin
  if pontos_ is null or pontos_ <= 0 or not exists (select 1 from tc_orgs where id = oid and user_id is not null) then return 0; end if;
  perform tc_marketing_garantir(oid);
  select fama into atual from tc_marketing where org_id = oid for update;
  cap := coalesce((tc_mkt_cfg()->'fama_eventos'->categoria_->>'cap')::numeric, 1000);
  select coalesce(sum(pontos), 0) into usado from tc_fama_eventos where org_id = oid and categoria = categoria_;
  dar := least(pontos_, greatest(0, cap - usado), 1000 - atual);
  insert into tc_fama_eventos (org_id, chave, categoria, pontos) values (oid, chave_, categoria_, greatest(dar, 0)) on conflict do nothing;
  if not found or dar <= 0 then return 0; end if; -- evento já contado (ou teto da categoria): não repete
  update tc_marketing set fama = fama + dar where org_id = oid;
  return dar;
end;
$$;
revoke all on function public.tc_fama_evento(bigint, text, text, numeric) from public, anon, authenticated;

create or replace function public.tc_fama_nivel(f numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', n.nome, 'min', n.min, 'beneficio', n.beneficio,
           'proximo_min', (select min((x->>'min')::int) from jsonb_array_elements(tc_mkt_cfg()->'fama_niveis') x where (x->>'min')::int > f),
           'proximo_nome', (select x->>'nome' from jsonb_array_elements(tc_mkt_cfg()->'fama_niveis') x where (x->>'min')::int > f order by (x->>'min')::int limit 1))
    from (select x->>'nome' nome, (x->>'min')::int min, x->>'beneficio' beneficio from jsonb_array_elements(tc_mkt_cfg()->'fama_niveis') x
           where (x->>'min')::int <= f order by (x->>'min')::int desc limit 1) n;
$$;
revoke all on function public.tc_fama_nivel(numeric) from public, anon, authenticated;

-- Jogadores famosos no elenco rendem fama ao clube uma única vez por jogador (teto da categoria evita farm por troca de contas).
create or replace function public.tc_fama_astros(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  j record;
  c jsonb := tc_mkt_cfg()->'fama_eventos'->'astro';
begin
  for j in select id from tc_jogadores where org_id = oid and fama >= (c->>'fama_min')::int and not exists (select 1 from tc_ofertas f where f.jogador_id = tc_jogadores.id) loop
    perform tc_fama_evento(oid, 'astro:' || j.id::text, 'astro', (c->>'pontos')::numeric);
  end loop;
end;
$$;
revoke all on function public.tc_fama_astros(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- taxa de receita (por minuto)
create or replace function public.tc_mkt_limite(nivel int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max((x->>'max')::int), 1) from jsonb_array_elements(tc_mkt_cfg()->'limites') x where (x->>'nivel')::int <= nivel;
$$;
revoke all on function public.tc_mkt_limite(int) from public, anon, authenticated;

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
    'por_minuto', base * (1 + bm + ba + bc) + pat, 'audiencia', round(aud, 2));
end;
$$;
revoke all on function public.tc_mkt_taxa(bigint, timestamptz, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------- processamento (online e offline)
-- Credita a receita do trecho [último processamento, agora], limitado a offline_max_h, segmentado nos fins reais de contrato e campanha.
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
    r_bonus := r_bonus + base * (bm + ba + camp) * dur;
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

-- ---------------------------------------------------------------- patrocínios
create or replace function public.tc_mkt_marca(id_ text)
returns jsonb language sql stable security definer set search_path = public as $$
  select x from jsonb_array_elements(tc_mkt_cfg()->'patrocinadores') x where x->>'id' = id_ limit 1;
$$;
revoke all on function public.tc_mkt_marca(text) from public, anon, authenticated;

-- Por que a marca não está disponível (null = disponível).
create or replace function public.tc_mkt_requisito(oid bigint, marca jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  m tc_marketing;
  req jsonb := marca->'req';
  div text;
begin
  select * into m from tc_marketing where org_id = oid;
  select divisao into div from tc_orgs where id = oid;
  if m.fama < coalesce((req->>'fama')::numeric, 0) then return 'Fama do clube mínima: ' || (req->>'fama'); end if;
  if m.nivel < coalesce((req->>'nivel')::int, 1) then return 'Nível de marketing mínimo: ' || (req->>'nivel'); end if;
  if req ? 'divisao' and div is distinct from (req->>'divisao') then return 'Exige a divisão principal'; end if;
  if req ? 'titulares' and (select count(*) from tc_jogadores where org_id = oid and slot is not null) < (req->>'titulares')::int then return 'Exige ' || (req->>'titulares') || ' titulares escalados'; end if;
  return null;
end;
$$;
revoke all on function public.tc_mkt_requisito(bigint, jsonb) from public, anon, authenticated;

create or replace function public.tc_patrocinio_contratar_int(oid bigint, marca_ text, auto_ boolean, renovando boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m tc_marketing;
  marca jsonb := tc_mkt_marca(marca_);
  o tc_orgs;
  motivo text;
  custo bigint;
  novo tc_patrocinios;
begin
  if marca is null then raise exception 'patrocinador_invalido'; end if;
  select * into o from tc_orgs where id = oid for update;
  select * into m from tc_marketing where org_id = oid;
  if exists (select 1 from tc_patrocinios p where p.org_id = oid and p.marca = marca_ and p.fim > now()) then raise exception 'patrocinio_ja_ativo'; end if;
  if (select count(*) from tc_patrocinios p where p.org_id = oid and p.fim > now()) >= tc_mkt_limite(m.nivel) then raise exception 'limite_patrocinios'; end if;
  motivo := tc_mkt_requisito(oid, marca);
  if motivo is not null then raise exception 'requisito_nao_cumprido'; end if;
  custo := (marca->>'custo')::bigint;
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(oid, -custo, case when renovando then 'mkt_renovacao' else 'mkt_contrato' end, marca->>'nome');
  insert into tc_patrocinios (org_id, marca, inicio, fim, receita_min, bonus_aud, custo, renovar_auto)
  values (oid, marca_, now(), now() + make_interval(hours => (marca->>'duracao_h')::int), (marca->>'receita_min')::numeric, coalesce((marca->>'bonus_aud')::numeric, 0), custo, auto_)
  returning * into novo;
  if marca ? 'bonus_fama' then perform tc_fama_evento(oid, 'patro:' || marca_ || ':' || (case when renovando then 'r' else '' end) || novo.id::text, 'patrocinio', (marca->>'bonus_fama')::numeric); end if;
  return jsonb_build_object('ok', true, 'id', novo.id, 'fim', novo.fim, 'custo', custo);
end;
$$;
revoke all on function public.tc_patrocinio_contratar_int(bigint, text, boolean, boolean) from public, anon, authenticated;

create or replace function public.tc_patrocinio_contratar(marca text, renovar_auto boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  perform tc_marketing_processar(o.id, true); -- fecha o trecho com as regras antigas antes de mudar o contrato
  return tc_patrocinio_contratar_int(o.id, marca, coalesce(renovar_auto, false), false);
end;
$$;
revoke all on function public.tc_patrocinio_contratar(text, boolean) from public, anon;
grant execute on function public.tc_patrocinio_contratar(text, boolean) to authenticated;

create or replace function public.tc_patrocinio_auto(contrato bigint, ligado boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  update tc_patrocinios set renovar_auto = coalesce(ligado, false) where id = contrato and org_id = o.id;
  if not found then raise exception 'contrato_inexistente'; end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.tc_patrocinio_auto(bigint, boolean) from public, anon;
grant execute on function public.tc_patrocinio_auto(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------- nível de marketing e campanhas
create or replace function public.tc_mkt_custo_nivel(nivel_atual int)
returns bigint language sql stable security definer set search_path = public as $$
  select round((tc_mkt_cfg()->'nivel_custo'->>'base')::numeric * power((tc_mkt_cfg()->'nivel_custo'->>'mult')::numeric, nivel_atual - 1))::bigint;
$$;
revoke all on function public.tc_mkt_custo_nivel(int) from public, anon, authenticated;

create or replace function public.tc_marketing_melhorar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  m tc_marketing;
  c jsonb := tc_mkt_cfg()->'nivel_custo';
  custo bigint;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  perform tc_marketing_processar(o.id, true);
  select * into m from tc_marketing where org_id = o.id for update;
  if m.nivel >= (c->>'max')::int then raise exception 'marketing_no_maximo'; end if;
  custo := tc_mkt_custo_nivel(m.nivel);
  select * into o from tc_orgs where id = o.id;
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(o.id, -custo, 'mkt_melhoria', 'nivel ' || (m.nivel + 1)::text);
  update tc_marketing set nivel = nivel + 1 where org_id = o.id;
  perform tc_fama_evento(o.id, 'mkt_nivel:' || (m.nivel + 1)::text, 'marketing', (c->>'fama_por_nivel')::numeric);
  return jsonb_build_object('ok', true, 'nivel', m.nivel + 1, 'custo', custo);
end;
$$;
revoke all on function public.tc_marketing_melhorar() from public, anon;
grant execute on function public.tc_marketing_melhorar() to authenticated;

create or replace function public.tc_campanha_iniciar(campanha_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  m tc_marketing;
  camp jsonb;
  fim timestamptz;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select x into camp from jsonb_array_elements(tc_mkt_cfg()->'campanhas') x where x->>'id' = campanha_ limit 1;
  if camp is null then raise exception 'campanha_invalida'; end if;
  perform tc_marketing_processar(o.id, true);
  select * into m from tc_marketing where org_id = o.id for update;
  if m.campanha is not null and m.campanha_fim > now() then raise exception 'campanha_ativa'; end if; -- uma por vez, sem reiniciar para prolongar
  if coalesce((m.recargas->>campanha_)::timestamptz, '-infinity') > now() then raise exception 'campanha_em_recarga'; end if;
  if m.fama < coalesce((camp->'req'->>'fama')::numeric, 0) or m.nivel < coalesce((camp->'req'->>'nivel')::int, 1) then raise exception 'requisito_nao_cumprido'; end if;
  select * into o from tc_orgs where id = o.id;
  if o.creditos < (camp->>'custo')::bigint then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(o.id, -(camp->>'custo')::bigint, 'mkt_campanha', camp->>'nome');
  fim := now() + make_interval(hours => (camp->>'duracao_h')::int);
  update tc_marketing set campanha = campanha_, campanha_inicio = now(), campanha_fim = fim, campanha_bonus = (camp->>'bonus')::numeric,
         recargas = recargas || jsonb_build_object(campanha_, fim + make_interval(hours => (camp->>'recarga_h')::int))
   where org_id = o.id;
  return jsonb_build_object('ok', true, 'fim', fim);
end;
$$;
revoke all on function public.tc_campanha_iniciar(text) from public, anon;
grant execute on function public.tc_campanha_iniciar(text) to authenticated;

create or replace function public.tc_marketing_resumo_visto()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  perform tc_exigir(uid);
  update tc_marketing set resumo = null where org_id = (select id from tc_orgs where user_id = uid); -- só some da tela: nenhum crédito é dado aqui
end;
$$;
revoke all on function public.tc_marketing_resumo_visto() from public, anon;
grant execute on function public.tc_marketing_resumo_visto() to authenticated;

-- ---------------------------------------------------------------- estado para a tela
create or replace function public.tc_marketing_estado()
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
  perform tc_marketing_processar(o.id, false);
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
revoke all on function public.tc_marketing_estado() from public, anon;
grant execute on function public.tc_marketing_estado() to authenticated;

create or replace function public.tc_marketing_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'ref', f.ref, 'criado', f.criado) order by f.id desc)
                     from (select * from tc_fin where org_id = o.id order by id desc limit 80) f), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_marketing_historico() from public, anon;
grant execute on function public.tc_marketing_historico() to authenticated;

-- Contas que já existem entram com os valores iniciais (sem receita retroativa).
insert into public.tc_marketing (org_id, aud_snap) select id, tc_mkt_audiencia(id, 1) from public.tc_orgs where user_id is not null on conflict (org_id) do nothing;

-- ---------------------------------------------------------------- fama por resultados oficiais (idempotente por partida/liga)
create or replace function public.tc_fama_vitoria(oid bigint, pid bigint)
returns void language sql security definer set search_path = public as $$
  select tc_fama_evento(oid, 'vit:' || pid::text, 'vitoria', ((tc_mkt_cfg())->'fama_eventos'->'vitoria'->>'pontos')::numeric);
$$;
revoke all on function public.tc_fama_vitoria(bigint, bigint) from public, anon, authenticated;

create or replace function public.tc_gameplay_registrar(pid bigint, mapa_ int, resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb;
  azul bigint; verm bigint; venc bigint; perd bigint;
  v_a int; v_b int; nec int;
  dur int;
  res jsonb;
  pa double precision; pb double precision;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  prox := tc_gameplay_proximo(pid);
  if mapa_ <> (prox->>'mapa')::int then raise exception 'mapa_fora_de_ordem'; end if;
  if (resultado->>'semente')::bigint is distinct from tc_gameplay_semente(pid, mapa_) then raise exception 'semente_invalida'; end if;
  if (resultado->>'versaoRegras')::int is distinct from (cfg->>'versao')::int then raise exception 'versao_invalida'; end if;
  if coalesce(resultado->>'vencedor', '') not in ('azul', 'vermelho') or coalesce((resultado->>'interrompida')::boolean, false) then raise exception 'resultado_invalido'; end if;
  dur := (resultado->>'duracao')::int;
  if dur is null or dur < 300 or dur > 7200 then raise exception 'duracao_invalida'; end if;
  azul := (prox->>'azul')::bigint;
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  venc := case when resultado->>'vencedor' = 'azul' then azul else verm end;
  insert into tc_gameplay_mapas (partida_id, mapa, org_azul, vencedor_org, semente, duracao, resumo, registrado_por)
  values (pid, mapa_, azul, venc, (resultado->>'semente')::bigint, dur, jsonb_build_object(
            'vencedor', resultado->>'vencedor', 'equipes', resultado->'equipes', 'mvp', resultado->'mvp', 'jogadores', resultado->'jogadores', 'motivo', resultado->>'motivo'), uid);
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b) into v_a, v_b from tc_gameplay_mapas where partida_id = pid;
  nec := (p.formato + 1) / 2;
  if v_a < nec and v_b < nec then
    return jsonb_build_object('concluida', false, 'placar_a', v_a, 'placar_b', v_b, 'proximo', tc_gameplay_proximo(pid));
  end if;
  -- fechou a série: mesmo fechamento da simulação do sistema
  perd := case when v_a >= nec then p.org_b else p.org_a end;
  venc := case when v_a >= nec then p.org_a else p.org_b end;
  pa := tc_poder_org(p.org_a); pb := tc_poder_org(p.org_b);
  res := jsonb_build_object('a', v_a, 'b', v_b, 'origem', 'gameplay', 'mapas', (
    select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'duracao', round(g.duracao / 60.0)::int, 'gameplay', true,
             'vencedor', case when g.vencedor_org = p.org_a then 'a' else 'b' end,
             'abates', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'abates', g.resumo->'equipes'->'vermelho'->'abates')
                            else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'abates', g.resumo->'equipes'->'azul'->'abates') end,
             'torres', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'vermelho'->'torresPerdidas', g.resumo->'equipes'->'azul'->'torresPerdidas')
                            else jsonb_build_array(g.resumo->'equipes'->'azul'->'torresPerdidas', g.resumo->'equipes'->'vermelho'->'torresPerdidas') end,
             'dragoes', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'dragoes', g.resumo->'equipes'->'vermelho'->'dragoes')
                             else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'dragoes', g.resumo->'equipes'->'azul'->'dragoes') end,
             'mvp', coalesce(g.resumo->'mvp'->>'nome', '')) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid));
  update tc_partidas set status = 'concluida', placar_a = v_a, placar_b = v_b, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = res, processada = now()
   where id = pid;
  update tc_jogadores set forma = least(75, forma + 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) where org_id = perd and slot is not null;
  perform tc_fama_vitoria(venc, pid);
  return jsonb_build_object('concluida', true, 'placar_a', v_a, 'placar_b', v_b, 'vencedor', venc);
end;
$$;
revoke all on function public.tc_gameplay_registrar(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_registrar(bigint, int, jsonb) to authenticated;

create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  -- gameplay ligado: o técnico joga a partida no navegador; o sistema só simula depois do prazo
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null)
     and site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
    return false;
  end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  pa := tc_poder_org(p.org_a);
  pb := tc_poder_org(p.org_b);
  r := tc_simular(p.org_a, p.org_b, p.formato, 'p' || p.id::text || ':' || p.liga_id::text);
  venc := case when (r->>'a')::int > (r->>'b')::int then p.org_a else p.org_b end;
  perd := case when venc = p.org_a then p.org_b else p.org_a end;
  update tc_partidas set status = 'concluida', placar_a = (r->>'a')::int, placar_b = (r->>'b')::int, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = r, processada = now()
   where id = p.id;
  update tc_jogadores set forma = least(75, forma + 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) where org_id = perd and slot is not null;
  perform tc_fama_vitoria(venc, p.id);
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

create or replace function public.tc_encerrar_liga(lid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  t record;
  prem bigint[];
  cred bigint;
  pdr int;
  d date := site_hoje_br();
begin
  select * into l from tc_ligas where id = lid for update;
  if l.status = 'encerrada' then return; end if;
  prem := array(select (jsonb_array_elements_text((tc_cfg('premios'))->l.divisao))::bigint);
  for t in select * from tc_tabela(lid) loop
    cred := coalesce(prem[t.pos], 0);
    if cred > 0 then
      perform tc_creditos_mexer(t.org_id, cred, 'premiacao', lid::text);
    end if;
    pdr := tc_rank_liga(t.org_id, lid, t.pos, t.vitorias, d);
    perform tc_fama_evento(t.org_id, 'liga:' || lid::text, 'liga', coalesce(((tc_mkt_cfg())->'fama_eventos'->'liga'->l.divisao->>(t.pos - 1))::numeric, 0));
    insert into tc_premios (liga_id, org_id, posicao, creditos, rank_base, rank_pdr)
    values (lid, t.org_id, t.pos, cred, null, pdr) on conflict do nothing;
    if t.pos = 1 then
      insert into tc_trofeus (org_id, liga_id, titulo, temporada)
      values (t.org_id, lid, 'Campeão · ' || l.nome, l.temporada) on conflict do nothing;
    end if;
    if cred > 0 then
      perform tc_avisar(t.org_id, 'Liga encerrada: você ficou em ' || t.pos::text || 'º e recebeu ' || cred::text || ' créditos.');
    end if;
  end loop;
  update tc_ligas set status = 'encerrada', encerrada_em = now() where id = lid;
end;
$$;
revoke all on function public.tc_encerrar_liga(bigint) from public, anon, authenticated;

create or replace function public.tc_aplicar_promocoes(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  la bigint;
  lp bigint;
  sobem bigint[];
  descem bigint[];
begin
  select id into la from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = 'acesso';
  select id into lp from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = 'principal';
  if la is null or lp is null then return; end if;
  select array_agg(org_id order by pos) into sobem from tc_tabela(la) where pos <= 2;
  select array_agg(org_id order by pos desc) into descem from (select * from tc_tabela(lp) order by pos desc limit 2) x;
  update tc_orgs set divisao = 'principal' where id = any (sobem);
  perform tc_fama_evento(o, 'promo:' || temp::text || ':' || sem::text, 'promocao', ((tc_mkt_cfg())->'fama_eventos'->'promocao'->>'pontos')::numeric) from unnest(sobem) o;
  update tc_orgs set divisao = 'acesso' where id = any (descem);
  perform tc_avisar(o, 'Promovido para a ' || ((tc_cfg('nomes'))->>'principal') || '!') from unnest(sobem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
  perform tc_avisar(o, 'Rebaixado para a ' || ((tc_cfg('nomes'))->>'acesso') || '.') from unnest(descem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
end;
$$;
revoke all on function public.tc_aplicar_promocoes(int, int) from public, anon, authenticated;

create or replace function public.tc_encerrar_internacional(lid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  fin tc_partidas;
  r record;
  chave text;
  pos_ int;
  cred bigint;
  base int;
  uid uuid;
  pdr int;
  d date := site_hoje_br();
begin
  select * into l from tc_ligas where id = lid for update;
  if l.id is null or l.status = 'encerrada' then return; end if;
  select * into fin from tc_partidas where liga_id = lid and fase = 'final' and status = 'concluida';
  if fin.id is null then return; end if;
  for r in select t.org_id,
                  case when t.org_id = fin.vencedor then 1
                       when t.org_id in (fin.org_a, fin.org_b) then 2
                       when exists (select 1 from tc_partidas p where p.liga_id = lid and p.fase = 'semi' and (p.org_a = t.org_id or p.org_b = t.org_id)) then 3
                       else 5 end as pos
             from tc_liga_times t where t.liga_id = lid loop
    chave := r.pos::text;
    cred := coalesce(((tc_cfg('premios_intl'))->l.tipo->>chave)::bigint, 0);
    if cred > 0 then perform tc_creditos_mexer(r.org_id, cred, 'premiacao', lid::text); end if;
    pdr := null;
    base := ((tc_cfg('rank_intl'))->l.tipo->>chave)::int;
    select user_id into uid from tc_orgs where id = r.org_id;
    if uid is not null and base is not null and coalesce((tc_cfg('rank_ativo'))::text::boolean, false) then
      pdr := site_rk_ajustar(base, site_rk_nivel_de(uid));
      perform site_rk_lancar(uid, d, 'tecnico', 'partida', pdr);
    end if;
    insert into tc_premios (liga_id, org_id, posicao, creditos, rank_base, rank_pdr) values (lid, r.org_id, r.pos, cred, base, pdr) on conflict do nothing;
    perform tc_fama_evento(r.org_id, 'intl:' || lid::text, 'internacional', case r.pos when 1 then ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'titulo')::numeric when 2 then ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'final')::numeric else ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'participacao')::numeric end);
    if r.pos = 1 then
      insert into tc_trofeus (org_id, liga_id, titulo, temporada) values (r.org_id, lid, 'Campeão · ' || l.nome, l.temporada) on conflict do nothing;
    end if;
    if cred > 0 then
      perform tc_avisar(r.org_id, l.nome || ': ' || r.pos::text || 'º lugar, ' || cred::text || ' créditos.');
    end if;
  end loop;
  update tc_ligas set status = 'encerrada', encerrada_em = now() where id = lid;
end;
$$;
revoke all on function public.tc_encerrar_internacional(bigint) from public, anon, authenticated;
