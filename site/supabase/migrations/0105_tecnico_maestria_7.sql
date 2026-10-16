-- Simulador de Técnico: maestria com 7 níveis numerados (Maestria 1 a 7), +3% de Poder por nível. Rode depois do 0104. Idempotente.
-- Pontos para cada nível: 0, 150, 400, 800, 1.500, 2.500 e 4.000. Favorito continua exigindo o limiar (150 pontos).
update public.tc_config
   set valor = jsonb_set(jsonb_set(valor, '{niveis}', '[0, 150, 400, 800, 1500, 2500, 4000]'::jsonb), '{bonus_pct}', '[3, 6, 9, 12, 15, 18, 21]'::jsonb)
 where chave = 'maestria';
