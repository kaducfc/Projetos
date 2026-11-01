-- Simulador de Técnico: jogadores Estrela só saem do mercado oficial por RC (e, depois, pelo gacha).
-- Rode depois do 0095. Idempotente.
--
--  * Contratar uma Estrela com créditos é recusado (estrela_so_rc), por qualquer caminho.
--  * tc_contratar_estrela(jogador, semanas, chave) paga em RC (carteira oficial) e fecha o contrato.
--  * Preço e liga/desliga em tc_config.estrelas: {"preco_rc": 5000, "venda_rc": true}.
--  * O gacha (futuro) libera a Estrela do mesmo jeito: set_config('tc.estrela_liberada', <id>, true) antes do update.
--  * Depois de contratada, a Estrela segue as regras normais (renovação e salário em créditos; venda entre técnicos em RC).

insert into public.tc_config (chave, valor) values ('estrelas', '{"preco_rc": 5000, "venda_rc": true}'::jsonb)
on conflict (chave) do nothing;

-- Trava: Estrela sem dono só entra numa organização se a função de RC (ou o gacha) liberou aquele jogador.
create or replace function public.tc_estrela_so_rc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.ficticio and old.org_id is null and new.org_id is not null
     and coalesce(current_setting('tc.estrela_liberada', true), '') <> new.id::text then
    raise exception 'estrela_so_rc';
  end if;
  return new;
end;
$$;
revoke all on function public.tc_estrela_so_rc() from public, anon, authenticated;
drop trigger if exists tc_estrela_so_rc on public.tc_jogadores;
create trigger tc_estrela_so_rc before update of org_id on public.tc_jogadores
  for each row execute function public.tc_estrela_so_rc();

-- Preço em RC de uma Estrela no mercado oficial (null para os demais).
create or replace function public.tc_estrela_preco_rc(j tc_jogadores)
returns bigint language sql stable security definer set search_path = public as $$
  select case when j.ficticio then null else ((tc_cfg('estrelas'))->>'preco_rc')::bigint end;
$$;
revoke all on function public.tc_estrela_preco_rc(tc_jogadores) from public, anon, authenticated;

-- Mesmo JSON do 0085, com `estrela` e `preco_rc`.
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
    'preco', tc_preco(p, j.potencial, j.fama, j.idade),
    'estrela', not j.ficticio,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;

-- Contratação de uma Estrela do mercado oficial, paga em RC. Atômica e idempotente (mesma `chave` = mesmo resultado).
create or replace function public.tc_contratar_estrela(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  cfg jsonb := tc_cfg('estrelas');
  preco bigint;
  sal int;
  ant jsonb;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select jsonb_build_object('ja_feito', true, 'jogador', jogador_id) into ant from tc_transf where user_id = uid and chave = chave_;
  if ant is not null then return ant; end if;
  if not coalesce((cfg->>'venda_rc')::boolean, false) then raise exception 'estrela_venda_fechada'; end if;
  if semanas is null or semanas < (el->>'contrato_min')::int or semanas > (el->>'contrato_max')::int then
    raise exception 'contrato_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.ficticio then raise exception 'nao_e_estrela'; end if;
  if j.org_id is not null then raise exception 'jogador_indisponivel'; end if;
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then raise exception 'elenco_cheio'; end if;
  preco := tc_estrela_preco_rc(j);
  if preco is null or preco <= 0 then raise exception 'estrela_venda_fechada'; end if;
  -- a carteira oficial confere o saldo; faltando RC, nada acontece
  perform site_moedas_mexer(uid, -preco, 'tecnico_estrela', left('estrela:' || j.id::text, 200));
  sal := tc_salario(tc_preco_jogador(j));
  perform set_config('tc.estrela_liberada', j.id::text, true);
  update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = tc_semana_global() + semanas where id = j.id;
  perform set_config('tc.estrela_liberada', '', true);
  insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, 'contratacao', preco, 'rc', sal, tc_semana_global() + semanas, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco_rc', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar_estrela(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar_estrela(bigint, int, text) to authenticated;
