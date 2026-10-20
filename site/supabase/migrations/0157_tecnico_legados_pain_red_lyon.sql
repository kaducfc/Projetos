-- Simulador de Técnico: mais 15 jogadores Legado, de três times: paiN e RED Canids (Brasil) e LYON (NA). Rode depois do 0156. Idades conferidas na Leaguepedia (out/2026).
-- Idempotente: quem já existe como Legado não é tocado. Entram no catálogo dos baús de Recrutar (sem dono).
-- Valores de atributos e raridades provisórios: ajuste à vontade (update tc_jogadores set ... where nome = '...').

do $$
declare
  e record;
  ja tc_jogadores;
begin
  for e in select * from (values
    -- nome,      pos,        idade, mec, rotas, macro, tf, mental, fama, potencial, raridade, regiao
    ('Boal',       'top', 23, 84, 82, 80, 82, 81, 66, 87, 'raro', 'BR'),
    ('CarioK',     'selva', 26, 87, 84, 88, 86, 85, 82, 87, 'epico', 'BR'),
    ('Namiru',     'meio', 19, 85, 83, 81, 83, 80, 62, 91, 'raro', 'BR'),
    ('Hena',       'atirador', 27, 84, 82, 81, 84, 82, 68, 86, 'raro', 'BR'),
    ('Ceos',       'suporte', 28, 82, 81, 84, 82, 83, 66, 84, 'raro', 'BR'),
    ('zynts',      'top', 19, 84, 82, 79, 82, 79, 60, 90, 'raro', 'BR'),
    ('STEPZ',      'selva', 20, 84, 82, 83, 83, 81, 62, 89, 'raro', 'BR'),
    ('Fuuu',       'meio', 23, 86, 84, 82, 84, 83, 70, 88, 'raro', 'BR'),
    ('Morttheus',  'atirador', 24, 87, 84, 83, 86, 84, 72, 88, 'epico', 'BR'),
    ('Manel',      'suporte', 20, 80, 79, 81, 80, 80, 55, 85, 'comum', 'BR'),
    ('Dhokla',     'top', 29, 86, 84, 83, 86, 84, 74, 86, 'epico', 'NA'),
    ('Inspired',   'selva', 24, 90, 87, 90, 89, 87, 85, 90, 'lendario', 'NA'),
    ('Saint',      'meio', 21, 85, 83, 81, 84, 82, 64, 89, 'raro', 'NA'),
    ('Berserker',  'atirador', 23, 89, 86, 84, 89, 86, 80, 91, 'epico', 'NA'),
    ('Isles',      'suporte', 25, 83, 82, 85, 83, 83, 70, 86, 'raro', 'NA')
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

-- Idiomas dos 15 (nativo pelo país de origem; secundário só onde há indício: STEPZ, venezuelano, joga no Brasil; Inspired, polonês, joga na América do Norte).
insert into public.tc_idiomas (nome, pais, nativo, sec) values
    ('boal', 'Brasil', 'pt', array[]::text[]),
    ('cariok', 'Brasil', 'pt', array[]::text[]),
    ('namiru', 'Brasil', 'pt', array[]::text[]),
    ('hena', 'Coreia do Sul', 'ko', array[]::text[]),
    ('ceos', 'Brasil', 'pt', array[]::text[]),
    ('zynts', 'Brasil', 'pt', array[]::text[]),
    ('stepz', 'Venezuela', 'es', array['pt']::text[]),
    ('fuuu', 'Brasil', 'pt', array[]::text[]),
    ('morttheus', 'Brasil', 'pt', array[]::text[]),
    ('manel', 'Brasil', 'pt', array[]::text[]),
    ('dhokla', 'Estados Unidos', 'en', array[]::text[]),
    ('inspired', 'Polônia', 'pl', array['en']::text[]),
    ('saint', 'Coreia do Sul', 'ko', array[]::text[]),
    ('berserker', 'Coreia do Sul', 'ko', array[]::text[]),
    ('isles', 'Austrália', 'en', array[]::text[])
on conflict (nome) do nothing;
