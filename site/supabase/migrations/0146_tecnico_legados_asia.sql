-- Simulador de Técnico: mais 15 jogadores Legado, de três times asiáticos (DK e KT, da Coreia; Anyone's Legend, da China). Rode depois do 0145.
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao
    ('Siwoo',     'top', 23, 86, 85, 83, 85, 84, 76, 88, 'epico', 'KR'),
    ('Lucid',     'selva', 25, 87, 84, 87, 87, 85, 78, 88, 'epico', 'KR'),
    ('ShowMaker', 'meio', 25, 92, 90, 89, 90, 90, 90, 92, 'lendario', 'KR'),
    ('Smash',     'atirador', 23, 86, 84, 83, 86, 84, 70, 89, 'raro', 'KR'),
    ('Career',    'suporte', 22, 85, 84, 86, 85, 84, 64, 89, 'raro', 'KR'),
    ('PerfecT',   'top', 22, 84, 83, 81, 83, 82, 70, 88, 'raro', 'KR'),
    ('Cuzz',      'selva', 26, 88, 85, 88, 88, 86, 80, 88, 'epico', 'KR'),
    ('Bdd',       'meio', 27, 90, 88, 88, 88, 89, 84, 90, 'epico', 'KR'),
    ('Jiwoo',     'atirador', 23, 85, 83, 82, 85, 83, 66, 88, 'raro', 'KR'),
    ('Effort',    'suporte', 25, 83, 82, 84, 83, 83, 62, 85, 'comum', 'KR'),
    ('Breathe',   'top', 24, 85, 83, 82, 84, 83, 70, 86, 'raro', 'CN'),
    ('Tarzan',    'selva', 27, 87, 85, 88, 87, 86, 78, 88, 'epico', 'CN'),
    ('Shanks',    'meio', 25, 86, 84, 84, 85, 84, 72, 88, 'raro', 'CN'),
    ('Hope',      'atirador', 24, 86, 84, 83, 86, 84, 70, 88, 'raro', 'CN'),
    ('Kael',      'suporte', 23, 83, 82, 84, 83, 83, 62, 86, 'comum', 'CN')
  ) as t(nome, pos, idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao)
  loop
    select * into ja from tc_jogadores where lower(nome) = lower(e.nome) and legado_base is null;
    if ja.id is not null and not ja.ficticio then continue; end if; -- já é Legado: não mexe
    if ja.id is not null then
      -- um atleta fictício gerado com o mesmo nome: ganha um sufixo para liberar o nome do Legado
      update tc_jogadores set nome = left(nome, 20) || ' II' where id = ja.id;
    end if;
    insert into tc_jogadores (nome, ficticio, genero, pos, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, raridade)
    values (e.nome, false, 'M', e.pos, e.idade, e.regiao, '/jogos/tecnico/img/retratos/' || lower(e.nome) || '.webp',
            e.potencial, e.mec, e.rotas, e.macro, e.tf, e.mental, e.fama, e.raridade);
  end loop;
end $$;
