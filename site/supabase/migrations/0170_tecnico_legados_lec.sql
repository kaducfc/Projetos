-- Simulador de Técnico: mais 20 jogadores Legado, da LEC 2026: G2, Movistar KOI, Karmine Corp e Team Vitality. Rode depois do 0169.
-- Idades conferidas em Leaguepedia, Liquipedia, Esports Charts e Sheep Esports (out/2026); a do FIESTA vem só da Sheep Esports (23 anos).
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao
    ('BrokenBlade', 'top', 26, 86, 84, 83, 86, 83, 80, 87, 'epico', 'EU'),
    ('SkewMond', 'selva', 22, 85, 84, 85, 84, 83, 66, 90, 'raro', 'EU'),
    ('Caps', 'meio', 26, 90, 87, 88, 89, 87, 92, 90, 'lendario', 'EU'),
    ('Hans Sama', 'atirador', 27, 88, 85, 84, 88, 86, 82, 88, 'epico', 'EU'),
    ('Labrov', 'suporte', 24, 84, 83, 86, 84, 85, 68, 87, 'raro', 'EU'),
    ('Myrwn', 'top', 23, 85, 83, 81, 83, 81, 62, 88, 'raro', 'EU'),
    ('Elyoya', 'selva', 26, 87, 85, 89, 87, 86, 80, 88, 'epico', 'EU'),
    ('Jojopyun', 'meio', 22, 86, 84, 82, 85, 82, 70, 91, 'raro', 'EU'),
    ('Supa', 'atirador', 25, 85, 83, 82, 85, 83, 66, 87, 'raro', 'EU'),
    ('Alvaro', 'suporte', 23, 83, 82, 85, 83, 83, 60, 87, 'raro', 'EU'),
    ('Canna', 'top', 26, 87, 85, 84, 86, 84, 76, 88, 'epico', 'EU'),
    ('Yike', 'selva', 25, 86, 85, 86, 85, 84, 74, 88, 'raro', 'EU'),
    ('kyeahoo', 'meio', 21, 85, 83, 81, 84, 81, 62, 90, 'raro', 'EU'),
    ('Caliste', 'atirador', 20, 86, 83, 80, 86, 80, 62, 92, 'raro', 'EU'),
    ('Busio', 'suporte', 22, 82, 81, 84, 82, 83, 58, 87, 'raro', 'EU'),
    ('Naak Nako', 'top', 21, 85, 83, 80, 83, 80, 60, 91, 'raro', 'EU'),
    ('Lyncas', 'selva', 22, 84, 83, 84, 84, 82, 56, 89, 'raro', 'EU'),
    ('FIESTA', 'meio', 23, 86, 84, 82, 85, 82, 62, 89, 'raro', 'EU'),
    ('Carzzy', 'atirador', 24, 86, 84, 82, 86, 83, 66, 88, 'raro', 'EU'),
    ('Fleshy', 'suporte', 25, 83, 82, 85, 83, 84, 60, 86, 'raro', 'EU')
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

-- Idiomas dos 20 (nativo pelo país de origem; inglês como secundário para quem joga fora do próprio país na Europa; os times espanhóis ficam só com o espanhol).
insert into public.tc_idiomas (nome, pais, nativo, sec) values
    ('brokenblade', 'Alemanha', 'tr', array['en']::text[]),
    ('skewmond', 'França', 'fr', array['en']::text[]),
    ('caps', 'Dinamarca', 'da', array['en']::text[]),
    ('hans sama', 'França', 'fr', array['en']::text[]),
    ('labrov', 'Grécia', 'el', array['en']::text[]),
    ('myrwn', 'Espanha', 'es', array[]::text[]),
    ('elyoya', 'Espanha', 'es', array[]::text[]),
    ('jojopyun', 'Canadá', 'en', array['ko']::text[]),
    ('supa', 'Espanha', 'es', array[]::text[]),
    ('alvaro', 'Espanha', 'es', array[]::text[]),
    ('canna', 'Coreia do Sul', 'ko', array[]::text[]),
    ('yike', 'Suécia', 'sv', array['en']::text[]),
    ('kyeahoo', 'Coreia do Sul', 'ko', array[]::text[]),
    ('caliste', 'França', 'fr', array[]::text[]),
    ('busio', 'Polônia', 'pl', array['en']::text[]),
    ('naak nako', 'Turquia', 'tr', array['en']::text[]),
    ('lyncas', 'Lituânia', 'lt', array['en']::text[]),
    ('fiesta', 'Coreia do Sul', 'ko', array[]::text[]),
    ('carzzy', 'República Tcheca', 'cs', array['en']::text[]),
    ('fleshy', 'Turquia', 'tr', array['en']::text[])
on conflict (nome) do nothing;
