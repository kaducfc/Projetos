-- Mercado oficial: cada técnico tem a SUA vitrine de 10 jogadores comuns (fictícios), feita sob medida para o time dele.
-- Rodar depois da 0188. Rodar de novo é seguro.
--
-- Antes (0175) a vitrine era sorteada do mesmo estoque compartilhado de fictícios, que depende das 60 fotos do jogo: com o estoque
-- ocupado por equipes do sistema e cópias de técnicos, a faixa de Poder de muitos times ficava sem ninguém e a loja aparecia vazia.
-- Agora:
--   * a cada janela de 12 h, cada técnico recebe 10 jogadores NOVOS (2 por posição), gerados na hora, com Poder dentro da faixa do time
--     (-5 a +10 sobre a média dos titulares). Os jogadores são só dele: o que outro técnico contratou não muda a vitrine de ninguém,
--     e o mesmo jogador (nome/atributos parecidos) pode aparecer para vários técnicos;
--   * eles não gastam fotos (ficam com o avatar desenhado) e não entram no estoque compartilhado (coluna mercado_org);
--   * contratar continua criando uma cópia para o comprador; os jogadores da janela anterior são apagados na troca de janela;
--   * uma vitrine vazia nunca fica guardada: se faltar jogador, a próxima chamada gera de novo.

alter table public.tc_jogadores add column if not exists mercado_org bigint references public.tc_orgs(id) on delete cascade;
create index if not exists tc_jogadores_mercado_org on public.tc_jogadores (mercado_org) where mercado_org is not null;

update public.tc_config set valor = valor || '{"qtd": 10, "min": 10, "max": 10}'::jsonb where chave = 'mercado_oficial';

-- Estoque compartilhado: ignora os jogadores individuais do mercado.
create or replace function public.tc_reabastecer()
returns int language plpgsql security definer set search_path = public as $$
declare
  alvo int := ((tc_cfg('pool_alvo'))::text)::int;
  v text;
  falta int;
  livres int;
  total int := 0;
  restantes int := 5;
begin
  perform pg_advisory_xact_lock(85001);
  select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null and not copia_sistema;
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    exit when livres <= 0;
    -- divide os retratos livres entre as posições que faltam (não deixa o topo levar tudo)
    select least(greatest(0, alvo - count(*)), ceil(livres::numeric / restantes)::int) into falta from tc_jogadores where org_id is null and ficticio and mercado_org is null and pos = v;
    if falta > 0 then
      perform tc_gerar_jogadores(falta, null, v);
      total := total + falta; livres := livres - falta;
    end if;
    restantes := restantes - 1;
  end loop;
  delete from tc_jogadores where org_id is null and ficticio and mercado_org is null and retrato is null; -- sem retrato livre (gênero esgotado): não entra
  return total;
end;
$$;

