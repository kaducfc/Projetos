-- Mercado: (1) faixa de Poder da loja -5 a +10 sobre a média dos titulares; (2) jogadores à venda (sem time) não têm Maestria acima do nível 3 em nenhum campeão (máximo de pontos = os da Maestria 4 menos 1).
-- Vale para os jogadores novos do mercado e corrige os que já estão lá. Rode depois da 0141; seguro rodar de novo.

create or replace function public.tc_semear_campeoes(jid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  n int; i int; c text;
  pool text[];
  lim_mercado int := coalesce((tc_cfg('maestria')->'niveis'->>3)::int, 800) - 1; -- jogador à venda no mercado: no máximo Maestria 3 (abaixo dos pontos da Maestria 4)
begin
  select * into j from tc_jogadores where id = jid;
  if j.id is null or not j.ficticio or exists (select 1 from tc_maestria where jogador_id = jid) then return; end if;
  select array_agg(id order by md5(id || ':' || jid::text)) into pool
    from tc_campeoes where ativo and (j.pos = any(posicoes) or posicoes && j.pos2);
  if pool is null then return; end if;
  n := least(array_length(pool, 1), 3 + floor(tc_u('mae:n:' || jid::text, 1) * 3)::int);
  for i in 1..n loop
    c := pool[i];
    insert into tc_maestria (jogador_id, campeao_id, pontos, jogos, vitorias)
      values (jid, c, least(case when j.org_id is null then lim_mercado else 100000 end, greatest(0, round((j.exp * 22 + tc_u('mae:p:' || jid::text, i) * 700) / (1 + (i - 1) * 0.55))::int)), 0, 0);
  end loop;
  perform tc_recalcular_favoritos(jid);
end;
$$;
revoke all on function public.tc_semear_campeoes(bigint) from public, anon, authenticated;

update public.tc_maestria m
   set pontos = coalesce((tc_cfg('maestria')->'niveis'->>3)::int, 800) - 1
  from public.tc_jogadores j
 where j.id = m.jogador_id and j.org_id is null and j.ficticio and m.pontos >= coalesce((tc_cfg('maestria')->'niveis'->>3)::int, 800);

do $$
declare
  j bigint;
begin
  for j in select x.id from public.tc_jogadores x where x.org_id is null and x.ficticio and exists (select 1 from public.tc_maestria m where m.jogador_id = x.id) loop
    perform public.tc_recalcular_favoritos(j);
  end loop;
end;
$$;

-- Faixa de Poder da loja: de 5 abaixo até 10 acima da média dos titulares (ex.: time com 44 vê jogadores de 39 a 54).
update public.tc_config set valor = jsonb_set(jsonb_set(valor, '{abaixo}', '5'::jsonb), '{acima}', '10'::jsonb) where chave = 'mercado_oficial';
