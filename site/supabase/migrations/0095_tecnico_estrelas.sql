-- Simulador de Técnico: primeiros jogadores "Estrela" (reais, com retrato), sem dono no mercado oficial.
-- T1, Gen.G e HLE. Rode depois do 0094. Idempotente: rodar de novo NÃO mexe em quem já existe
-- (não altera atributos, contrato, forma nem a organização de quem já contratou uma Estrela).

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial
    ('Doran',    'top',      26, 86, 85, 84, 87, 85, 80, 87),
    ('Oner',     'selva',    24, 88, 84, 88, 89, 86, 86, 90),
    ('Faker',    'meio',     30, 93, 90, 97, 95, 98, 100, 96),
    ('Peyz',     'atirador', 21, 91, 89, 85, 88, 86, 82, 95),
    ('Keria',    'suporte',  24, 94, 92, 93, 92, 90, 92, 95),
    ('Kiin',     'top',      27, 90, 91, 88, 88, 89, 86, 90),
    ('Canyon',   'selva',    25, 93, 88, 92, 93, 90, 92, 94),
    ('Chovy',    'meio',     25, 97, 96, 92, 91, 92, 95, 97),
    ('Ruler',    'atirador', 28, 94, 92, 90, 94, 92, 93, 94),
    ('Duro',     'suporte',  23, 85, 84, 85, 86, 84, 74, 89),
    ('Zeus',     'top',      22, 95, 90, 86, 91, 87, 90, 96),
    ('Kanavi',   'selva',    26, 90, 87, 90, 90, 87, 85, 90),
    ('Zeka',     'meio',     24, 91, 87, 87, 92, 88, 86, 92),
    ('Gumayusi', 'atirador', 24, 92, 89, 90, 94, 91, 90, 93),
    ('Delight',  'suporte',  24, 88, 86, 89, 90, 87, 80, 90)
  ) as t(nome, pos, idade, mec, rotas, macro, tf, mental, fama, potencial)
  loop
    select * into ja from tc_jogadores where lower(nome) = lower(e.nome);
    if ja.id is not null and not ja.ficticio then continue; end if; -- já é a Estrela: não mexe
    if ja.id is not null then
      -- um atleta fictício gerado com o mesmo nome: ganha um sufixo para liberar o nome da Estrela
      update tc_jogadores set nome = left(nome, 20) || ' II' where id = ja.id;
    end if;
    insert into tc_jogadores (nome, ficticio, pos, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama)
    values (e.nome, false, e.pos, e.idade, 'KR', '/jogos/tecnico/img/retratos/' || lower(e.nome) || '.webp',
            e.potencial, e.mec, e.rotas, e.macro, e.tf, e.mental, e.fama);
  end loop;
end $$;
