-- Simulador de Técnico: novas chances dos baús (cada uma soma 100%).
--   Básico:  Comum 55 · Raro 30 · Épico 11,5 · Lendário 3 · Mítico 0,5
--   Premium: Comum 24 · Raro 38 · Épico 28 · Lendário 8 · Mítico 2
-- Rode depois da 0177. Idempotente.
update public.tc_config
   set valor = jsonb_set(jsonb_set(valor,
         '{baus,basico,odds}', '{"comum": 55, "raro": 30, "epico": 11.5, "lendario": 3, "mitico": 0.5}'::jsonb),
         '{baus,premium,odds}', '{"comum": 24, "raro": 38, "epico": 28, "lendario": 8, "mitico": 2}'::jsonb)
 where chave = 'gacha';
