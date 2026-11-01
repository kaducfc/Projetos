-- Baú Básico GRÁTIS a cada 3 dias (só o "1 Baú Básico", nada mais). Tudo é decidido no servidor:
--   * o prazo fica em tc_bau_gratis (por conta) e é contado com o relógio do banco (now()), nunca com o do aparelho;
--   * o pedido trava a organização (for update): dois cliques/abas ao mesmo tempo não abrem dois baús;
--   * o prazo só recomeça se o baú foi realmente aberto (inventário cheio etc. não gasta o baú grátis);
--   * o mesmo código de pedido (chave) devolve o resultado já sorteado, sem sortear nem renovar o prazo de novo;
--   * o grátis NÃO acumula: ao abrir, o prazo recomeça (3 dias a partir da abertura);
--   * o sorteio é o mesmo do Baú Básico pago (mesmas chances, mesma garantia de Lendário a cada 40, contrato de 1 semana).
-- Conta nova: o primeiro baú grátis já está disponível. Rode depois da 0181. Idempotente.

alter table public.tc_gacha add column if not exists gratis boolean not null default false;
-- o baú grátis grava custo 0 (antes a regra exigia custo > 0)
alter table public.tc_gacha drop constraint if exists tc_gacha_custo_rc_check;
alter table public.tc_gacha add constraint tc_gacha_custo_rc_check check (custo_rc >= 0);

create table if not exists public.tc_bau_gratis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  proximo timestamptz not null,
  atualizado timestamptz not null default now()
);
alter table public.tc_bau_gratis enable row level security;
revoke all on public.tc_bau_gratis from anon, authenticated;

-- Núcleo do recrutamento (o sorteio e a gravação de sempre). Fora do alcance do navegador: só as funções abaixo o chamam.
create or replace function public.tc_recrutar_nucleo(bau_ text, qtd_ int, chave_ text, gratis_ boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('gacha');
  b jsonb;
  ordem text[] := array['comum', 'raro', 'epico', 'lendario', 'mitico'];
  preco bigint;
  g tc_gacha;
  t tc_jogadores;
  j tc_jogadores;
  rar text;
  achada text;
  sem int;
  pity int;
  gar text;
  sal int;
  itens jsonb := '[]'::jsonb;
  i int;
  k int;
  ofs int;
  gid bigint;
  saldo_novo bigint;
  repetida boolean;
  moeda_ text := coalesce(cfg->>'moeda', 'rc');
  unit numeric;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  if qtd_ is null or qtd_ not in (1, 5) then raise exception 'quantidade_invalida'; end if;
  b := cfg->'baus'->bau_;
  if b is null then raise exception 'bau_invalido'; end if;
  pity := coalesce((b->'garantia'->>'a_cada')::int, 0);
  gar := b->'garantia'->>'raridade';
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into g from tc_gacha where user_id = uid and chave = chave_;
  if g.id is not null then return jsonb_build_object('ja_feito', true, 'itens', g.resultado, 'preco_rc', g.custo_rc, 'gratis', coalesce(g.gratis, false)); end if;
  if (select count(*) from tc_jogadores where org_id = o.id) + qtd_ > ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if; -- inventário: precisa de espaço para a quantidade pedida
  if not exists (select 1 from tc_jogadores where not ficticio and legado_base is null) then raise exception 'sem_legados'; end if;
  perform pg_advisory_xact_lock(85098);
  unit := (b->>(case when moeda_ = 'rc' then 'rc' else 'creditos' end))::numeric;
  preco := case when qtd_ = 5 then round(unit * 5 * (1 - (cfg->>'desconto_5')::numeric)) else unit::bigint end;
  select coalesce(sem_epico, 0) into sem from tc_gacha_pity where org_id = o.id and bau = bau_;
  sem := coalesce(sem, 0);
  if gratis_ then
    preco := 0; -- baú grátis (a cada 3 dias): não cobra nada
  elsif moeda_ = 'rc' then
    perform site_moedas_mexer(uid, -preco, 'tecnico_bau', left(bau_ || ':x' || qtd_::text, 200)); -- falta de saldo desfaz tudo
  else
    if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
    perform tc_creditos_mexer(o.id, -preco, 'bau', left(bau_ || ':x' || qtd_::text, 200));
  end if;
  for i in 1..qtd_ loop
    rar := case when pity > 0 and sem + 1 >= pity then gar else tc_gacha_raridade(b->'odds', false) end;
    achada := null;
    ofs := array_position(ordem, rar);
    for k in 0..4 loop
      foreach achada in array array[ordem[ofs - k], ordem[ofs + k]] loop
        continue when achada is null;
        exit when exists (select 1 from tc_jogadores where not ficticio and legado_base is null and raridade = achada);
        achada := null;
      end loop;
      exit when achada is not null;
    end loop;
    if achada is null then raise exception 'sem_legados'; end if;
    select * into t from tc_jogadores where not ficticio and legado_base is null and raridade = achada order by random() limit 1;
    -- já tem o Legado? (a cópia do catálogo, o próprio modelo do catálogo ou o mesmo nome): vira cópia, sem custo nenhum
    select * into j from tc_jogadores where org_id = o.id and not ficticio and (id = t.id or legado_base = t.id or nome = t.nome) order by (legado_base is null) desc, id limit 1 for update;
    if j.id is not null then
      repetida := true;
      update tc_jogadores set copias = copias + 1 where id = j.id returning * into j; -- repetido: vira cópia para subir Estrelas
      -- aparece no histórico como cópia vinda do baú, com o valor do baú (a parte deste jogador), e não o contrato dele
      insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
      values (j.id, o.id, 'bau_copia', round(preco::numeric / qtd_)::bigint, case when moeda_ = 'rc' then 'rc' else 'creditos' end, null, null, null, uid);
    else
      repetida := false;
      sal := tc_salario(tc_preco_jogador(t));
      insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade, org_id, slot, salario, contrato_fim, legado_base)
      values (t.nome, false, t.genero, t.pos, t.pos2, t.idade, t.regiao, t.retrato, t.potencial, t.mec, t.rotas, t.macro, t.tf, t.mental, t.fama, 50, 0, t.raridade, o.id, null, sal, tc_semana_global() + 1, t.id)
      returning * into j;
      insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
      values (j.id, o.id, 'bau', round(preco::numeric / qtd_)::bigint, case when moeda_ = 'rc' then 'rc' else 'creditos' end, sal, tc_semana_global() + 1, null, uid);
    end if;
    itens := itens || jsonb_build_array(jsonb_build_object('raridade', achada, 'sorteada', rar, 'repetida', repetida, 'jogador', tc_jogador_json(j)));
    sem := case when pity > 0 and array_position(ordem, achada) >= array_position(ordem, gar) then 0 else sem + 1 end;
  end loop;
  insert into tc_gacha_pity (org_id, bau, sem_epico) values (o.id, bau_, sem)
    on conflict (org_id, bau) do update set sem_epico = excluded.sem_epico;
  insert into tc_gacha (org_id, user_id, bau, qtd, custo_rc, resultado, chave, gratis) values (o.id, uid, bau_, qtd_, preco, itens, chave_, gratis_) returning id into gid;
  if moeda_ = 'rc' then select c.saldo into saldo_novo from site_carteira c where c.user_id = uid; else select creditos into saldo_novo from tc_orgs where id = o.id; end if;
  return jsonb_build_object('ok', true, 'id', gid, 'itens', itens, 'preco_rc', preco, 'preco', preco, 'moeda', moeda_, 'saldo', coalesce(saldo_novo, 0), 'saldo_rc', coalesce(saldo_novo, 0), 'garantia', sem, 'gratis', gratis_);
