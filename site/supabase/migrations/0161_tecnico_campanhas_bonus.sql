-- Simulador de Técnico: bônus das campanhas de marketing ajustados: redes sociais +20%, influenciadores +50%, nacional +75%, internacional +100% (sobre toda a receita). Custos, durações e recargas não mudam. Rode depois do 0160. Idempotente.
update public.tc_config set valor = jsonb_set(valor, '{campanhas}', $json$[
  {"id": "redes_sociais", "nome": "Campanha nas redes sociais", "custo": 2500, "duracao_h": 6, "recarga_h": 12, "bonus": 0.20, "req": {"fama": 0, "nivel": 1}, "efeito": "+20% da receita por 6h"},
  {"id": "influenciadores", "nome": "Campanha com influenciadores", "custo": 18000, "duracao_h": 12, "recarga_h": 24, "bonus": 0.50, "req": {"fama": 100, "nivel": 5}, "efeito": "+50% da receita por 12h"},
  {"id": "nacional", "nome": "Campanha nacional", "custo": 60000, "duracao_h": 24, "recarga_h": 48, "bonus": 0.75, "req": {"fama": 250, "nivel": 10}, "efeito": "+75% da receita por 24h"},
  {"id": "internacional", "nome": "Campanha internacional", "custo": 200000, "duracao_h": 48, "recarga_h": 96, "bonus": 1.00, "req": {"fama": 650, "nivel": 15}, "efeito": "+100% da receita por 48h"}
]$json$::jsonb) where chave = 'marketing';
