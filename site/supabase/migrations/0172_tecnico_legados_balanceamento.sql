-- Simulador de Técnico: reequilíbrio dos 110 Legados. Rode depois do 0171. Idempotente (rodar de novo aplica os mesmos números).
--  * OVR inicial (Poder) entre 55 (mais fraco) e 90 (Faker, o único com 90); cada Legado ainda sobe até +15 treinando (limite = OVR inicial + 15, no máximo 100).
--  * Pontuação = 25% desempenho em 2026 + 20% resultados de 2023 a 2025 + 35% carreira (quantidade e importância dos títulos: Worlds, MSI, ligas,
--    finais perdidas e prêmios individuais) + 20% popularidade/hype. A popularidade também vira a Fama.
--  * Raridade pelo ranking da pontuação dentro da posição: 2 míticos, 4 lendários, 4 épicos, 6 raros e 6 comuns em cada uma das 5 posições
--    (10 / 20 / 20 / 30 / 30 no total). O OVR vai de 87-90 (mítico; só o 1º do ranking geral tem 90), 80-86, 73-79, 64-72 e 55-63 (comum).
--    O formato dos atributos de cada jogador (pontos fortes e fracos) foi mantido, só o nível mudou.
--  * Quem já tem um Legado na organização (cópia) mantém o que ganhou treinando: a cópia recebe os atributos novos mais a diferença que treinou.
--    O limite de treino de todas as cópias passa a ser o OVR inicial novo + 15 (poder_inicial).

begin;

