-- Campeão Oculto: a dica extra passa a vir só no Esmeralda (antes: Platina +1 e Esmeralda +1).
-- Total de dicas por dia: 1 (padrão) e 2 do Esmeralda para cima. Rodar depois da 0073. Rodar de novo é seguro.
-- (A mesma função da 0016, só com a conta das dicas.) Partidas de hoje já abertas mantêm as dicas com que abriram.

create or replace function public.site_diario_abrir(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  j text := jogo;
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  d site_diario;
  niv int;
  resp text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if j not in ('runetermo', 'campeao') then
    raise exception 'jogo_invalido';
  end if;
  perform site_rk_processar();
  select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j;
  if d.user_id is null then
    niv := site_rk_nivel_de(uid);
    -- Sorteia uma resposta que a conta não teve nos últimos meses.
    if j = 'runetermo' then
      select chave into resp from site_diario_palavras p
       where not exists (select 1 from site_diario x where x.user_id = uid and x.jogo = 'runetermo' and x.resposta = p.chave and x.dia > hoje - 120)
       order by random() limit 1;
      if resp is null then select chave into resp from site_diario_palavras order by random() limit 1; end if;
    else
      select nome into resp from site_diario_campeoes c
       where not exists (select 1 from site_diario x where x.user_id = uid and x.jogo = 'campeao' and x.resposta = c.nome and x.dia > hoje - 150)
       order by random() limit 1;
      if resp is null then select nome into resp from site_diario_campeoes order by random() limit 1; end if;
    end if;
    if resp is null then
      raise exception 'sem_dados';
    end if;
    insert into site_diario (user_id, dia, jogo, resposta, max_tentativas, max_dicas, categoria)
    values (uid, hoje, j, resp,
            case when j = 'runetermo' then 6 + (niv >= 6)::int else 8 + (niv >= 9)::int end,
            case when j = 'campeao' then 1 + (niv >= 5)::int else 0 end,
            j = 'runetermo' and niv >= 2)
    on conflict (user_id, dia, jogo) do nothing;
    select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j;
  end if;
  return site_diario_json(d);
end;
$$;
revoke all on function public.site_diario_abrir(text) from public, anon;
grant execute on function public.site_diario_abrir(text) to authenticated;
