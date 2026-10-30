-- Simulador de Técnico: corrige a idade dos 30 jogadores Legado antigos (Coreia e Brasil), conferida na Leaguepedia em out/2026. Rode depois do 0146.
-- Atualiza o catálogo e também as cópias que os técnicos já têm (a idade não avança sozinha no jogo). Idempotente.

update tc_jogadores j
   set idade = v.idade
  from (values
    ('Doran', 26),
    ('Oner', 23),
    ('Faker', 30),
    ('Peyz', 20),
    ('Keria', 24),
    ('Kiin', 27),
    ('Canyon', 25),
    ('Chovy', 25),
    ('Ruler', 27),
    ('Duro', 24),
    ('Zeus', 22),
    ('Kanavi', 25),
    ('Zeka', 23),
    ('Gumayusi', 24),
    ('Delight', 24),
    ('Zest', 22),
    ('Curse', 21),
    ('Feisty', 22),
    ('Duduhh', 18),
    ('Ackerman', 23),
    ('Guigo', 24),
    ('Tatu', 20),
    ('Tutsz', 23),
    ('Ayu', 21),
    ('Jojo', 27),
    ('Xyno', 19),
    ('Sinatra', 19),
    ('Kaze', 20),
    ('Rabelo', 22),
    ('uZent', 21)
  ) as v(nome, idade)
 where lower(j.nome) = lower(v.nome) and not j.ficticio and j.idade <> v.idade;