-- Jogador individual do mercado não gasta foto.
create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  livres int;
begin
  if new.ficticio and new.retrato is null then
    new.genero := case when coalesce(current_setting('tc.oferta', true), '') = '1' and coalesce(current_setting('tc.genero', true), '') in ('M', 'F') then current_setting('tc.genero', true) else tc_genero_do_jogador(new.id) end;
    if coalesce(current_setting('tc.mercado', true), '') = '1' then
      return new; -- jogador individual do mercado oficial: fica com o avatar desenhado, sem gastar foto
    end if;
    if new.org_id is null or not exists (select 1 from tc_orgs where id = new.org_id and user_id is null) then
      perform pg_advisory_xact_lock(85107);
      if new.org_id is not null and coalesce(current_setting('tc.oferta', true), '') <> '1' then
        select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null;
        if livres <= coalesce(((tc_cfg('retratos'))->>'reserva_mercado')::int, 30) then return new; end if;
      end if;
      new.retrato := tc_retrato_livre(new.id, new.genero);
      if new.retrato is null and coalesce(current_setting('tc.oferta', true), '') = '1' then -- acabou o gênero sorteado: o candidato muda de gênero para ter foto
        new.genero := case when new.genero = 'F' then 'M' else 'F' end;
        new.retrato := tc_retrato_livre(new.id, new.genero);
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Contratar: a cópia do comprador deixa de ser 'do mercado'.
create or replace function public.tc_contratar(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  nj tc_jogadores;
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
  select jsonb_build_object('ja_feito', true, 'jogador', jogador_id) into ant from tc_transf where user_id = uid and chave = chave_;
  if ant is not null then return ant; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.org_id is not null or not j.ficticio then raise exception 'jogador_indisponivel'; end if;
  if not (j.id = any (tc_mercado_oferta(o.id))) then raise exception 'fora_da_oferta'; end if;
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then
    raise exception 'elenco_cheio';
  end if;
  preco := tc_preco_jogador(j);
  if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
  sal := tc_salario(preco);
  perform tc_creditos_mexer(o.id, -preco, 'contratacao', j.id::text);
  nj := j;
  nj.id := nextval(pg_get_serial_sequence('public.tc_jogadores', 'id'));
  nj.org_id := o.id; nj.slot := null; nj.salario := sal; nj.contrato_fim := null; nj.contrato_valor_semana := 0;
  nj.mercado_org := null; nj.copia_sistema := true; nj.clone_mercado := true; nj.criado := now();
  insert into tc_jogadores select nj.*;
  update tc_mercado_rot set comprados = array_append(comprados, j.id) where org_id = o.id and janela = tc_mercado_janela();
  insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (nj.id, o.id, 'contratacao', preco, sal, null, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', nj.id, 'preco', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar(bigint, int, text) to authenticated;

-- Vitrine individual: 10 jogadores novos por janela, na faixa de Poder do time (centrada em +2,5 sobre a média dos titulares).
create or replace function public.tc_mercado_oferta(oid bigint)
returns bigint[] language plpgsql security definer set search_path = public as $$
declare
  c jsonb := tc_cfg('mercado_oficial');
  jan bigint := tc_mercado_janela();
  ref numeric := tc_mercado_ref(oid);
  lo numeric := ref - (c->>'abaixo')::numeric;
  hi numeric := ref + (c->>'acima')::numeric;
  n int := coalesce((c->>'qtd')::int, 10);
  alvo int := least(78, greatest(15, round(ref + ((c->>'acima')::numeric - (c->>'abaixo')::numeric) / 2.0)::int));
  posicoes text[] := array['top', 'selva', 'meio', 'atirador', 'suporte'];
  ids bigint[] := '{}';
  comp bigint[];
  achou boolean;
  p int;
  k int;
  quer int;
  tent int;
  novo bigint;
begin
  perform pg_advisory_xact_lock(85117, (oid % 2147483647)::int);
  select true, r.ids, r.comprados into achou, ids, comp from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  if achou and coalesce(array_length(ids, 1), 0) > 0 then
    return coalesce(array(select x from unnest(ids) x where x <> all (comp)), '{}');
  end if;
  -- janela nova (ou vitrine que ficou vazia): descarta as ofertas e os jogadores gerados antes
  delete from tc_mercado_rot where org_id = oid and janela <= jan;
  delete from tc_jogadores where mercado_org = oid and org_id is null;
  ids := '{}';
  perform set_config('tc.mercado', '1', true);
  for p in 1..5 loop
    quer := n / 5 + case when p <= n % 5 then 1 else 0 end;
    for k in 1..quer loop
      tent := 0;
      loop
        novo := (tc_gerar_jogadores(1, alvo, posicoes[p], null))[1];
        update tc_jogadores set mercado_org = oid where id = novo;
        tent := tent + 1;
        exit when tent >= 8 or tc_poder((select j from tc_jogadores j where j.id = novo)) between lo and hi;
        delete from tc_jogadores where id = novo; -- fora da faixa: sorteia outro
      end loop;
      ids := ids || novo;
    end loop;
  end loop;
  perform set_config('tc.mercado', '', true);
  insert into tc_mercado_rot (org_id, janela, ref, ids) values (oid, jan, ref, ids) on conflict (org_id, janela) do update set ids = excluded.ids, ref = excluded.ref, comprados = '{}';
  return ids;
end;
$$;
revoke all on function public.tc_mercado_oferta(bigint) from public, anon, authenticated;

-- As vitrines guardadas são refeitas já com a regra nova (nada é cobrado por oferta).
delete from public.tc_mercado_rot;
