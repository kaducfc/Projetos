-- =====================================================================
-- Simulador de Técnico de esports (nome provisório; id do jogo: 'tecnico')
-- Parte 1: configuração, jogadores, organizações, poder, mercado oficial e contratos.
--
-- Tudo é decidido aqui no servidor. O navegador só chama funções (RPC) e nunca escreve
-- nas tabelas. Enquanto tc_config.aberto = false, só administradores usam as funções.
--
-- Escala de moedas:
--   * créditos de equipe (tc_orgs.creditos): moeda interna do jogo, não vira RC nem vai para outros jogos;
--   * RC: a carteira oficial do site (site_carteira), só mexida por site_moedas_mexer (parte 2).
--
-- Como aplicar: cole no SQL Editor do Supabase e clique em Run (depois do 0084).
-- Depois rode o 0086 (mercado entre usuários) e o 0087 (campeonatos). Rodar de novo é seguro.
-- =====================================================================

-- ---------------------------------------------------------------- configuração
create table if not exists public.tc_config (
  chave text primary key,
  valor jsonb not null
);
alter table public.tc_config enable row level security;
revoke all on public.tc_config from anon, authenticated;

insert into public.tc_config (chave, valor) values
  ('aberto', 'false'::jsonb),
  -- Pesos globais do Poder (somam 100; são normalizados). Por posição: { "top": {...} } sobrescreve.
  ('pesos', '{"global": {"mec": 25, "rotas": 20, "macro": 20, "tf": 20, "mental": 15}}'::jsonb),
  -- Jogador fora da posição principal e das secundárias: multiplica o Poder.
  ('fora_posicao', '0.9'::jsonb),
  -- Forma (0 a 100, 50 = neutra): cada ponto acima/abaixo de 50 muda o Poder em `peso` pontos.
  ('forma', '{"peso": 0.04}'::jsonb),
  -- Sinergia da equipe (0 a 100): bônus máximo em pontos de Poder da equipe, ganho por semana juntos e perda por troca de titular.
  ('sinergia', '{"max_bonus": 3, "ganho_semana": 10, "perda_troca": 20}'::jsonb),
  ('elenco', '{"max": 10, "contrato_min": 4, "contrato_max": 26}'::jsonb),
  ('creditos_iniciais', '600000'::jsonb),
  -- Taxa do mercado entre usuários (% do preço em RC retida do vendedor).
  ('taxa_mercado_pct', '5'::jsonb),
  ('preco_rc', '{"min": 10, "max": 100000}'::jsonb),
  ('rank_ativo', 'false'::jsonb),
  ('pool_alvo', '36'::jsonb),
  ('pool_seq', '0'::jsonb),
  -- Início do calendário (uma segunda-feira) e duração da temporada em semanas.
  ('calendario', '{"inicio": "2026-10-12", "semanas": 4}'::jsonb),
  -- Nomes editáveis dos campeonatos.
  ('nomes', '{"acesso": "Liga Ascensão", "principal": "Liga Apex Nacional", "copa": "Copa dos Convergentes", "mundial": "Campeonato Mundial das Lendas"}'::jsonb)
on conflict (chave) do nothing;

create or replace function public.tc_cfg(k text)
returns jsonb language sql stable security definer set search_path = public as $$
  select valor from tc_config where chave = k;
$$;
revoke all on function public.tc_cfg(text) from public, anon, authenticated;

