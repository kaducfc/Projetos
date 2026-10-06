-- Passe de Batalha: cada rodada do "Modo Livre" do jogo dos Tamanhos (Escala) rende
-- as abóboras de uma partida (5), respeitando o limite diário. O modo livre não grava
-- resultado no servidor, então o jogo chama esta função ao fim de cada rodada.
-- Proteção: no máximo uma vez a cada 4 segundos por conta (impede uso automático).
-- Rodar de novo é seguro.

alter table public.site_passe_progresso add column if not exists livre_em timestamptz;

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
      total := total + site_passe_dar_aboboras(uid, p.id, p.abobora_por_partida);
      update site_passe_progresso set livre_em = now() where user_id = uid and passe = p.id;
    end if;
  end loop;
  return total;
end;
$$;
revoke all on function public.site_passe_livre(text) from public, anon;
grant execute on function public.site_passe_livre(text) to authenticated;
