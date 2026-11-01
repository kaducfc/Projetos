-- Simulador de Técnico: o time novo começa com 15 jogadores fictícios (3 por posição) em vez de 5. Rode depois do 0107. Idempotente.
-- O melhor de cada posição já começa como titular; os outros 10 ficam no elenco para o técnico escolher.
-- Contrato inicial de cortesia (12 semanas, sem custo). Contas já criadas não mudam.

create or replace function public.tc_elenco_inicial(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text;
  i int;
  ids bigint[];
  semana int := tc_semana_global();
  j tc_jogadores;
  melhor bigint;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    for i in 1..3 loop
      ids := tc_gerar_jogadores(1, 42, v, oid);
      update tc_jogadores set slot = null, salario = tc_salario(tc_preco_jogador(tc_jogadores)),
             contrato_fim = semana + 12, contrato_valor_semana = 0, forma = 50, fama = least(fama, 25)
       where id = ids[1];
      select * into j from tc_jogadores where id = ids[1];
      insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim)
      values (j.id, oid, 'inicial', 0, j.salario, j.contrato_fim);
    end loop;
    -- titular: o de maior soma de atributos que joga nessa posição
    select id into melhor from tc_jogadores where org_id = oid and slot is null and pos = v
     order by (mec + rotas + macro + tf + mental) desc, id limit 1;
    update tc_jogadores set slot = v where id = melhor;
  end loop;
end;
$$;
revoke all on function public.tc_elenco_inicial(bigint) from public, anon, authenticated;

-- Fotos: o time novo só ganha foto enquanto sobrarem pelo menos `reserva_mercado` retratos livres (o resto fica para o mercado).
-- Sem foto, o jogador usa o avatar desenhado.
insert into public.tc_config (chave, valor) values ('retratos', '{"reserva_mercado": 30}'::jsonb) on conflict (chave) do nothing;

create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  livres int;
begin
  if new.ficticio and new.retrato is null then
    new.genero := tc_genero_do_jogador(new.id);
    -- equipes do sistema não gastam retrato (ficam com o avatar desenhado)
    if new.org_id is null or not exists (select 1 from tc_orgs where id = new.org_id and user_id is null) then
      perform pg_advisory_xact_lock(85107);
      if new.org_id is not null then
        select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null;
        if livres <= coalesce(((tc_cfg('retratos'))->>'reserva_mercado')::int, 30) then return new; end if;
      end if;
      new.retrato := tc_retrato_livre(new.id, new.genero);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_retrato_auto() from public, anon, authenticated;
