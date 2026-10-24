-- Simulador de Técnico: mais 15 jogadores Legado, da LCS 2026: Team Liquid, Cloud9 e Sentinels. Rode depois do 0168.
-- Idades conferidas em Leaguepedia/Liquipedia (out/2026); a do Vulcan é aproximada (a fonte só diz 1999 ou 2000).
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao
    ('Morgan', 'top', 25, 85, 83, 81, 83, 82, 66, 87, 'raro', 'NA'),
    ('Josedeodo', 'selva', 26, 85, 84, 87, 85, 84, 70, 87, 'raro', 'NA'),
    ('Quid', 'meio', 22, 88, 86, 84, 86, 84, 80, 91, 'epico', 'NA'),
    ('Yeon', 'atirador', 24, 86, 83, 82, 85, 83, 68, 88, 'raro', 'NA'),
    ('CoreJJ', 'suporte', 32, 84, 83, 89, 86, 87, 82, 86, 'epico', 'NA'),
    ('Thanatos', 'top', 22, 86, 84, 81, 84, 81, 66, 90, 'raro', 'NA'),
    ('Blaber', 'selva', 26, 88, 86, 90, 88, 86, 84, 89, 'epico', 'NA'),
    ('Loki', 'meio', 21, 86, 85, 82, 85, 82, 64, 90, 'raro', 'NA'),
    ('Tactical', 'atirador', 26, 84, 82, 81, 84, 82, 62, 86, 'raro', 'NA'),
    ('Vulcan', 'suporte', 26, 85, 84, 88, 86, 86, 76, 87, 'epico', 'NA'),
    ('Impact', 'top', 31, 86, 85, 86, 87, 87, 86, 86, 'epico', 'NA'),
    ('HamBak', 'selva', 24, 85, 83, 84, 85, 82, 62, 88, 'raro', 'NA'),
    ('DARKWINGS', 'meio', 26, 84, 83, 81, 83, 81, 58, 86, 'raro', 'NA'),
    ('Rahel', 'atirador', 22, 86, 84, 81, 86, 82, 66, 90, 'raro', 'NA'),
    ('huhi', 'suporte', 31, 83, 82, 86, 83, 85, 72, 85, 'raro', 'NA')
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

-- Idiomas dos 15 (nativo pelo país de origem; secundário onde há indício: quem joga há anos na América do Norte ou mora lá).
insert into public.tc_idiomas (nome, pais, nativo, sec) values
    ('morgan', 'Coreia do Sul', 'ko', array[]::text[]),
    ('josedeodo', 'Argentina', 'es', array['en']::text[]),
    ('quid', 'Coreia do Sul', 'ko', array[]::text[]),
    ('yeon', 'Coreia do Sul', 'ko', array['en']::text[]),
    ('corejj', 'Coreia do Sul', 'ko', array['en']::text[]),
    ('thanatos', 'Coreia do Sul', 'ko', array[]::text[]),
    ('blaber', 'Estados Unidos', 'en', array[]::text[]),
    ('loki', 'Coreia do Sul', 'ko', array[]::text[]),
    ('tactical', 'Estados Unidos', 'en', array[]::text[]),
    ('vulcan', 'Canadá', 'fr', array['en']::text[]),
    ('impact', 'Coreia do Sul', 'ko', array['en']::text[]),
    ('hambak', 'Coreia do Sul', 'ko', array[]::text[]),
    ('darkwings', 'Estados Unidos', 'en', array[]::text[]),
    ('rahel', 'Coreia do Sul', 'ko', array[]::text[]),
    ('huhi', 'Estados Unidos', 'en', array['ko']::text[])
on conflict (nome) do nothing;
