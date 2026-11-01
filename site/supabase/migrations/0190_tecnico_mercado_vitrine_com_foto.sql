-- Mercado oficial: TODO jogador da vitrine tem foto (nunca avatar desenhado). Rodar depois da 0189. Rodar de novo é seguro.
--
-- A 0189 criou a vitrine individual de 10 jogadores por técnico, mas sem foto. Agora cada jogador da vitrine recebe uma das 60 fotos do
-- jogo, do gênero dele, sem repetir foto dentro da mesma vitrine. Jogador comum pode se repetir entre técnicos, então a mesma foto pode
-- aparecer na vitrine de outro técnico (o jogador é marcado como cópia, que é o que permite repetir foto). Quem contratar leva a foto.
-- As vitrines guardadas são refeitas agora (nada é cobrado por oferta).

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
  g text;
  foto text;
  usadas text[];
begin
  perform pg_advisory_xact_lock(85117, (oid % 2147483647)::int);
  select true, r.ids, r.comprados into achou, ids, comp from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  if achou and coalesce(array_length(ids, 1), 0) > 0 then
    return coalesce(array(select x from unnest(ids) x where x <> all (comp)), '{}');
  end if;
  -- janela nova (ou vitrine que ficou vazia): descarta as ofertas e os jogadores gerados antes
  perform tc_reabastecer(); -- o estoque compartilhado (candidatos do elenco inicial, equipes do sistema) continua sendo mantido, como antes
  delete from tc_mercado_rot where org_id = oid and janela <= jan;
  delete from tc_jogadores where mercado_org = oid and org_id is null;
  ids := '{}';
  usadas := '{}';
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
      -- foto: toda a vitrine tem foto. Sorteia entre as fotos do gênero que ainda não apareceram nesta vitrine; a mesma foto
      -- pode aparecer em vitrines de outros técnicos (jogador comum pode se repetir), por isso o jogador é marcado como cópia.
      g := tc_genero_do_jogador(novo);
      select c.path into foto from (
        select '/jogos/tecnico/img/retratos/' || lower(g) || lpad(i::text, 2, '0') || '.webp' as path
          from generate_series(1, tc_retratos_total(g)) i
      ) c where c.path <> all (usadas) order by hashtextextended(c.path || ':' || novo::text || ':' || jan::text, 0) limit 1;
      update tc_jogadores set genero = g, retrato = foto, copia_sistema = true where id = novo;
      usadas := usadas || foto;
      ids := ids || novo;
    end loop;
  end loop;
  perform set_config('tc.mercado', '', true);
  insert into tc_mercado_rot (org_id, janela, ref, ids) values (oid, jan, ref, ids) on conflict (org_id, janela) do update set ids = excluded.ids, ref = excluded.ref, comprados = '{}';
  return ids;
end;
$$;
revoke all on function public.tc_mercado_oferta(bigint) from public, anon, authenticated;

-- Vitrines antigas (sem foto) saem; a próxima abertura do mercado gera as novas, já com foto.
delete from public.tc_mercado_rot;
delete from public.tc_jogadores where mercado_org is not null and org_id is null;
