-- Loja do Mercado oficial: só aparecem jogadores dentro da faixa de Poder (5 abaixo a 10 acima da média dos titulares). Antes, se faltassem
-- jogadores na faixa a loja completava com os mais próximos de fora dela; agora mostra menos jogadores em vez de passar da faixa.
-- As ofertas já guardadas são descartadas para valer a regra agora (nada é cobrado por oferta).
-- Rode depois da 0142; seguro rodar de novo.

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
begin
  perform pg_advisory_xact_lock(85117, (oid % 2147483647)::int);
  select r.ids into ids from tc_mercado_rot r where r.org_id = oid and r.janela = jan;
  if ids is not null then return ids; end if;
  delete from tc_mercado_rot where org_id = oid and janela < jan - 1;
  n := (c->>'min')::int + (abs(hashtextextended('n:' || jan::text || ':' || oid::text, 0)) % ((c->>'max')::int - (c->>'min')::int + 1))::int;
  perform tc_reabastecer();
  -- escolha: primeiro os que estão na faixa, variando as posições; se faltar, os mais próximos da faixa
  select coalesce(array_agg(x.id order by x.ordem), '{}') into ids from (
    select s.id, row_number() over (order by s.fora, s.rn, s.h) as ordem
      from (
        select j.id,
               (case when tc_poder(j) between lo and hi then 0 else 1 end) as fora,
               row_number() over (partition by (tc_poder(j) between lo and hi), j.pos
                                  order by case when tc_poder(j) between lo and hi then 0 else least(abs(tc_poder(j) - lo), abs(tc_poder(j) - hi)) end,
                                           hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 0)) as rn,
               hashtextextended(j.id::text || ':' || jan::text || ':' || oid::text, 1) as h
          from tc_jogadores j where j.org_id is null and j.ficticio and tc_poder(j) between lo and hi -- só a faixa: nunca completa com jogador de fora dela
      ) s
  ) x where x.ordem <= n;
  insert into tc_mercado_rot (org_id, janela, ref, ids) values (oid, jan, ref, ids) on conflict (org_id, janela) do nothing;
  return ids;
end;
$$;
revoke all on function public.tc_mercado_oferta(bigint) from public, anon, authenticated;

delete from public.tc_mercado_rot;
