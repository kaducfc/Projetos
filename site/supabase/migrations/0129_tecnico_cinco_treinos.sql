-- Treinamento: até 5 treinos ao mesmo tempo (antes 3).
-- Rode depois da 0128; seguro rodar de novo.
update public.tc_config set valor = jsonb_set(valor, '{simultaneos}', '5') where chave = 'treino';