create temp table _leg (nome text primary key, mec int, rotas int, macro int, tf int, mental int, fama int, potencial int, ovr int, raridade text) on commit drop;
insert into _leg values
    ('Doran', 83, 83, 82, 84, 83, 62, 89, 83, 'lendario'),
    ('Oner', 89, 85, 89, 90, 87, 75, 98, 88, 'mitico'),
    ('Faker', 89, 86, 92, 91, 93, 100, 93, 90, 'mitico'),
    ('Peyz', 87, 85, 81, 84, 82, 76, 99, 84, 'lendario'),
    ('Keria', 90, 89, 90, 89, 87, 84, 98, 89, 'mitico'),
    ('Kiin', 88, 88, 86, 86, 87, 66, 91, 87, 'mitico'),
    ('Canyon', 89, 85, 89, 89, 87, 78, 96, 88, 'mitico'),
    ('Chovy', 91, 90, 86, 86, 86, 88, 96, 88, 'mitico'),
    ('Ruler', 89, 88, 86, 89, 88, 80, 92, 88, 'mitico'),
    ('Duro', 82, 81, 82, 83, 81, 62, 91, 82, 'lendario'),
    ('Zeus', 92, 88, 84, 89, 85, 80, 99, 88, 'mitico'),
    ('Kanavi', 87, 84, 87, 87, 84, 76, 94, 86, 'lendario'),
    ('Zeka', 86, 82, 82, 86, 83, 78, 94, 84, 'lendario'),
    ('Gumayusi', 90, 87, 88, 91, 89, 84, 98, 89, 'mitico'),
    ('Delight', 82, 80, 83, 84, 81, 70, 91, 82, 'lendario'),
    ('Zest', 70, 69, 68, 69, 69, 55, 81, 69, 'raro'),
    ('Curse', 63, 61, 62, 62, 61, 52, 76, 62, 'comum'),
    ('Feisty', 62, 60, 59, 60, 58, 48, 72, 60, 'comum'),
    ('Duduhh', 70, 67, 66, 69, 67, 55, 83, 68, 'raro'),
    ('Ackerman', 61, 60, 62, 61, 62, 50, 71, 61, 'comum'),
    ('Guigo', 70, 68, 66, 68, 67, 55, 77, 68, 'raro'),
    ('Tatu', 79, 77, 78, 78, 77, 60, 93, 78, 'epico'),
    ('Tutsz', 68, 68, 66, 66, 66, 50, 77, 67, 'raro'),
    ('Ayu', 76, 73, 71, 76, 73, 55, 88, 74, 'epico'),
    ('Jojo', 70, 70, 70, 70, 70, 50, 74, 70, 'raro'),
    ('Xyno', 60, 60, 58, 59, 58, 52, 74, 59, 'comum'),
    ('Sinatra', 59, 57, 58, 58, 57, 48, 73, 58, 'comum'),
    ('Kaze', 74, 74, 72, 72, 73, 55, 88, 73, 'epico'),
    ('Rabelo', 58, 56, 56, 57, 57, 50, 69, 57, 'comum'),
    ('uZent', 56, 56, 56, 56, 56, 50, 70, 56, 'comum'),
    ('Siwoo', 67, 66, 65, 66, 65, 55, 81, 66, 'raro'),
    ('Lucid', 72, 69, 72, 72, 70, 62, 85, 71, 'raro'),
    ('ShowMaker', 80, 79, 78, 79, 79, 80, 85, 79, 'epico'),
    ('Smash', 74, 72, 72, 74, 72, 58, 88, 73, 'epico'),
    ('Career', 66, 65, 67, 66, 65, 52, 78, 66, 'raro'),
    ('PerfecT', 73, 72, 71, 72, 71, 55, 84, 72, 'raro'),
    ('Cuzz', 77, 74, 77, 77, 75, 62, 82, 76, 'epico'),
    ('Bdd', 78, 75, 75, 75, 76, 70, 80, 76, 'epico'),
    ('Jiwoo', 65, 63, 63, 65, 63, 50, 76, 64, 'raro'),
    ('Effort', 64, 63, 65, 64, 64, 52, 72, 64, 'raro'),
    ('Breathe', 76, 75, 74, 75, 75, 50, 83, 75, 'epico'),
    ('Tarzan', 83, 82, 84, 83, 82, 72, 87, 83, 'lendario'),
    ('Shanks', 71, 69, 69, 70, 69, 58, 78, 70, 'raro'),
    ('Hope', 70, 68, 68, 70, 68, 58, 75, 69, 'raro'),
    ('Kael', 76, 75, 77, 76, 76, 55, 88, 76, 'epico'),
    ('ZUIAN', 83, 81, 79, 82, 80, 60, 95, 81, 'lendario'),
    ('Tian', 81, 78, 81, 81, 79, 65, 86, 80, 'lendario'),
    ('Creme', 69, 67, 67, 68, 67, 55, 80, 68, 'raro'),
    ('JackeyLove', 85, 82, 81, 85, 82, 85, 91, 83, 'lendario'),
    ('Zhuo', 61, 60, 62, 61, 61, 52, 69, 61, 'comum'),
    ('TheShy', 86, 83, 81, 84, 79, 90, 89, 83, 'lendario'),
    ('Wei', 77, 75, 76, 77, 75, 70, 86, 76, 'epico'),
    ('Rookie', 81, 80, 82, 81, 82, 85, 84, 81, 'lendario'),
    ('JiaQi', 66, 64, 64, 66, 64, 55, 77, 65, 'raro'),
    ('Meiko', 80, 80, 83, 80, 82, 78, 84, 81, 'lendario'),
    ('Bin', 87, 85, 83, 86, 83, 75, 95, 85, 'lendario'),
    ('Xun', 85, 83, 84, 85, 83, 70, 93, 84, 'lendario'),
    ('Knight', 87, 85, 85, 86, 85, 82, 92, 86, 'lendario'),
    ('Viper', 87, 84, 83, 86, 84, 80, 91, 85, 'lendario'),
    ('ON', 87, 86, 88, 87, 87, 65, 97, 87, 'mitico'),
    ('Boal', 58, 56, 54, 56, 55, 52, 66, 56, 'comum'),
    ('CarioK', 69, 66, 70, 68, 67, 70, 74, 68, 'raro'),
    ('Namiru', 57, 55, 54, 55, 53, 55, 70, 55, 'comum'),
    ('Hena', 57, 55, 55, 57, 55, 55, 60, 56, 'comum'),
    ('Ceos', 66, 65, 67, 66, 67, 62, 69, 66, 'raro'),
    ('zynts', 61, 59, 57, 59, 57, 50, 74, 59, 'comum'),
    ('STEPZ', 68, 66, 67, 67, 66, 62, 82, 67, 'raro'),
    ('Fuuu', 60, 58, 56, 58, 57, 55, 68, 58, 'comum'),
    ('Morttheus', 67, 64, 63, 66, 64, 60, 74, 65, 'raro'),
    ('Manel', 56, 55, 57, 56, 56, 48, 71, 56, 'comum'),
    ('Dhokla', 68, 66, 66, 68, 66, 58, 70, 67, 'raro'),
    ('Inspired', 64, 62, 64, 63, 62, 72, 72, 63, 'comum'),
    ('Saint', 71, 69, 67, 70, 68, 58, 83, 69, 'raro'),
    ('Berserker', 80, 77, 75, 80, 77, 72, 88, 78, 'epico'),
    ('Isles', 66, 65, 68, 66, 66, 55, 74, 66, 'raro'),
    ('Morgan', 64, 62, 60, 62, 61, 55, 70, 62, 'comum'),
    ('Josedeodo', 71, 70, 73, 71, 70, 60, 77, 71, 'raro'),
    ('Quid', 72, 70, 68, 70, 68, 68, 82, 70, 'raro'),
    ('Yeon', 67, 64, 63, 66, 64, 55, 74, 65, 'raro'),
    ('CoreJJ', 81, 80, 85, 82, 83, 78, 85, 82, 'lendario'),
    ('Thanatos', 64, 62, 60, 62, 60, 56, 74, 62, 'comum'),
    ('Blaber', 71, 70, 73, 71, 70, 82, 77, 71, 'raro'),
    ('Loki', 61, 60, 57, 60, 57, 55, 73, 59, 'comum'),
    ('Tactical', 58, 56, 56, 58, 56, 55, 63, 57, 'comum'),
    ('Vulcan', 73, 73, 76, 74, 74, 62, 80, 74, 'epico'),
    ('Impact', 79, 78, 79, 80, 80, 82, 82, 79, 'epico'),
    ('HamBak', 60, 58, 59, 60, 57, 52, 68, 59, 'comum'),
    ('DARKWINGS', 56, 55, 54, 55, 54, 50, 61, 55, 'comum'),
    ('Rahel', 60, 58, 55, 60, 56, 55, 70, 58, 'comum'),
    ('huhi', 64, 64, 67, 64, 66, 65, 68, 65, 'raro'),
    ('BrokenBlade', 73, 72, 71, 73, 71, 70, 78, 72, 'raro'),
    ('SkewMond', 76, 75, 76, 75, 74, 60, 87, 75, 'epico'),
    ('Caps', 86, 84, 85, 86, 84, 92, 91, 85, 'lendario'),
    ('Hans Sama', 78, 76, 75, 78, 77, 80, 81, 77, 'epico'),
    ('Labrov', 77, 76, 78, 77, 78, 62, 86, 77, 'epico'),
    ('Myrwn', 63, 61, 59, 61, 59, 58, 71, 61, 'comum'),
    ('Elyoya', 63, 61, 65, 63, 62, 66, 69, 63, 'comum'),
    ('Jojopyun', 77, 75, 73, 76, 73, 70, 87, 75, 'epico'),
    ('Supa', 61, 59, 59, 61, 59, 55, 68, 60, 'comum'),
    ('Alvaro', 60, 59, 62, 60, 60, 55, 70, 60, 'comum'),
    ('Canna', 78, 77, 76, 78, 76, 70, 83, 77, 'epico'),
    ('Yike', 71, 71, 72, 71, 70, 60, 79, 71, 'raro'),
    ('kyeahoo', 72, 70, 68, 71, 68, 55, 84, 70, 'raro'),
    ('Caliste', 82, 80, 77, 82, 77, 72, 95, 80, 'lendario'),
    ('Busio', 74, 73, 75, 74, 75, 62, 86, 74, 'epico'),
    ('Naak Nako', 80, 78, 76, 78, 76, 68, 92, 78, 'epico'),
    ('Lyncas', 62, 62, 62, 62, 61, 52, 74, 62, 'comum'),
    ('FIESTA', 63, 61, 59, 62, 59, 55, 71, 61, 'comum'),
    ('Carzzy', 58, 57, 55, 58, 56, 52, 66, 57, 'comum'),
    ('Fleshy', 57, 56, 58, 57, 58, 52, 65, 57, 'comum');

-- 1. cópias de quem já recrutou (precisa dos valores antigos do jogador-base)
update tc_jogadores i set
  mec = least(100, greatest(1, l.mec + (i.mec - b.mec))), rotas = least(100, greatest(1, l.rotas + (i.rotas - b.rotas))),
  macro = least(100, greatest(1, l.macro + (i.macro - b.macro))), tf = least(100, greatest(1, l.tf + (i.tf - b.tf))),
  mental = least(100, greatest(1, l.mental + (i.mental - b.mental))),
  fama = l.fama, potencial = l.potencial, raridade = l.raridade, poder_inicial = l.ovr
from tc_jogadores b join _leg l on lower(b.nome) = lower(l.nome)
where i.legado_base = b.id and b.legado_base is null and not b.ficticio;

-- 2. os jogadores-base do catálogo dos baús
update tc_jogadores b set
  mec = l.mec, rotas = l.rotas, macro = l.macro, tf = l.tf, mental = l.mental,
  fama = l.fama, potencial = l.potencial, raridade = l.raridade, poder_inicial = l.ovr
from _leg l
where lower(b.nome) = lower(l.nome) and b.legado_base is null and not b.ficticio;

commit;
