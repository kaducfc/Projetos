-- Simulador de Técnico: mais 15 jogadores Legado, de três times brasileiros (LOS, FURIA e LOUD). Rode depois do 0101.
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade
    ('Zest',     'top',      24, 82, 80, 79, 80, 80, 72, 83, 'comum'),
    ('Curse',    'selva',    22, 83, 80, 82, 82, 80, 70, 85, 'raro'),
    ('Feisty',   'meio',     21, 84, 82, 80, 81, 79, 72, 88, 'epico'),
    ('Duduhh',   'atirador', 21, 83, 80, 78, 82, 79, 68, 86, 'raro'),
    ('Ackerman', 'suporte',  22, 80, 78, 80, 79, 80, 62, 84, 'comum'),
    ('Guigo',    'top',      22, 82, 80, 78, 80, 79, 70, 85, 'raro'),
    ('Tatu',     'selva',    24, 84, 81, 83, 83, 82, 78, 86, 'lendario'),
    ('Tutsz',    'meio',     22, 82, 82, 80, 80, 80, 70, 85, 'raro'),
    ('Ayu',      'atirador', 23, 85, 82, 80, 85, 82, 78, 87, 'epico'),
    ('Jojo',     'suporte',  22, 81, 80, 81, 80, 80, 66, 84, 'comum'),
    ('Xyno',     'top',      23, 83, 82, 80, 81, 80, 72, 85, 'raro'),
    ('Sinatra',  'selva',    22, 83, 81, 82, 82, 81, 72, 86, 'epico'),
    ('Kaze',     'meio',     23, 84, 84, 82, 82, 83, 76, 86, 'epico'),
    ('Rabelo',   'atirador', 24, 85, 83, 82, 84, 84, 80, 86, 'lendario'),
    ('uZent',    'suporte',  22, 80, 79, 80, 79, 79, 65, 83, 'comum')
  ) as t(nome, pos, idade, mec, rotas, macro, tf, mental, fama, potencial, raridade)
  loop
    select * into ja from tc_jogadores where lower(nome) = lower(e.nome) and legado_base is null;
    if ja.id is not null and not ja.ficticio then continue; end if; -- já é Legado: não mexe
    if ja.id is not null then
      -- um atleta fictício gerado com o mesmo nome: ganha um sufixo para liberar o nome do Legado
      update tc_jogadores set nome = left(nome, 20) || ' II' where id = ja.id;
    end if;
    insert into tc_jogadores (nome, ficticio, genero, pos, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, raridade)
    values (e.nome, false, 'M', e.pos, e.idade, 'BR', '/jogos/tecnico/img/retratos/' || lower(e.nome) || '.webp',
            e.potencial, e.mec, e.rotas, e.macro, e.tf, e.mental, e.fama, e.raridade);
  end loop;
end $$;
