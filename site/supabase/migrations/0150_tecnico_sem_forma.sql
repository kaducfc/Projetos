-- Simulador de Técnico: a forma (sobe 4 a cada vitória e desce 4 a cada derrota) deixa de influenciar o Poder. Rode depois do 0149. Idempotente.
-- O valor continua sendo guardado nos jogadores; para voltar a valer, basta:  update tc_config set valor = jsonb_set(valor, '{peso}', '0.04') where chave = 'forma';
update public.tc_config set valor = jsonb_set(valor, '{peso}', '0') where chave = 'forma';
