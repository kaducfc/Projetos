-- Passe de Batalha: nível 0. O passe já começa no nível 0, com uma recompensa
-- GRÁTIS liberada desde o primeiro dia; os níveis 1 a 15 continuam como antes.
-- Total: 16 recompensas, alternando grátis (níveis pares: 0, 2, 4…) e premium
-- (ímpares: 1, 3, 5… até o 15).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em
-- Run (depois da 0040). Rodar de novo é seguro.

alter table public.site_passe_niveis drop constraint if exists site_passe_niveis_nivel_check;
alter table public.site_passe_niveis add constraint site_passe_niveis_nivel_check check (nivel >= 0);

-- Nível 0 do Halloween 2026: 500 RC, grátis (só entra se ainda não existir).
insert into public.site_passe_niveis (passe, nivel, trilha, tipo, chave)
values ('halloween-2026', 0, 'gratis', 'moeda', '500')
on conflict (passe, nivel) do nothing;
