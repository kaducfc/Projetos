-- Passe de Batalha: as abóboras de cada partida passam a ser sorteadas.
--   jogador comum:   de 7 a 10 abóboras por partida
--   Passe Premium:   de 9 a 15 abóboras por partida
-- As regras de quais partidas rendem abóbora e o limite diário continuam iguais. O sorteio
-- é só interno (o site não escreve os valores). No modo Livre do Na Medida, a cada 5 rodadas
-- conta como uma partida (função site_passe_livre, 0057), com o mesmo sorteio.
-- Rodar de novo é seguro.

create or replace function public.site_passe_sorteio(uid uuid, pid text)
returns int
language sql
volatile
security definer
set search_path = public
as $$
  select case
    when coalesce((select g.premium from site_passe_progresso g where g.user_id = uid and g.passe = pid), false)
      then 9 + floor(random() * 7)::int    -- 9 a 15
    else 7 + floor(random() * 4)::int      -- 7 a 10
  end;
$$;
revoke all on function public.site_passe_sorteio(uuid, text) from public, anon, authenticated;

-- Cada partida concluída (linha nova em site_game_results) dá abóboras sorteadas.
create or replace function public.site_passe_ao_concluir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_passes;
begin
  for p in select * from site_passes loop
    if site_passe_acessivel(p, new.user_id) then
      perform site_passe_dar_aboboras(new.user_id, p.id, site_passe_sorteio(new.user_id, p.id));
    end if;
  end loop;
  return new;
exception when others then
  -- Nunca atrapalha o registro da partida.
  return new;
end;
$$;

-- Modo Livre do Na Medida (a cada 5 rodadas, o jogo chama): mesmo sorteio.
create or replace function public.site_passe_livre(jogo text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p site_passes;
  ult timestamptz;
  total int := 0;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo is distinct from 'escala' then
    raise exception 'jogo_invalido';
  end if;
  for p in select * from site_passes loop
    if site_passe_acessivel(p, uid) then
      select livre_em into ult from site_passe_progresso where user_id = uid and passe = p.id;
      if ult is not null and ult > now() - interval '4 seconds' then
        continue;
      end if;
      total := total + site_passe_dar_aboboras(uid, p.id, site_passe_sorteio(uid, p.id));
      update site_passe_progresso set livre_em = now() where user_id = uid and passe = p.id;
    end if;
  end loop;
  return total;
end;
$$;
revoke all on function public.site_passe_livre(text) from public, anon;
grant execute on function public.site_passe_livre(text) to authenticated;
