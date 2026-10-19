-- Simulador de Técnico: os baús de Recrutar voltam a cobrar em Rift Coins: Básico 500 RC e Premium 1.000 RC (cada), e o pacote x5 com o desconto padrão (15%).
-- Rode depois do 0147. Idempotente. Os preços em créditos continuam guardados (baus.*.creditos), caso queira voltar a cobrar em créditos:
--   update tc_config set valor = jsonb_set(valor, '{moeda}', '"creditos"') where chave = 'gacha';

update public.tc_config
   set valor = jsonb_set(jsonb_set(jsonb_set(jsonb_set(valor, '{moeda}', '"rc"'), '{baus,basico,rc}', '500'), '{baus,premium,rc}', '1000'), '{desconto_5}', '0.15')
 where chave = 'gacha';
