-- Simulador de técnico (nome provisório), parte 5: catálogo de campeões e maestria dos jogadores.
-- Rode DEPOIS de 0085 a 0089. Segue fechado para o público (tc_exigir).
--
--  * tc_campeoes: os 173 campeões (nome e dados básicos; foto fica para depois).
--  * tc_maestria: pontos de maestria de cada jogador com cada campeão. Os 5 mais jogados (no mínimo `limiar`
--    pontos) viram FAVORITOS e dão bônus de Poder quando o jogador usa aquele campeão.
--  * tc_maestria_registrar(...) é o gancho que a simulação com Pick and Ban vai chamar depois de cada mapa.

create table if not exists public.tc_campeoes (
  id text primary key,
  nome text not null unique,
  ano int,
  posicoes text[] not null default '{}',   -- top, selva, meio, atirador, suporte
  classes text[] not null default '{}',
  regioes text[] not null default '{}',
  especies text[] not null default '{}',
  alcance text[] not null default '{}',
  ativo boolean not null default true
);
alter table public.tc_campeoes enable row level security;
revoke all on public.tc_campeoes from anon, authenticated;

insert into public.tc_campeoes (id, nome, ano, posicoes, classes, regioes, especies, alcance) values
('aatrox','Aatrox',2013,array['top']::text[],array['Lutador']::text[],array['Runeterra']::text[],array['Darkin']::text[],array['Corpo a corpo']::text[]),
('ahri','Ahri',2011,array['meio']::text[],array['Mago','Assassino']::text[],array['Ionia']::text[],array['Vastaya']::text[],array['À distância']::text[]),
('akali','Akali',2010,array['meio','top']::text[],array['Assassino']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('akshan','Akshan',2021,array['meio','top']::text[],array['Atirador','Assassino']::text[],array['Shurima']::text[],array['Humano']::text[],array['À distância']::text[]),
('alistar','Alistar',2009,array['suporte']::text[],array['Tanque','Suporte']::text[],array['Runeterra']::text[],array['Minotauro']::text[],array['Corpo a corpo']::text[]),
('ambessa','Ambessa',2024,array['top']::text[],array['Lutador','Assassino']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('amumu','Amumu',2009,array['selva','suporte']::text[],array['Tanque']::text[],array['Shurima']::text[],array['Morto-vivo','Yordle']::text[],array['Corpo a corpo']::text[]),
('anivia','Anivia',2009,array['meio']::text[],array['Mago']::text[],array['Freljord']::text[],array['Semideus']::text[],array['À distância']::text[]),
('annie','Annie',2009,array['meio','suporte']::text[],array['Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('aphelios','Aphelios',2019,array['atirador']::text[],array['Atirador']::text[],array['Targon']::text[],array['Humano']::text[],array['À distância']::text[]),
('ashe','Ashe',2009,array['atirador','suporte']::text[],array['Atirador']::text[],array['Freljord']::text[],array['Humano']::text[],array['À distância']::text[]),
('aurelion-sol','Aurelion Sol',2016,array['meio']::text[],array['Mago']::text[],array['Targon']::text[],array['Dragão','Celestial']::text[],array['À distância']::text[]),
('aurora','Aurora',2024,array['meio','top']::text[],array['Mago']::text[],array['Freljord']::text[],array['Vastaya']::text[],array['À distância']::text[]),
('azir','Azir',2014,array['meio']::text[],array['Mago']::text[],array['Shurima']::text[],array['Ascendido']::text[],array['À distância']::text[]),
('bard','Bard',2015,array['suporte']::text[],array['Suporte']::text[],array['Runeterra']::text[],array['Celestial']::text[],array['À distância']::text[]),
('bel-veth','Bel''Veth',2022,array['selva']::text[],array['Lutador']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['Corpo a corpo']::text[]),
('blitzcrank','Blitzcrank',2009,array['suporte']::text[],array['Tanque','Suporte']::text[],array['Zaun']::text[],array['Constructo']::text[],array['Corpo a corpo']::text[]),
('brand','Brand',2011,array['suporte','meio']::text[],array['Mago']::text[],array['Runeterra']::text[],array['Humano']::text[],array['À distância']::text[]),
('braum','Braum',2014,array['suporte']::text[],array['Tanque','Suporte']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('briar','Briar',2023,array['selva']::text[],array['Lutador','Assassino']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('caitlyn','Caitlyn',2011,array['atirador']::text[],array['Atirador']::text[],array['Piltover']::text[],array['Humano']::text[],array['À distância']::text[]),
('camille','Camille',2016,array['top']::text[],array['Lutador']::text[],array['Piltover']::text[],array['Humano','Ciborgue']::text[],array['Corpo a corpo']::text[]),
('cassiopeia','Cassiopeia',2010,array['meio']::text[],array['Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('cho-gath','Cho''Gath',2009,array['top']::text[],array['Tanque']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['Corpo a corpo']::text[]),
('corki','Corki',2009,array['meio']::text[],array['Atirador']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['À distância']::text[]),
('darius','Darius',2012,array['top']::text[],array['Lutador']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('diana','Diana',2012,array['selva','meio']::text[],array['Lutador','Assassino']::text[],array['Targon']::text[],array['Humano','Celestial']::text[],array['Corpo a corpo']::text[]),
('dr-mundo','Dr. Mundo',2009,array['top','selva']::text[],array['Tanque']::text[],array['Zaun']::text[],array['Humano','Quimtec']::text[],array['Corpo a corpo']::text[]),
('draven','Draven',2012,array['atirador']::text[],array['Atirador']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('ekko','Ekko',2015,array['selva','meio']::text[],array['Assassino']::text[],array['Zaun']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('elise','Elise',2012,array['selva']::text[],array['Mago']::text[],array['Ilhas das Sombras']::text[],array['Humano']::text[],array['Corpo a corpo','À distância']::text[]),
('evelynn','Evelynn',2009,array['selva']::text[],array['Assassino']::text[],array['Runeterra']::text[],array['Demônio']::text[],array['Corpo a corpo']::text[]),
('ezreal','Ezreal',2010,array['atirador']::text[],array['Atirador']::text[],array['Piltover']::text[],array['Humano']::text[],array['À distância']::text[]),
('fiddlesticks','Fiddlesticks',2009,array['selva']::text[],array['Mago']::text[],array['Runeterra']::text[],array['Demônio']::text[],array['À distância']::text[]),
('fiora','Fiora',2012,array['top']::text[],array['Lutador']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('fizz','Fizz',2011,array['meio']::text[],array['Assassino']::text[],array['Bilgewater']::text[],array['Yordle']::text[],array['Corpo a corpo']::text[]),
('galio','Galio',2010,array['meio','suporte']::text[],array['Tanque']::text[],array['Demacia']::text[],array['Constructo']::text[],array['Corpo a corpo']::text[]),
('gangplank','Gangplank',2009,array['top']::text[],array['Lutador']::text[],array['Bilgewater']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('garen','Garen',2010,array['top']::text[],array['Lutador']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('gnar','Gnar',2014,array['top']::text[],array['Lutador']::text[],array['Freljord']::text[],array['Yordle']::text[],array['Corpo a corpo','À distância']::text[]),
('gragas','Gragas',2010,array['selva','top']::text[],array['Lutador']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('graves','Graves',2011,array['selva']::text[],array['Atirador']::text[],array['Bilgewater']::text[],array['Humano']::text[],array['À distância']::text[]),
('gwen','Gwen',2021,array['top','selva']::text[],array['Lutador']::text[],array['Ilhas das Sombras']::text[],array['Espírito']::text[],array['Corpo a corpo']::text[]),
('hecarim','Hecarim',2012,array['selva']::text[],array['Lutador']::text[],array['Ilhas das Sombras']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('heimerdinger','Heimerdinger',2009,array['meio','suporte']::text[],array['Mago']::text[],array['Piltover']::text[],array['Yordle']::text[],array['À distância']::text[]),
('hwei','Hwei',2023,array['meio','suporte']::text[],array['Mago']::text[],array['Ionia']::text[],array['Humano']::text[],array['À distância']::text[]),
('illaoi','Illaoi',2015,array['top']::text[],array['Lutador']::text[],array['Bilgewater']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('irelia','Irelia',2010,array['top','meio']::text[],array['Lutador']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('ivern','Ivern',2016,array['selva']::text[],array['Suporte']::text[],array['Ionia']::text[],array['Espírito']::text[],array['À distância']::text[]),
('janna','Janna',2009,array['suporte']::text[],array['Suporte']::text[],array['Zaun']::text[],array['Espírito']::text[],array['À distância']::text[]),
('jarvan-iv','Jarvan IV',2011,array['selva']::text[],array['Lutador','Tanque']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('jax','Jax',2009,array['top','selva']::text[],array['Lutador']::text[],array['Runeterra']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('jayce','Jayce',2012,array['top','meio']::text[],array['Lutador']::text[],array['Piltover']::text[],array['Humano']::text[],array['Corpo a corpo','À distância']::text[]),
('jhin','Jhin',2016,array['atirador']::text[],array['Atirador']::text[],array['Ionia']::text[],array['Humano']::text[],array['À distância']::text[]),
('jinx','Jinx',2013,array['atirador']::text[],array['Atirador']::text[],array['Zaun']::text[],array['Humano']::text[],array['À distância']::text[]),
('k-sante','K''Sante',2022,array['top']::text[],array['Tanque','Lutador']::text[],array['Shurima']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('kai-sa','Kai''Sa',2018,array['atirador']::text[],array['Atirador']::text[],array['Vazio']::text[],array['Humano','Criatura do Vazio']::text[],array['À distância']::text[]),
('kalista','Kalista',2014,array['atirador']::text[],array['Atirador']::text[],array['Ilhas das Sombras']::text[],array['Morto-vivo']::text[],array['À distância']::text[]),
('karma','Karma',2011,array['suporte','meio']::text[],array['Mago','Suporte']::text[],array['Ionia']::text[],array['Humano']::text[],array['À distância']::text[]),
('karthus','Karthus',2009,array['selva']::text[],array['Mago']::text[],array['Ilhas das Sombras']::text[],array['Morto-vivo']::text[],array['À distância']::text[]),
('kassadin','Kassadin',2009,array['meio']::text[],array['Assassino']::text[],array['Vazio']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('katarina','Katarina',2009,array['meio']::text[],array['Assassino']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('kayle','Kayle',2009,array['top']::text[],array['Lutador','Mago']::text[],array['Demacia']::text[],array['Celestial']::text[],array['Corpo a corpo','À distância']::text[]),
('kayn','Kayn',2017,array['selva']::text[],array['Lutador','Assassino']::text[],array['Ionia']::text[],array['Humano','Darkin']::text[],array['Corpo a corpo']::text[]),
('kennen','Kennen',2010,array['top']::text[],array['Mago']::text[],array['Ionia']::text[],array['Yordle']::text[],array['À distância']::text[]),
('kha-zix','Kha''Zix',2012,array['selva']::text[],array['Assassino']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['Corpo a corpo']::text[]),
('kindred','Kindred',2015,array['selva']::text[],array['Atirador']::text[],array['Runeterra']::text[],array['Espírito']::text[],array['À distância']::text[]),
('kled','Kled',2016,array['top']::text[],array['Lutador']::text[],array['Noxus']::text[],array['Yordle']::text[],array['Corpo a corpo']::text[]),
('kog-maw','Kog''Maw',2010,array['atirador']::text[],array['Atirador']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['À distância']::text[]),
('leblanc','LeBlanc',2010,array['meio']::text[],array['Assassino','Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('lee-sin','Lee Sin',2011,array['selva']::text[],array['Lutador']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('leona','Leona',2011,array['suporte']::text[],array['Tanque','Suporte']::text[],array['Targon']::text[],array['Humano','Celestial']::text[],array['Corpo a corpo']::text[]),
('lillia','Lillia',2020,array['selva']::text[],array['Lutador','Mago']::text[],array['Ionia']::text[],array['Espírito']::text[],array['Corpo a corpo']::text[]),
('lissandra','Lissandra',2013,array['meio']::text[],array['Mago']::text[],array['Freljord']::text[],array['Humano']::text[],array['À distância']::text[]),
('locke','Locke',2026,array['meio']::text[],array['Assassino']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('lucian','Lucian',2013,array['atirador','meio']::text[],array['Atirador']::text[],array['Runeterra']::text[],array['Humano']::text[],array['À distância']::text[]),
('lulu','Lulu',2012,array['suporte']::text[],array['Suporte','Mago']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['À distância']::text[]),
('lux','Lux',2010,array['suporte','meio']::text[],array['Mago']::text[],array['Demacia']::text[],array['Humano']::text[],array['À distância']::text[]),
('malphite','Malphite',2009,array['top']::text[],array['Tanque']::text[],array['Ixtal']::text[],array['Elemental']::text[],array['Corpo a corpo']::text[]),
('malzahar','Malzahar',2010,array['meio']::text[],array['Mago']::text[],array['Vazio']::text[],array['Humano']::text[],array['À distância']::text[]),
('maokai','Maokai',2011,array['suporte','selva']::text[],array['Tanque']::text[],array['Ilhas das Sombras']::text[],array['Espírito']::text[],array['Corpo a corpo']::text[]),
('master-yi','Master Yi',2009,array['selva']::text[],array['Assassino','Lutador']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('mel','Mel',2025,array['meio','suporte']::text[],array['Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('milio','Milio',2023,array['suporte']::text[],array['Suporte']::text[],array['Ixtal']::text[],array['Humano']::text[],array['À distância']::text[]),
('miss-fortune','Miss Fortune',2010,array['atirador']::text[],array['Atirador']::text[],array['Bilgewater']::text[],array['Humano']::text[],array['À distância']::text[]),
('mordekaiser','Mordekaiser',2010,array['top']::text[],array['Lutador']::text[],array['Noxus']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('morgana','Morgana',2009,array['suporte']::text[],array['Mago','Suporte']::text[],array['Demacia']::text[],array['Celestial']::text[],array['À distância']::text[]),
('naafiri','Naafiri',2023,array['meio']::text[],array['Assassino']::text[],array['Shurima']::text[],array['Darkin']::text[],array['Corpo a corpo']::text[]),
('nami','Nami',2012,array['suporte']::text[],array['Suporte']::text[],array['Runeterra']::text[],array['Vastaya']::text[],array['À distância']::text[]),
('nasus','Nasus',2009,array['top']::text[],array['Lutador']::text[],array['Shurima']::text[],array['Ascendido']::text[],array['Corpo a corpo']::text[]),
('nautilus','Nautilus',2012,array['suporte']::text[],array['Tanque']::text[],array['Bilgewater']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('neeko','Neeko',2018,array['meio','suporte']::text[],array['Mago']::text[],array['Ixtal']::text[],array['Vastaya']::text[],array['À distância']::text[]),
('nidalee','Nidalee',2009,array['selva']::text[],array['Assassino']::text[],array['Ixtal']::text[],array['Humano']::text[],array['Corpo a corpo','À distância']::text[]),
('nilah','Nilah',2022,array['atirador']::text[],array['Lutador']::text[],array['Runeterra']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('nocturne','Nocturne',2011,array['selva']::text[],array['Assassino']::text[],array['Runeterra']::text[],array['Demônio']::text[],array['Corpo a corpo']::text[]),
('nunu-e-willump','Nunu e Willump',2009,array['selva']::text[],array['Tanque']::text[],array['Freljord']::text[],array['Humano','Yeti']::text[],array['Corpo a corpo']::text[]),
('olaf','Olaf',2010,array['top','selva']::text[],array['Lutador']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('orianna','Orianna',2011,array['meio']::text[],array['Mago']::text[],array['Piltover']::text[],array['Constructo']::text[],array['À distância']::text[]),
('ornn','Ornn',2017,array['top']::text[],array['Tanque']::text[],array['Freljord']::text[],array['Semideus']::text[],array['Corpo a corpo']::text[]),
('pantheon','Pantheon',2010,array['top','meio','suporte']::text[],array['Lutador','Assassino']::text[],array['Targon']::text[],array['Humano','Celestial']::text[],array['Corpo a corpo']::text[]),
('poppy','Poppy',2010,array['top','selva']::text[],array['Tanque']::text[],array['Demacia']::text[],array['Yordle']::text[],array['Corpo a corpo']::text[]),
('pyke','Pyke',2018,array['suporte']::text[],array['Assassino']::text[],array['Bilgewater']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('qiyana','Qiyana',2019,array['meio']::text[],array['Assassino']::text[],array['Ixtal']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('quinn','Quinn',2013,array['top']::text[],array['Atirador']::text[],array['Demacia']::text[],array['Humano']::text[],array['À distância']::text[]),
('rakan','Rakan',2017,array['suporte']::text[],array['Suporte']::text[],array['Ionia']::text[],array['Vastaya']::text[],array['Corpo a corpo']::text[]),
('rammus','Rammus',2009,array['selva']::text[],array['Tanque']::text[],array['Shurima']::text[],array['Animal']::text[],array['Corpo a corpo']::text[]),
('rek-sai','Rek''Sai',2014,array['selva']::text[],array['Lutador']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['Corpo a corpo']::text[]),
('rell','Rell',2020,array['suporte']::text[],array['Tanque']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('renata-glasc','Renata Glasc',2022,array['suporte']::text[],array['Suporte']::text[],array['Zaun']::text[],array['Humano','Quimtec']::text[],array['À distância']::text[]),
('renekton','Renekton',2011,array['top']::text[],array['Lutador']::text[],array['Shurima']::text[],array['Ascendido']::text[],array['Corpo a corpo']::text[]),
('rengar','Rengar',2012,array['selva','top']::text[],array['Assassino']::text[],array['Ixtal']::text[],array['Vastaya']::text[],array['Corpo a corpo']::text[]),
('riven','Riven',2011,array['top']::text[],array['Lutador']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('rumble','Rumble',2011,array['top','meio']::text[],array['Lutador','Mago']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['Corpo a corpo']::text[]),
('ryze','Ryze',2009,array['meio','top']::text[],array['Mago']::text[],array['Runeterra']::text[],array['Humano']::text[],array['À distância']::text[]),
('samira','Samira',2020,array['atirador']::text[],array['Atirador']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('sejuani','Sejuani',2012,array['selva']::text[],array['Tanque']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('senna','Senna',2019,array['suporte','atirador']::text[],array['Atirador','Suporte']::text[],array['Runeterra']::text[],array['Humano']::text[],array['À distância']::text[]),
('seraphine','Seraphine',2020,array['suporte','meio']::text[],array['Mago','Suporte']::text[],array['Piltover']::text[],array['Humano']::text[],array['À distância']::text[]),
('sett','Sett',2020,array['top','suporte']::text[],array['Lutador','Tanque']::text[],array['Ionia']::text[],array['Vastaya']::text[],array['Corpo a corpo']::text[]),
('shaco','Shaco',2009,array['selva','suporte']::text[],array['Assassino']::text[],array['Runeterra']::text[],array['Demônio']::text[],array['Corpo a corpo']::text[]),
('shen','Shen',2010,array['top']::text[],array['Tanque']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('shyvana','Shyvana',2011,array['selva']::text[],array['Lutador']::text[],array['Demacia']::text[],array['Dragão','Humano']::text[],array['Corpo a corpo']::text[]),
('singed','Singed',2009,array['top']::text[],array['Tanque']::text[],array['Zaun']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('sion','Sion',2009,array['top']::text[],array['Tanque']::text[],array['Noxus']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('sivir','Sivir',2009,array['atirador']::text[],array['Atirador']::text[],array['Shurima']::text[],array['Humano']::text[],array['À distância']::text[]),
('skarner','Skarner',2011,array['selva','top']::text[],array['Tanque']::text[],array['Ixtal']::text[],array['Brackern']::text[],array['Corpo a corpo']::text[]),
('smolder','Smolder',2024,array['atirador']::text[],array['Atirador']::text[],array['Runeterra']::text[],array['Dragão']::text[],array['À distância']::text[]),
('sona','Sona',2010,array['suporte']::text[],array['Suporte','Mago']::text[],array['Demacia']::text[],array['Humano']::text[],array['À distância']::text[]),
('soraka','Soraka',2009,array['suporte']::text[],array['Suporte']::text[],array['Targon']::text[],array['Celestial']::text[],array['À distância']::text[]),
('swain','Swain',2010,array['suporte','meio']::text[],array['Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('sylas','Sylas',2019,array['meio','selva']::text[],array['Mago','Assassino']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('syndra','Syndra',2012,array['meio']::text[],array['Mago']::text[],array['Ionia']::text[],array['Humano']::text[],array['À distância']::text[]),
('tahm-kench','Tahm Kench',2015,array['top','suporte']::text[],array['Tanque']::text[],array['Bilgewater']::text[],array['Demônio']::text[],array['Corpo a corpo']::text[]),
('taliyah','Taliyah',2016,array['selva','meio']::text[],array['Mago']::text[],array['Shurima']::text[],array['Humano']::text[],array['À distância']::text[]),
('talon','Talon',2011,array['meio','selva']::text[],array['Assassino']::text[],array['Noxus']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('taric','Taric',2009,array['suporte']::text[],array['Suporte','Tanque']::text[],array['Targon']::text[],array['Humano','Celestial']::text[],array['Corpo a corpo']::text[]),
('teemo','Teemo',2009,array['top']::text[],array['Atirador']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['À distância']::text[]),
('thresh','Thresh',2013,array['suporte']::text[],array['Suporte','Tanque']::text[],array['Ilhas das Sombras']::text[],array['Morto-vivo']::text[],array['À distância']::text[]),
('tristana','Tristana',2009,array['atirador','meio']::text[],array['Atirador']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['À distância']::text[]),
('trundle','Trundle',2010,array['selva','top']::text[],array['Lutador']::text[],array['Freljord']::text[],array['Troll']::text[],array['Corpo a corpo']::text[]),
('tryndamere','Tryndamere',2009,array['top']::text[],array['Lutador']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('twisted-fate','Twisted Fate',2009,array['meio']::text[],array['Mago']::text[],array['Bilgewater']::text[],array['Humano']::text[],array['À distância']::text[]),
('twitch','Twitch',2009,array['atirador']::text[],array['Atirador']::text[],array['Zaun']::text[],array['Animal','Quimtec']::text[],array['À distância']::text[]),
('udyr','Udyr',2009,array['selva']::text[],array['Lutador','Tanque']::text[],array['Freljord']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('urgot','Urgot',2010,array['top']::text[],array['Lutador']::text[],array['Zaun']::text[],array['Humano','Ciborgue']::text[],array['À distância']::text[]),
('varus','Varus',2012,array['atirador','meio']::text[],array['Atirador']::text[],array['Ionia']::text[],array['Darkin']::text[],array['À distância']::text[]),
('vayne','Vayne',2011,array['atirador','top']::text[],array['Atirador']::text[],array['Demacia']::text[],array['Humano']::text[],array['À distância']::text[]),
('veigar','Veigar',2009,array['meio']::text[],array['Mago']::text[],array['Bandópolis']::text[],array['Yordle']::text[],array['À distância']::text[]),
('vel-koz','Vel''Koz',2014,array['suporte','meio']::text[],array['Mago']::text[],array['Vazio']::text[],array['Criatura do Vazio']::text[],array['À distância']::text[]),
('vex','Vex',2021,array['meio']::text[],array['Mago']::text[],array['Ilhas das Sombras']::text[],array['Yordle']::text[],array['À distância']::text[]),
('vi','Vi',2012,array['selva']::text[],array['Lutador']::text[],array['Piltover']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('viego','Viego',2021,array['selva']::text[],array['Assassino','Lutador']::text[],array['Ilhas das Sombras']::text[],array['Morto-vivo']::text[],array['Corpo a corpo']::text[]),
('viktor','Viktor',2011,array['meio']::text[],array['Mago']::text[],array['Zaun']::text[],array['Humano','Ciborgue']::text[],array['À distância']::text[]),
('vladimir','Vladimir',2010,array['meio','top']::text[],array['Mago']::text[],array['Noxus']::text[],array['Humano']::text[],array['À distância']::text[]),
('volibear','Volibear',2011,array['top','selva']::text[],array['Lutador','Tanque']::text[],array['Freljord']::text[],array['Semideus']::text[],array['Corpo a corpo']::text[]),
('warwick','Warwick',2009,array['selva','top']::text[],array['Lutador']::text[],array['Zaun']::text[],array['Humano','Quimtec']::text[],array['Corpo a corpo']::text[]),
('wukong','Wukong',2011,array['top','selva']::text[],array['Lutador']::text[],array['Ionia']::text[],array['Vastaya']::text[],array['Corpo a corpo']::text[]),
('xayah','Xayah',2017,array['atirador']::text[],array['Atirador']::text[],array['Ionia']::text[],array['Vastaya']::text[],array['À distância']::text[]),
('xerath','Xerath',2011,array['suporte','meio']::text[],array['Mago']::text[],array['Shurima']::text[],array['Ascendido']::text[],array['À distância']::text[]),
('xin-zhao','Xin Zhao',2010,array['selva']::text[],array['Lutador']::text[],array['Demacia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('yasuo','Yasuo',2013,array['meio','top']::text[],array['Lutador']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('yone','Yone',2020,array['meio','top']::text[],array['Assassino','Lutador']::text[],array['Ionia']::text[],array['Humano','Espírito']::text[],array['Corpo a corpo']::text[]),
('yorick','Yorick',2011,array['top']::text[],array['Lutador']::text[],array['Ilhas das Sombras']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('yunara','Yunara',2025,array['atirador']::text[],array['Atirador']::text[],array['Ionia']::text[],array['Humano']::text[],array['À distância']::text[]),
('yuumi','Yuumi',2019,array['suporte']::text[],array['Suporte']::text[],array['Bandópolis']::text[],array['Animal']::text[],array['À distância']::text[]),
('zaahen','Zaahen',2025,array['top']::text[],array['Lutador']::text[],array['Runeterra']::text[],array['Darkin']::text[],array['Corpo a corpo']::text[]),
('zac','Zac',2013,array['selva']::text[],array['Tanque']::text[],array['Zaun']::text[],array['Quimtec']::text[],array['Corpo a corpo']::text[]),
('zed','Zed',2012,array['meio']::text[],array['Assassino']::text[],array['Ionia']::text[],array['Humano']::text[],array['Corpo a corpo']::text[]),
('zeri','Zeri',2022,array['atirador']::text[],array['Atirador']::text[],array['Zaun']::text[],array['Humano']::text[],array['À distância']::text[]),
('ziggs','Ziggs',2012,array['meio','atirador']::text[],array['Mago']::text[],array['Zaun']::text[],array['Yordle']::text[],array['À distância']::text[]),
('zilean','Zilean',2009,array['suporte']::text[],array['Suporte','Mago']::text[],array['Runeterra']::text[],array['Humano']::text[],array['À distância']::text[]),
('zoe','Zoe',2017,array['meio']::text[],array['Mago']::text[],array['Targon']::text[],array['Celestial']::text[],array['À distância']::text[]),
('zyra','Zyra',2012,array['suporte']::text[],array['Mago']::text[],array['Ixtal']::text[],array['Planta']::text[],array['À distância']::text[]) on conflict (id) do update set nome = excluded.nome, ano = excluded.ano, posicoes = excluded.posicoes, classes = excluded.classes,
  regioes = excluded.regioes, especies = excluded.especies, alcance = excluded.alcance;

-- Regras de maestria (editáveis): pontos por mapa, mínimo para ser favorito, máximo de favoritos e, por nível, o limite de pontos e o bônus de Poder.
insert into public.tc_config (chave, valor) values
  ('maestria', '{"favoritos_max": 5, "limiar": 150, "pontos_vitoria": 30, "pontos_derrota": 15,
                 "niveis": [0, 150, 400, 800, 1500], "bonus_pct": [0, 2, 4, 6, 8]}'::jsonb)
on conflict (chave) do nothing;

create table if not exists public.tc_maestria (
  jogador_id bigint not null references public.tc_jogadores(id) on delete cascade,
  campeao_id text not null references public.tc_campeoes(id),
  pontos int not null default 0 check (pontos >= 0),
  jogos int not null default 0,
  vitorias int not null default 0,
  favorito boolean not null default false,
  primary key (jogador_id, campeao_id)
);
create index if not exists tc_maestria_fav on public.tc_maestria (jogador_id) where favorito;
alter table public.tc_maestria enable row level security;
revoke all on public.tc_maestria from anon, authenticated;

-- Nível de maestria (1 a 5) para uma quantidade de pontos, e o bônus de Poder (em %) desse nível.
create or replace function public.tc_maestria_nivel(pts int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(i), 1) from (
    select i::int as i, (v)::int as lim from jsonb_array_elements_text(tc_cfg('maestria')->'niveis') with ordinality as t(v, i)
  ) n where pts >= n.lim;
$$;
revoke all on function public.tc_maestria_nivel(int) from public, anon, authenticated;

create or replace function public.tc_bonus_nivel(nivel int)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((tc_cfg('maestria')->'bonus_pct'->>(greatest(nivel, 1) - 1))::numeric, 0);
$$;
revoke all on function public.tc_bonus_nivel(int) from public, anon, authenticated;

-- Bônus (em %) que o jogador ganha ao jogar com o campeão: só vale para os favoritos.
create or replace function public.tc_bonus_campeao(jid bigint, campeao text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select tc_bonus_nivel(tc_maestria_nivel(m.pontos)) from tc_maestria m
                    where m.jogador_id = jid and m.campeao_id = campeao and m.favorito), 0);
$$;
revoke all on function public.tc_bonus_campeao(bigint, text) from public, anon, authenticated;

-- Recalcula os favoritos: os `favoritos_max` campeões de mais pontos, desde que tenham o mínimo (`limiar`).
create or replace function public.tc_recalcular_favoritos(jid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  maxf int := coalesce((tc_cfg('maestria')->>'favoritos_max')::int, 5);
  lim int := coalesce((tc_cfg('maestria')->>'limiar')::int, 150);
begin
  update tc_maestria set favorito = false where jogador_id = jid and favorito;
  update tc_maestria m set favorito = true
   where m.jogador_id = jid
     and m.campeao_id in (select campeao_id from tc_maestria
                           where jogador_id = jid and pontos >= lim
                           order by pontos desc, jogos desc, campeao_id limit maxf);
end;
$$;
revoke all on function public.tc_recalcular_favoritos(bigint) from public, anon, authenticated;

-- Segurança extra: nunca mais de `favoritos_max` favoritos por jogador, nem por erro de código futuro.
create or replace function public.tc_maestria_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.favorito and (select count(*) from tc_maestria where jogador_id = new.jogador_id and favorito
                          and campeao_id <> new.campeao_id) >= coalesce((tc_cfg('maestria')->>'favoritos_max')::int, 5) then
    raise exception 'favoritos_demais';
  end if;
  return new;
end;
$$;
drop trigger if exists tc_maestria_limite on public.tc_maestria;
create trigger tc_maestria_limite before insert or update of favorito on public.tc_maestria
  for each row execute function public.tc_maestria_limite();

-- Gancho da simulação: o jogador usou `campeao` num mapa. Soma pontos e atualiza os favoritos.
create or replace function public.tc_maestria_registrar(jid bigint, campeao text, vitoria boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  ganho int := case when vitoria then coalesce((tc_cfg('maestria')->>'pontos_vitoria')::int, 30)
                                 else coalesce((tc_cfg('maestria')->>'pontos_derrota')::int, 15) end;
begin
  insert into tc_maestria (jogador_id, campeao_id, pontos, jogos, vitorias)
    values (jid, campeao, ganho, 1, case when vitoria then 1 else 0 end)
  on conflict (jogador_id, campeao_id) do update
    set pontos = tc_maestria.pontos + ganho, jogos = tc_maestria.jogos + 1, vitorias = tc_maestria.vitorias + (case when vitoria then 1 else 0 end);
  perform tc_recalcular_favoritos(jid);
end;
$$;
revoke all on function public.tc_maestria_registrar(bigint, text, boolean) from public, anon, authenticated;

-- Maestria inicial (determinística): de 3 a 5 campeões da posição do jogador, com pontos proporcionais à experiência.
create or replace function public.tc_semear_campeoes(jid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  n int; i int; c text;
  pool text[];
begin
  select * into j from tc_jogadores where id = jid;
  if j.id is null or exists (select 1 from tc_maestria where jogador_id = jid) then return; end if;
  select array_agg(id order by md5(id || ':' || jid::text)) into pool
    from tc_campeoes where ativo and (j.pos = any(posicoes) or posicoes && j.pos2);
  if pool is null then return; end if;
  n := least(array_length(pool, 1), 3 + floor(tc_u('mae:n:' || jid::text, 1) * 3)::int);
  for i in 1..n loop
    c := pool[i];
    insert into tc_maestria (jogador_id, campeao_id, pontos, jogos, vitorias)
      values (jid, c, greatest(0, round((j.exp * 22 + tc_u('mae:p:' || jid::text, i) * 700) / (1 + (i - 1) * 0.55))::int), 0, 0);
  end loop;
  perform tc_recalcular_favoritos(jid);
end;
$$;
revoke all on function public.tc_semear_campeoes(bigint) from public, anon, authenticated;

create or replace function public.tc_semear_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform tc_semear_campeoes(new.id);
  return new;
end;
$$;
drop trigger if exists tc_jogadores_semear on public.tc_jogadores;
create trigger tc_jogadores_semear after insert on public.tc_jogadores
  for each row execute function public.tc_semear_trg();

-- Jogadores que já existem ganham a maestria inicial.
select tc_semear_campeoes(id) from public.tc_jogadores;

-- Catálogo para a tela (quem pode jogar já passa pelo mesmo bloqueio do resto do jogo).
create or replace function public.tc_campeoes_lista()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform tc_exigir(auth.uid());
  return jsonb_build_object(
    'maestria', tc_cfg('maestria'),
    'campeoes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'ano', ano, 'posicoes', to_jsonb(posicoes),
                 'classes', to_jsonb(classes), 'regioes', to_jsonb(regioes), 'especies', to_jsonb(especies), 'alcance', to_jsonb(alcance)) order by nome)
                 from tc_campeoes where ativo), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_campeoes_lista() from public, anon;
grant execute on function public.tc_campeoes_lista() to authenticated;

-- Ficha do jogador passa a trazer os campeões com maestria (favoritos primeiro).
create or replace function public.tc_ficha_jogador(jid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  j tc_jogadores;
  meu bigint;
begin
  perform tc_exigir(uid);
  select id into meu from tc_orgs where user_id = uid;
  select * into j from tc_jogadores where id = jid;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  -- Potencial só aparece para o dono e no mercado oficial (jogador sem dono).
  return tc_jogador_json(j, j.org_id is null or j.org_id = meu)
    || jsonb_build_object('org', case when j.org_id is null then null else tc_org_json(j.org_id) end,
                          'campeoes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'pontos', m.pontos, 'jogos', m.jogos, 'vitorias', m.vitorias,
                                                   'favorito', m.favorito, 'nivel', tc_maestria_nivel(m.pontos),
                                                   'bonus_pct', case when m.favorito then tc_bonus_nivel(tc_maestria_nivel(m.pontos)) else 0 end)
                                                   order by m.favorito desc, m.pontos desc, c.nome)
                                                  from (select * from tc_maestria where jogador_id = j.id order by favorito desc, pontos desc limit 10) m join tc_campeoes c on c.id = m.campeao_id), '[]'::jsonb),
                          'historico', coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'valor', t.valor, 'moeda', t.moeda, 'criado', t.criado,
                                                   'de', (select nome from tc_orgs where id = t.de_org), 'para', (select nome from tc_orgs where id = t.para_org)) order by t.id desc)
                                                  from (select * from tc_transf where jogador_id = j.id order by id desc limit 15) t), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_ficha_jogador(bigint) from public, anon;
grant execute on function public.tc_ficha_jogador(bigint) to authenticated;
