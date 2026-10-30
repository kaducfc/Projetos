-- Passe de Batalha "Zaun e Piltover" (próxima temporada), em TESTE: só administradores acumulam
-- engrenagens e resgatam (publico = false e sem datas). No lançamento rode
-- supabase/lancamento/03_lancar_passe_zaun_piltover.sql (publica, define as datas e leva as molduras e o efeito para todos).
--   * 15 níveis, 100 engrenagens por nível, limite de 150 por dia (as colunas ainda se chamam "abobora_*").
--   * Duração: 20 dias (01/11/2026 a 20/11/2026, no lançamento). Premium: R$ 25 (Edge Function passe-premium-criar).
--   * Ímpares = premium, pares = grátis. Premium: Moldura Canos de Zaun (3), Efeito Código Verde (9),
--     Moldura Mecanismo Arcano (15); os outros níveis são Rift Coins provisórios (premium 500, grátis 300).
-- Também: site_passe_estado passa a devolver as datas do passe (inicio e fim) e nasce site_passe_atual(),
-- que diz qual é o passe público do momento (a página /passe/ usa para trocar de temporada sozinha).
-- Rodar depois da 0199. Rodar de novo é seguro.

insert into public.site_passes (id, nome, niveis, abobora_por_nivel, abobora_por_partida, limite_dia, publico)
values ('zaun-piltover-2026', 'Zaun e Piltover', 15, 100, 5, 150, false)
on conflict (id) do update set nome = excluded.nome, niveis = excluded.niveis;

insert into public.site_passe_niveis (passe, nivel, trilha, tipo, chave) values
  ('zaun-piltover-2026', 1,  'premium', 'moeda',   '500'),
  ('zaun-piltover-2026', 2,  'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 3,  'premium', 'moldura', 'mn-zaun'),
  ('zaun-piltover-2026', 4,  'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 5,  'premium', 'moeda',   '500'),
  ('zaun-piltover-2026', 6,  'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 7,  'premium', 'moeda',   '500'),
  ('zaun-piltover-2026', 8,  'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 9,  'premium', 'efeito',  'gl-matrix'),
  ('zaun-piltover-2026', 10, 'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 11, 'premium', 'moeda',   '500'),
  ('zaun-piltover-2026', 12, 'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 13, 'premium', 'moeda',   '500'),
  ('zaun-piltover-2026', 14, 'gratis',  'moeda',   '300'),
  ('zaun-piltover-2026', 15, 'premium', 'moldura', 'mn-mecanismo')
on conflict (passe, nivel) do update set trilha = excluded.trilha, tipo = excluded.tipo, chave = excluded.chave;

-- O efeito Código Verde (gl-matrix) e as molduras de teste: administradores já podem equipar o que ganharem.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', m.chave, 'admin' from public.site_admins a
 cross join (values ('mn-zaun'), ('mn-mecanismo')) as m(chave)
on conflict do nothing;

-- site_passe_estado: devolve também as datas do passe.
do $$
declare
  def text;
  f constant text := 'public.site_passe_estado(text)';
  velho constant text := '''publico'', p.publico)';
  novo constant text := '''publico'', p.publico, ''inicio'', p.inicio, ''fim'', p.fim)';
begin
  if to_regprocedure(f) is null then raise exception 'não achei site_passe_estado'; end if;
  def := pg_get_functiondef(to_regprocedure(f));
  if position('''fim'', p.fim' in def) = 0 then
    if position(velho in def) = 0 then raise exception 'não achei o objeto do passe em site_passe_estado'; end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- Qual é o passe público do momento (o mais recente que já começou e ainda não acabou). Null: nenhum.
create or replace function public.site_passe_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.id from site_passes p
   where p.publico
     and (p.inicio is null or p.inicio <= site_hoje_br())
     and (p.fim is null or p.fim >= site_hoje_br())
   order by p.inicio desc nulls last, p.criado desc
   limit 1;
$$;
revoke all on function public.site_passe_atual() from public, anon;
grant execute on function public.site_passe_atual() to authenticated;
