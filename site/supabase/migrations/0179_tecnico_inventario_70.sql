-- Simulador de Técnico: o inventário passa a comportar até 70 jogadores (antes 50). Rode depois da 0178. Idempotente.
update public.tc_config set valor = jsonb_set(valor, '{max}', '70'::jsonb) where chave = 'elenco';