-- Acesso: administrador enquanto o jogo está fechado; qualquer conta logada depois.
create or replace function public.tc_exigir(uid uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if not coalesce((tc_cfg('aberto'))::text::boolean, false)
     and not exists (select 1 from site_admins where user_id = uid) then
    raise exception 'jogo_fechado';
  end if;
end;
$$;
revoke all on function public.tc_exigir(uuid) from public, anon, authenticated;

-- Número pseudoaleatório determinístico em [0, 1): o mesmo (semente, n) dá sempre o mesmo valor.
create or replace function public.tc_u(semente text, n int default 0)
returns double precision language sql immutable as $$
  select (('x' || substr(md5(semente || ':' || n::text), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
$$;
revoke all on function public.tc_u(text, int) from public, anon, authenticated;

-- Semana global (0 = a semana do início do calendário) e dia dentro da semana (1 a 7).
create or replace function public.tc_hoje()
returns date language sql stable as $$ select site_hoje_br(); $$;
create or replace function public.tc_semana_global(d date default null)
returns int language sql stable security definer set search_path = public as $$
  select floor((coalesce(d, site_hoje_br()) - ((tc_cfg('calendario'))->>'inicio')::date) / 7.0)::int;
$$;
revoke all on function public.tc_semana_global(date) from public, anon, authenticated;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.tc_orgs (
  id bigserial primary key,
  user_id uuid unique references auth.users(id) on delete cascade, -- null = equipe do sistema
  nome text not null check (char_length(nome) between 3 and 24),
  sigla text not null check (sigla ~ '^[A-Z0-9]{2,4}$'),
  escudo text not null default 'escudo-1',
  cor1 text not null default '#1b3a6b' check (cor1 ~ '^#[0-9a-fA-F]{6}$'),
  cor2 text not null default '#d9a82b' check (cor2 ~ '^#[0-9a-fA-F]{6}$'),
  estilo text not null default 'classico',
  creditos bigint not null default 0,
  divisao text not null default 'acesso' check (divisao in ('acesso', 'principal')),
  sinergia int not null default 0 check (sinergia between 0 and 100),
  poder_sistema int, -- só equipes do sistema: alvo de Poder usado na geração do elenco
  criado timestamptz not null default now()
);
create unique index if not exists tc_orgs_nome_lower on public.tc_orgs (lower(nome));
create unique index if not exists tc_orgs_sigla_unica on public.tc_orgs (sigla);

create table if not exists public.tc_jogadores (
  id bigserial primary key,
  nome text not null,
  ficticio boolean not null default true,
  pos text not null check (pos in ('top', 'selva', 'meio', 'atirador', 'suporte')),
  pos2 text[] not null default '{}',
  idade int not null check (idade between 16 and 40),
  regiao text,
  retrato text,
  potencial int not null check (potencial between 1 and 100),
  mec int not null check (mec between 1 and 100),
  rotas int not null check (rotas between 1 and 100),
  macro int not null check (macro between 1 and 100),
  tf int not null check (tf between 1 and 100),
  mental int not null check (mental between 1 and 100),
  fama int not null check (fama between 1 and 100),
  forma int not null default 50 check (forma between 0 and 100),
  exp int not null default 0 check (exp >= 0),
  org_id bigint references public.tc_orgs(id) on delete set null,
  slot text check (slot is null or slot in ('top', 'selva', 'meio', 'atirador', 'suporte')), -- titular em qual vaga
  salario int not null default 0 check (salario >= 0), -- créditos por semana
  contrato_fim int, -- semana global em que o contrato termina (inclusive)
  criado timestamptz not null default now(),
  check (org_id is not null or slot is null)
);
create unique index if not exists tc_jogadores_nome_lower on public.tc_jogadores (lower(nome));
create unique index if not exists tc_jogadores_vaga on public.tc_jogadores (org_id, slot) where slot is not null;
create index if not exists tc_jogadores_livres on public.tc_jogadores (pos) where org_id is null;
create index if not exists tc_jogadores_org on public.tc_jogadores (org_id);

-- Histórico de transferências e contratos (compras, vendas, renovações, liberações).
create table if not exists public.tc_transf (
  id bigserial primary key,
  jogador_id bigint not null references public.tc_jogadores(id) on delete cascade,
  de_org bigint references public.tc_orgs(id) on delete set null,
  para_org bigint references public.tc_orgs(id) on delete set null,
  tipo text not null check (tipo in ('inicial', 'contratacao', 'compra_usuario', 'renovacao', 'liberado', 'expirou', 'substituto')),
  valor bigint not null default 0,
  moeda text not null default 'creditos' check (moeda in ('creditos', 'rc')),
  salario int,
  contrato_fim int,
  chave text, -- idempotência (único por conta quando informado)
  user_id uuid,
  criado timestamptz not null default now()
);
create unique index if not exists tc_transf_chave on public.tc_transf (user_id, chave) where chave is not null;
create index if not exists tc_transf_jogador on public.tc_transf (jogador_id, id desc);

-- Extrato dos créditos de equipe.
create table if not exists public.tc_fin (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  delta bigint not null,
  saldo bigint not null,
  motivo text not null,
  ref text,
  criado timestamptz not null default now()
);
create index if not exists tc_fin_org on public.tc_fin (org_id, id desc);

-- Avisos para o técnico (contratos próximos do fim, vendas etc.).
create table if not exists public.tc_avisos (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  texto text not null,
  criado timestamptz not null default now(),
  lido boolean not null default false
);
create index if not exists tc_avisos_org on public.tc_avisos (org_id, id desc);

alter table public.tc_orgs enable row level security;
alter table public.tc_jogadores enable row level security;
alter table public.tc_transf enable row level security;
alter table public.tc_fin enable row level security;
alter table public.tc_avisos enable row level security;
revoke all on public.tc_orgs, public.tc_jogadores, public.tc_transf, public.tc_fin, public.tc_avisos from anon, authenticated;
revoke all on sequence public.tc_orgs_id_seq, public.tc_jogadores_id_seq, public.tc_transf_id_seq, public.tc_fin_id_seq, public.tc_avisos_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- Poder (fórmula única)
-- Pesos normalizados (somam 1) para uma posição.
create or replace function public.tc_pesos(p text)
returns double precision[] language plpgsql stable security definer set search_path = public as $$
declare
  c jsonb := coalesce((tc_cfg('pesos'))->p, (tc_cfg('pesos'))->'global');
  v double precision[];
  s double precision;
begin
  v := array[coalesce((c->>'mec')::double precision, 0), coalesce((c->>'rotas')::double precision, 0),
             coalesce((c->>'macro')::double precision, 0), coalesce((c->>'tf')::double precision, 0),
             coalesce((c->>'mental')::double precision, 0)];
  s := v[1] + v[2] + v[3] + v[4] + v[5];
  if s <= 0 then
    raise exception 'pesos_invalidos';
  end if;
  return array[v[1] / s, v[2] / s, v[3] / s, v[4] / s, v[5] / s];
end;
$$;
revoke all on function public.tc_pesos(text) from public, anon, authenticated;

-- Poder individual (1 a 100): média ponderada dos cinco atributos competitivos. Fama não entra.
create or replace function public.tc_poder(j tc_jogadores, pos_ text default null)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  w double precision[] := tc_pesos(coalesce(pos_, j.pos));
begin
  return least(100, greatest(1, w[1] * j.mec + w[2] * j.rotas + w[3] * j.macro + w[4] * j.tf + w[5] * j.mental));
end;
$$;
revoke all on function public.tc_poder(tc_jogadores, text) from public, anon, authenticated;

-- Poder usado em campo: o individual na vaga em que joga, com a penalidade de posição e a forma.
create or replace function public.tc_poder_efetivo(j tc_jogadores, vaga text)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j, vaga);
begin
  if vaga <> j.pos and not (vaga = any (j.pos2)) then
    p := p * ((tc_cfg('fora_posicao'))::text)::double precision;
  end if;
  p := p + (j.forma - 50) * ((tc_cfg('forma'))->>'peso')::double precision;
  return least(100, greatest(1, p));
end;
$$;
revoke all on function public.tc_poder_efetivo(tc_jogadores, text) from public, anon, authenticated;

-- Poder da equipe: média do Poder efetivo dos cinco titulares + bônus de sinergia.
-- Vaga vazia conta como 1 (a partida nem começa sem os cinco; ver tc_elenco_completo).
create or replace function public.tc_poder_org(oid bigint)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  soma double precision := 0;
  v text;
  j tc_jogadores;
  sin int;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    select * into j from tc_jogadores where org_id = oid and slot = v;
    soma := soma + case when j.id is null then 1 else tc_poder_efetivo(j, v) end;
  end loop;
  select sinergia into sin from tc_orgs where id = oid;
  return least(100, soma / 5 + coalesce(sin, 0) / 100.0 * ((tc_cfg('sinergia'))->>'max_bonus')::double precision);
end;
$$;
revoke all on function public.tc_poder_org(bigint) from public, anon, authenticated;

create or replace function public.tc_elenco_completo(oid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from tc_jogadores where org_id = oid and slot is not null) = 5;
$$;
revoke all on function public.tc_elenco_completo(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- preços e salários
-- Preço de transferência em créditos (sistema).
create or replace function public.tc_preco(poder double precision, potencial int, fama int, idade int)
returns bigint language sql immutable as $$
  select greatest(5000, round((power(poder / 100.0, 3) * 800000
          * (1 + greatest(0, potencial - poder) / 100.0)
          * (1 + fama / 300.0)
          * case when idade < 22 then 1.1 else 1 end) / 1000.0)::bigint * 1000);
$$;
revoke all on function public.tc_preco(double precision, int, int, int) from public, anon, authenticated;

-- Salário semanal em créditos (1,5% do preço, arredondado para centenas).
create or replace function public.tc_salario(preco bigint)
returns int language sql immutable as $$
  select greatest(300, round(preco * 0.015 / 100.0)::int * 100);
$$;
revoke all on function public.tc_salario(bigint) from public, anon, authenticated;

create or replace function public.tc_preco_jogador(j tc_jogadores)
returns bigint language sql stable security definer set search_path = public as $$
  select tc_preco(tc_poder(j), j.potencial, j.fama, j.idade);
$$;
revoke all on function public.tc_preco_jogador(tc_jogadores) from public, anon, authenticated;

-- ---------------------------------------------------------------- geração de jogadores fictícios
-- Gera `qtd` atletas fictícios no mercado oficial (sem dono). Determinístico pela sequência salva em tc_config.
-- Nunca apaga nem repete atletas existentes (o nome é único).
create or replace function public.tc_gerar_jogadores(qtd int, alvo_poder int default null, pos_fixa text default null, org bigint default null)
returns bigint[] language plpgsql security definer set search_path = public as $$
declare
  pref text[] := array['Zy','Kro','Vex','Ny','Tor','Kae','Mir','Dax','Lun','Ori','Bra','Sol','Ika','Rho','Vel','Axi','Nox','Tal','Fen','Gor','Hex','Jin','Kel','Lyr','Mox','Pyr','Quo','Ryn','Syl','Tek','Ulo','Vor','Wyn','Xan','Yor','Zel'];
  suf text[] := array['n','x','ra','lis','ko','th','vik','zen','mo','sh','ro','dak','ni','las','rek','mi','don','tis','vo','ka'];
  regioes text[] := array['BR', 'KR', 'CN', 'EU', 'NA', 'VN', 'JP', 'LAN', 'LAS', 'TR'];
  posicoes text[] := array['top', 'selva', 'meio', 'atirador', 'suporte'];
  ids bigint[] := '{}';
  seq int;
  i int;
  p text;
  nm text;
  tent int;
  b double precision;
  vies int[];
  a int[];
  pot int;
  novo bigint;
  seed text;
  poderv double precision;
begin
  for i in 1..qtd loop
    seq := ((tc_cfg('pool_seq'))::text)::int + 1;
    update tc_config set valor = to_jsonb(seq) where chave = 'pool_seq';
    seed := 'tc:' || seq::text;
    p := coalesce(pos_fixa, posicoes[1 + floor(tc_u(seed, 1) * 5)::int]);
    tent := 0;
    loop
      nm := pref[1 + floor(tc_u(seed, 2 + tent * 2) * array_length(pref, 1))::int]
            || suf[1 + floor(tc_u(seed, 3 + tent * 2) * array_length(suf, 1))::int];
      if tent >= 2 then nm := nm || (1 + floor(tc_u(seed, 40 + tent) * 98))::text; end if;
      exit when not exists (select 1 from tc_jogadores where lower(nome) = lower(nm));
      tent := tent + 1;
      if tent > 40 then nm := nm || seq::text; exit; end if;
    end loop;
    -- Poder base: curva que deixa a maioria no meio e poucos craques; `alvo_poder` fixa a média.
    b := case when alvo_poder is null then 28 + 62 * power(tc_u(seed, 90), 1.7)
              else greatest(15, least(95, alvo_poder + (tc_u(seed, 90) - 0.5) * 8)) end;
    -- Vies por posição: [mec, rotas, macro, tf, mental]
    vies := case p when 'top' then array[2, 4, -4, 4, -6] when 'selva' then array[-2, -6, 6, 4, 0]
                   when 'meio' then array[6, 4, 0, -4, -6] when 'atirador' then array[6, 0, -6, 6, -6]
                   else array[-8, -2, 6, 0, 4] end;
    a := array[0, 0, 0, 0, 0];
    for tent in 1..5 loop
      a[tent] := greatest(8, least(99, round(b + vies[tent] + (tc_u(seed, 100 + tent) - 0.5) * 16)::int));
    end loop;
    pot := least(99, greatest(round(b)::int, round(b + tc_u(seed, 110) * 34)::int));
    insert into tc_jogadores (nome, ficticio, pos, pos2, idade, regiao, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, org_id)
    values (nm, true, p,
            case when tc_u(seed, 120) < 0.25 then array[posicoes[1 + floor(tc_u(seed, 121) * 5)::int]] else '{}' end,
            17 + floor(tc_u(seed, 130) * 14)::int,
            regioes[1 + floor(tc_u(seed, 131) * array_length(regioes, 1))::int],
            pot, a[1], a[2], a[3], a[4], a[5],
            greatest(3, least(97, round(b * 0.8 + tc_u(seed, 140) * 30 - 8)::int)),
            35 + floor(tc_u(seed, 150) * 31)::int,
            floor(tc_u(seed, 160) * 30)::int,
            org)
    returning id into novo;
    -- 'pos2' nunca repete a posição principal.
    update tc_jogadores set pos2 = array_remove(pos2, pos) where id = novo;
    ids := ids || novo;
  end loop;
  return ids;
end;
$$;
revoke all on function public.tc_gerar_jogadores(int, int, text, bigint) from public, anon, authenticated;

-- Mantém o mercado oficial abastecido: pelo menos `pool_alvo` livres por posição.
create or replace function public.tc_reabastecer()
returns int language plpgsql security definer set search_path = public as $$
declare
  alvo int := ((tc_cfg('pool_alvo'))::text)::int;
  v text;
  falta int;
  total int := 0;
begin
  perform pg_advisory_xact_lock(85001);
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    select greatest(0, alvo - count(*)) into falta from tc_jogadores where org_id is null and pos = v;
    if falta > 0 then
      perform tc_gerar_jogadores(falta, null, v);
      total := total + falta;
    end if;
  end loop;
  return total;
end;
$$;
revoke all on function public.tc_reabastecer() from public, anon, authenticated;

-- ---------------------------------------------------------------- finanças e avisos
create or replace function public.tc_creditos_mexer(oid bigint, delta bigint, motivo_ text, ref_ text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  novo bigint;
begin
  update tc_orgs set creditos = creditos + delta where id = oid returning creditos into novo;
  insert into tc_fin (org_id, delta, saldo, motivo, ref) values (oid, delta, novo, motivo_, ref_);
  return novo;
end;
$$;
revoke all on function public.tc_creditos_mexer(bigint, bigint, text, text) from public, anon, authenticated;

create or replace function public.tc_avisar(oid bigint, texto_ text)
returns void language sql security definer set search_path = public as $$
  insert into tc_avisos (org_id, texto) values (oid, left(texto_, 240));
$$;
revoke all on function public.tc_avisar(bigint, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- organização
-- Dá a um novo técnico cinco jogadores de base (fictícios, baratos) para já poder jogar.
create or replace function public.tc_elenco_inicial(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text;
  ids bigint[];
  semana int := tc_semana_global();
  j tc_jogadores;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    ids := tc_gerar_jogadores(1, 42, v, oid);
    update tc_jogadores set slot = v, salario = tc_salario(tc_preco_jogador(tc_jogadores)),
           contrato_fim = semana + 12, forma = 50, fama = least(fama, 25)
     where id = ids[1];
    select * into j from tc_jogadores where id = ids[1];
    insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim)
    values (j.id, oid, 'inicial', 0, j.salario, j.contrato_fim);
  end loop;
end;
$$;
revoke all on function public.tc_elenco_inicial(bigint) from public, anon, authenticated;

-- Cria a organização do técnico. Uma por conta; nome e sigla únicos.
create or replace function public.tc_criar_org(nome_ text, sigla_ text, escudo_ text default 'escudo-1', cor1_ text default '#1b3a6b', cor2_ text default '#d9a82b', estilo_ text default 'classico')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := regexp_replace(trim(coalesce(nome_, '')), '\s+', ' ', 'g');
  s text := upper(trim(coalesce(sigla_, '')));
  oid bigint;
begin
  perform tc_exigir(uid);
  if char_length(n) < 3 or char_length(n) > 24 or n !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'nome_invalido';
  end if;
  if s !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'sigla_invalida';
  end if;
  if escudo_ !~ '^escudo-[0-9]{1,2}$' then
    raise exception 'escudo_invalido';
  end if;
  if estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'estilo_invalido';
  end if;
  if exists (select 1 from tc_orgs where user_id = uid) then
    raise exception 'ja_tem_org';
  end if;
  if exists (select 1 from tc_orgs where lower(nome) = lower(n)) then
    raise exception 'nome_em_uso';
  end if;
  if exists (select 1 from tc_orgs where sigla = s) then
    raise exception 'sigla_em_uso';
  end if;
  -- Capacidade: até 8 técnicos na divisão de acesso por enquanto (o resto é equipe do sistema).
  if (select count(*) from tc_orgs where user_id is not null and divisao = 'acesso') >= 8 then
    raise exception 'divisao_cheia';
  end if;
  insert into tc_orgs (user_id, nome, sigla, escudo, cor1, cor2, estilo, creditos, divisao)
  values (uid, n, s, escudo_, cor1_, cor2_, estilo_, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'acesso')
  returning id into oid;
  insert into tc_fin (org_id, delta, saldo, motivo) values (oid, ((tc_cfg('creditos_iniciais'))::text)::bigint, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'inicial');
  perform tc_elenco_inicial(oid);
  return jsonb_build_object('id', oid);
exception when unique_violation then
  raise exception 'nome_ou_sigla_em_uso';
end;
$$;
revoke all on function public.tc_criar_org(text, text, text, text, text, text) from public, anon;
grant execute on function public.tc_criar_org(text, text, text, text, text, text) to authenticated;

-- Atualiza só a aparência (nunca dá vantagem competitiva).
create or replace function public.tc_personalizar_org(escudo_ text, cor1_ text, cor2_ text, estilo_ text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  perform tc_exigir(uid);
  if escudo_ !~ '^escudo-[0-9]{1,2}$' or estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'dados_invalidos';
  end if;
  update tc_orgs set escudo = escudo_, cor1 = cor1_, cor2 = cor2_, estilo = estilo_ where user_id = uid;
  if not found then
    raise exception 'sem_org';
  end if;
end;
$$;
revoke all on function public.tc_personalizar_org(text, text, text, text) from public, anon;
grant execute on function public.tc_personalizar_org(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- consultas
create or replace function public.tc_jogador_json(j tc_jogadores, ver_pot boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j);
begin
  return jsonb_build_object(
    'id', j.id, 'nome', j.nome, 'ficticio', j.ficticio, 'pos', j.pos, 'pos2', to_jsonb(j.pos2),
    'idade', j.idade, 'regiao', j.regiao, 'retrato', j.retrato,
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama,
    'potencial', case when ver_pot then j.potencial else null end,
    'forma', j.forma, 'exp', j.exp, 'poder', round(p)::int,
    'org_id', j.org_id, 'slot', j.slot, 'salario', j.salario, 'contrato_fim', j.contrato_fim,
    'preco', tc_preco(p, j.potencial, j.fama, j.idade));
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;

-- Estado completo da organização do usuário (ou null se ainda não criou).
create or replace function public.tc_meu()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  semana int := tc_semana_global();
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then
    return jsonb_build_object('org', null, 'semana', semana, 'nomes', tc_cfg('nomes'), 'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
  end if;
  return jsonb_build_object(
    'org', jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'escudo', o.escudo, 'cor1', o.cor1, 'cor2', o.cor2,
                              'estilo', o.estilo, 'creditos', o.creditos, 'divisao', o.divisao, 'sinergia', o.sinergia),
    'poder', round(tc_poder_org(o.id)::numeric, 1),
    'completo', tc_elenco_completo(o.id),
    'semana', semana,
    'nomes', tc_cfg('nomes'),
    'elenco', coalesce((select jsonb_agg(tc_jogador_json(j) order by (j.slot is null), j.pos) from tc_jogadores j where j.org_id = o.id), '[]'::jsonb),
    'salarios_semana', coalesce((select sum(salario) from tc_jogadores where org_id = o.id), 0),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'lido', a.lido) order by a.id desc)
                         from (select * from tc_avisos where org_id = o.id order by id desc limit 15) a), '[]'::jsonb),
    'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
end;
$$;
revoke all on function public.tc_meu() from public, anon;
grant execute on function public.tc_meu() to authenticated;

-- ---------------------------------------------------------------- mercado oficial (créditos)
-- Filtros (jsonb): pos, poder_min, poder_max, pot_min, idade_max, preco_max, atributo_min {mec: 60...}, busca, ordem, pagina.
create or replace function public.tc_mercado_oficial(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim int := 24;
  off int := greatest(0, coalesce((f->>'pagina')::int, 0)) * 24;
  r jsonb;
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

-- Contratação oficial: paga o preço em créditos e fecha o contrato (4 a 26 semanas).
-- `chave` evita cobrança em dobro se o pedido for repetido.
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
  if semanas is null or semanas < (el->>'contrato_min')::int or semanas > (el->>'contrato_max')::int then
    raise exception 'contrato_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.org_id is not null then raise exception 'jogador_indisponivel'; end if;
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then
    raise exception 'elenco_cheio';
  end if;
  preco := tc_preco_jogador(j);
  if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
  sal := tc_salario(preco);
  perform tc_creditos_mexer(o.id, -preco, 'contratacao', j.id::text);
  update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = tc_semana_global() + semanas where id = j.id;
  insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, 'contratacao', preco, sal, tc_semana_global() + semanas, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar(bigint, int, text) to authenticated;

-- ---------------------------------------------------------------- escalação
-- Põe um jogador (do elenco) como titular de uma vaga. Quem estava lá vai para a reserva.
-- A troca de titulares reduz a sinergia.
create or replace function public.tc_escalar(vaga text, jogador bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  atual bigint;
begin
  perform tc_exigir(uid);
  if vaga not in ('top', 'selva', 'meio', 'atirador', 'suporte') then raise exception 'vaga_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot = vaga then return; end if;
  select id into atual from tc_jogadores where org_id = o.id and slot = vaga for update;
  if atual is not null then
    update tc_jogadores set slot = null where id = atual;
  end if;
  -- Se ele já era titular em outra vaga, essa vaga fica livre (o técnico precisa preenchê-la).
  update tc_jogadores set slot = vaga where id = j.id;
  update tc_orgs set sinergia = greatest(0, sinergia - ((tc_cfg('sinergia'))->>'perda_troca')::int) where id = o.id;
end;
$$;
revoke all on function public.tc_escalar(text, bigint) from public, anon;
grant execute on function public.tc_escalar(text, bigint) to authenticated;

-- ---------------------------------------------------------------- contratos
-- Renovação: paga o preço do contrato (salário x semanas / 2, em créditos) e estende o prazo.
create or replace function public.tc_renovar(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  custo bigint;
  sal int;
  fim int;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  if exists (select 1 from tc_transf where user_id = uid and chave = chave_) then
    return jsonb_build_object('ja_feito', true);
  end if;
  if semanas is null or semanas < (el->>'contrato_min')::int or semanas > (el->>'contrato_max')::int then
    raise exception 'contrato_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  sal := tc_salario(tc_preco_jogador(j));
  custo := (sal::bigint * semanas) / 2;
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  fim := greatest(coalesce(j.contrato_fim, tc_semana_global()), tc_semana_global()) + semanas;
  perform tc_creditos_mexer(o.id, -custo, 'renovacao', j.id::text);
  update tc_jogadores set salario = sal, contrato_fim = fim where id = j.id;
  insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, o.id, 'renovacao', custo, sal, fim, chave_, uid);
  return jsonb_build_object('ok', true, 'custo', custo, 'salario', sal, 'contrato_fim', fim);
end;
$$;
revoke all on function public.tc_renovar(bigint, int, text) from public, anon;
grant execute on function public.tc_renovar(bigint, int, text) to authenticated;

-- Libera um jogador (volta ao mercado oficial, sem reembolso). Não vale para quem está anunciado.
create or replace function public.tc_liberar(jogador bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot is not null then raise exception 'jogador_titular'; end if;
  update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id;
  insert into tc_transf (jogador_id, de_org, tipo) values (j.id, o.id, 'liberado');
end;
$$;
revoke all on function public.tc_liberar(bigint) from public, anon;
grant execute on function public.tc_liberar(bigint) to authenticated;

-- Substituto de emergência: preenche uma vaga titular vazia com um jogador fraco e barato (contrato curto).
create or replace function public.tc_preencher_vaga(oid bigint, vaga text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  ids bigint[];
  j tc_jogadores;
begin
  ids := tc_gerar_jogadores(1, 30, vaga, oid);
  update tc_jogadores set slot = vaga, forma = 50, fama = least(fama, 10),
         salario = 300, contrato_fim = tc_semana_global() + 4 where id = ids[1];
  insert into tc_transf (jogador_id, para_org, tipo, salario, contrato_fim) select id, oid, 'substituto', salario, contrato_fim from tc_jogadores where id = ids[1];
  return ids[1];
end;
$$;
revoke all on function public.tc_preencher_vaga(bigint, text) from public, anon, authenticated;

-- Garante cinco titulares: leva o melhor reserva elegível para a vaga ou cria um substituto.
create or replace function public.tc_completar_elenco(oid bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v text;
  achou bigint;
  n int := 0;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    if not exists (select 1 from tc_jogadores where org_id = oid and slot = v) then
      select id into achou from tc_jogadores
       where org_id = oid and slot is null and (pos = v or v = any (pos2))
       order by (mec + rotas + macro + tf + mental) desc limit 1;
      if achou is not null then
        update tc_jogadores set slot = v where id = achou;
      else
        perform tc_preencher_vaga(oid, v);
      end if;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.tc_completar_elenco(bigint) from public, anon, authenticated;

-- Pagamento semanal de salários e vencimento dos contratos (chamado pelo calendário, uma vez por semana e organização).
-- Contrato vencido: o jogador volta ao mercado oficial (fica registrado no histórico e vira um aviso);
-- a vaga titular é completada por um reserva ou um substituto.
create or replace function public.tc_fechar_semana_org(oid bigint, semana int)
returns void language plpgsql security definer set search_path = public as $$
declare
  total bigint;
  j record;
begin
  select coalesce(sum(salario), 0) into total from tc_jogadores where org_id = oid;
  if total > 0 then
    perform tc_creditos_mexer(oid, -total, 'salarios', semana::text);
  end if;
  -- Sinergia: sobe com a semana juntos.
  update tc_orgs set sinergia = least(100, sinergia + ((tc_cfg('sinergia'))->>'ganho_semana')::int) where id = oid;
  for j in select * from tc_jogadores where org_id = oid and contrato_fim is not null and contrato_fim <= semana order by id loop
    update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id;
    insert into tc_transf (jogador_id, de_org, tipo) values (j.id, oid, 'expirou');
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' terminou e ele voltou ao mercado.');
  end loop;
  perform tc_completar_elenco(oid);
  -- Avisa dos contratos que vencem na próxima semana.
  for j in select nome from tc_jogadores where org_id = oid and contrato_fim = semana + 1 order by id loop
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' termina na próxima semana.');
  end loop;
end;
$$;
revoke all on function public.tc_fechar_semana_org(bigint, int) from public, anon, authenticated;

-- ---------------------------------------------------------------- equipes do sistema
-- Cria `qtd` equipes do sistema em uma divisão, com elencos persistentes de Poder perto do alvo.
create or replace function public.tc_criar_equipes_sistema(div text, qtd int, poder_alvo int)
returns int language plpgsql security definer set search_path = public as $$
declare
  nomes text[] := array['Aurora Vanguard','Nebula Corps','Ferro & Brasa','Titan Forge','Lume Collective','Obsidian Pact','Vento Sul','Cobalto Rift','Sentinela Prime','Ciclone Esports','Ágata Gaming','Zênite Labs','Pulsar Crew','Marfim Club','Eclipse Union','Quasar Hunters','Brasa Viva','Horizonte FC','Duna Rubra','Trovão Azul','Ônix Syndicate','Safira Nova','Vórtice Team','Fênix Pátria'];
  siglas text[] := array['AUV','NEB','FEB','TIF','LUM','OBS','VES','COR','SEN','CIC','AGT','ZEN','PUL','MAR','ECL','QSR','BRV','HOR','DUR','TRA','ONX','SAF','VOR','FNX'];
  i int := 0;
  oid bigint;
  v text;
  ids bigint[];
  existentes int;
  criadas int := 0;
begin
  select count(*) into existentes from tc_orgs where user_id is null;
  for i in 1..array_length(nomes, 1) loop
    exit when criadas >= qtd;
    continue when exists (select 1 from tc_orgs where sigla = siglas[i]);
    insert into tc_orgs (user_id, nome, sigla, escudo, cor1, cor2, creditos, divisao, poder_sistema)
    values (null, nomes[i], siglas[i], 'escudo-' || (1 + (i % 6))::text,
            '#' || lpad(to_hex(floor(tc_u('cor1:' || siglas[i], 1) * 8388607)::int + 3000000), 6, '0'),
            '#' || lpad(to_hex(floor(tc_u('cor2:' || siglas[i], 2) * 8388607)::int + 8000000), 6, '0'),
            1000000, div, poder_alvo + floor(tc_u('pa:' || siglas[i], 3) * 9)::int - 4)
    returning id into oid;
    foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
      ids := tc_gerar_jogadores(1, (select poder_sistema from tc_orgs where id = oid), v, oid);
      update tc_jogadores set slot = v, salario = 0, contrato_fim = null, forma = 50 where id = ids[1];
    end loop;
    criadas := criadas + 1;
  end loop;
  return criadas;
end;
$$;
revoke all on function public.tc_criar_equipes_sistema(text, int, int) from public, anon, authenticated;