end;
$$;
revoke all on function public.tc_recrutar_nucleo(text, int, text, boolean) from public, anon, authenticated;

-- Recrutar pago (igual ao de antes, agora usando o núcleo).
create or replace function public.tc_recrutar(bau_ text, qtd_ int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return tc_recrutar_nucleo(bau_, qtd_, chave_, false);
end;
$$;
revoke all on function public.tc_recrutar(text, int, text) from public, anon;
grant execute on function public.tc_recrutar(text, int, text) to authenticated;

-- Situação do baú grátis: disponível agora, ou quanto falta (em segundos, pelo relógio do servidor).
create or replace function public.tc_bau_gratis_estado()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p timestamptz;
  dias int := coalesce(((tc_cfg('gacha'))->>'gratis_dias')::int, 3);
begin
  perform tc_exigir(uid);
  select proximo into p from tc_bau_gratis where user_id = uid;
  return jsonb_build_object(
    'disponivel', p is null or p <= now(),
    'restante_seg', case when p is null or p <= now() then 0 else ceil(extract(epoch from (p - now())))::int end,
    'agora', now(), 'proximo', p, 'dias', dias);
end;
$$;
revoke all on function public.tc_bau_gratis_estado() from public, anon;
grant execute on function public.tc_bau_gratis_estado() to authenticated;

-- Abre o baú grátis: sempre 1 Baú Básico.
create or replace function public.tc_recrutar_gratis(chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  g tc_gacha;
  p timestamptz;
  r jsonb;
  dias int := coalesce(((tc_cfg('gacha'))->>'gratis_dias')::int, 3);
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update; -- trava: um pedido por vez
  if o.id is null then raise exception 'sem_org'; end if;
  select * into g from tc_gacha where user_id = uid and chave = chave_ and gratis;
  if g.id is not null then
    return jsonb_build_object('ja_feito', true, 'itens', g.resultado, 'preco_rc', 0, 'gratis', true);
  end if;
  select proximo into p from tc_bau_gratis where user_id = uid for update;
  if p is not null and p > now() then raise exception 'bau_gratis_indisponivel'; end if;
  r := tc_recrutar_nucleo('basico', 1, chave_, true); -- qualquer erro aqui (inventário cheio...) desfaz tudo e o baú grátis continua disponível
  insert into tc_bau_gratis (user_id, proximo) values (uid, now() + make_interval(days => dias))
    on conflict (user_id) do update set proximo = excluded.proximo, atualizado = now();
  return r || jsonb_build_object('restante_seg', dias * 86400);
end;
$$;
revoke all on function public.tc_recrutar_gratis(text) from public, anon;
grant execute on function public.tc_recrutar_gratis(text) to authenticated;
