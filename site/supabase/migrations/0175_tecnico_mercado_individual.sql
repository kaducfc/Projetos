-- Mercado oficial individual + regras do mercado entre técnicos mais leves.
--  * Cada técnico tem a sua própria vitrine no Mercado oficial: contratar um jogador dela cria uma CÓPIA para o comprador
--    (o original continua livre para os outros). Não há mais disputa por jogador; só o Mercado de RC (entre técnicos) tem.
--  * A cópia some quando o jogador é demitido/liberado (volta para ninguém; o original segue no mercado).
--  * Mercado entre técnicos: sem idade mínima de conta; recompra do mesmo jogador só depois de 7 dias (antes 14).
-- Rodar depois da 0174. Rodar de novo é seguro.

alter table public.tc_jogadores add column if not exists clone_mercado boolean not null default false;
alter table public.tc_mercado_rot add column if not exists comprados bigint[] not null default '{}';

update public.tc_config set valor = jsonb_set(jsonb_set(valor, '{conta_dias_min}', '0'::jsonb), '{recompra_dias}', '7'::jsonb) where chave = 'mercado_regras';

-- A cópia deixa de existir quando sai do elenco (qualquer caminho: demitir, liberar, contrato vencido...). Roda no fim da transação,
-- depois que o histórico da saída já foi gravado.
create or replace function public.tc_clone_mercado_sumir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from tc_jogadores where id = new.id and org_id is null and clone_mercado;
  return null;
end;
$$;
revoke all on function public.tc_clone_mercado_sumir() from public, anon, authenticated;
drop trigger if exists tc_clone_mercado_sumir on public.tc_jogadores;
create constraint trigger tc_clone_mercado_sumir after update of org_id on public.tc_jogadores
  deferrable initially deferred for each row when (new.org_id is null and new.clone_mercado)
  execute function public.tc_clone_mercado_sumir();

-- Oferta da janela: igual à 0143, mas (a) tira da vitrine o que este técnico já comprou e (b) não repete quem ele já tem em cópia.
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
  comp bigint[];
  achou boolean;
begin
  perform pg_advisory_xact_lock(85117, (oid % 2147483647)::int);
  select true, r.ids, r.comprados into achou, ids, comp from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  if achou then return coalesce(array(select x from unnest(ids) x where x <> all (comp)), '{}'); end if;
  delete from tc_mercado_rot where org_id = oid and janela < jan - 1;
  n := (c->>'min')::int + (abs(hashtextextended('n:' || jan::text || ':' || oid::text, 0)) % ((c->>'max')::int - (c->>'min')::int + 1))::int;
  perform tc_reabastecer();
  select coalesce(array_agg(x.id order by x.ordem), '{}') into ids from (
    select s.id, row_number() over (order by s.fora, s.rn, s.h) as ordem
      from (
        select j.id,
               0 as fora,
               row_number() over (partition by j.pos order by hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 0)) as rn,
               hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 1) as h
          from tc_jogadores j
         where j.org_id is null and j.ficticio and tc_poder(j) between lo and hi
           and not exists (select 1 from tc_jogadores m where m.org_id = oid and m.clone_mercado and lower(m.nome) = lower(j.nome))
      ) s
  ) x where x.ordem <= n;
  insert into tc_mercado_rot (org_id, janela, ref, ids) values (oid, jan, ref, ids) on conflict (org_id, janela) do nothing;
  return ids;
end;
$$;
revoke all on function public.tc_mercado_oferta(bigint) from public, anon, authenticated;

-- Contratação do mercado oficial: só quem está na vitrine do técnico; cria uma cópia para ele.
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
  nj.copia_sistema := true; nj.clone_mercado := true; nj.criado := now();
  insert into tc_jogadores select nj.*;
  update tc_mercado_rot set comprados = array_append(comprados, j.id) where org_id = o.id and janela = tc_mercado_janela();
  insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (nj.id, o.id, 'contratacao', preco, sal, null, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', nj.id, 'preco', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar(bigint, int, text) to authenticated;
