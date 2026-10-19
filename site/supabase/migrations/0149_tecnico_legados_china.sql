-- Simulador de Técnico: mais 15 jogadores Legado, de três times chineses (TES, IG e BLG). Rode depois do 0148. Idades conferidas na Leaguepedia (out/2026).
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao
    ('ZUIAN',      'top', 21, 85, 83, 81, 84, 82, 70, 89, 'raro', 'CN'),
    ('Tian',       'selva', 26, 89, 86, 89, 89, 87, 82, 89, 'epico', 'CN'),
    ('Creme',      'meio', 22, 86, 84, 84, 85, 84, 72, 89, 'epico', 'CN'),
    ('JackeyLove', 'atirador', 25, 90, 87, 86, 90, 87, 88, 91, 'epico', 'CN'),
    ('Zhuo',       'suporte', 25, 84, 83, 85, 84, 84, 64, 86, 'raro', 'CN'),
    ('TheShy',     'top', 26, 92, 88, 86, 90, 84, 92, 92, 'lendario', 'CN'),
    ('Wei',        'selva', 23, 85, 83, 84, 85, 83, 68, 88, 'raro', 'CN'),
    ('Rookie',     'meio', 29, 91, 90, 92, 91, 92, 95, 92, 'lendario', 'CN'),
    ('JiaQi',      'atirador', 22, 85, 83, 82, 85, 83, 66, 88, 'raro', 'CN'),
    ('Meiko',      'suporte', 28, 87, 86, 90, 87, 89, 85, 88, 'epico', 'CN'),
    ('Bin',        'top', 23, 91, 88, 86, 90, 86, 86, 92, 'epico', 'CN'),
    ('Xun',        'selva', 24, 87, 85, 86, 87, 85, 76, 89, 'epico', 'CN'),
    ('Knight',     'meio', 26, 90, 88, 88, 89, 88, 88, 90, 'epico', 'CN'),
    ('Viper',      'atirador', 26, 91, 88, 87, 90, 88, 88, 91, 'epico', 'CN'),
    ('ON',         'suporte', 23, 84, 83, 85, 84, 84, 64, 87, 'raro', 'CN')
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
