-- Simulador de Técnico: baús mais baratos em RC: Básico 400 RC e Premium 800 RC (cada). O pacote x5 mantém o desconto de 15%.
-- Rode depois da 0175. Idempotente.
update public.tc_config
   set valor = jsonb_set(jsonb_set(valor, '{baus,basico,rc}', '400'), '{baus,premium,rc}', '800')
 where chave = 'gacha';
