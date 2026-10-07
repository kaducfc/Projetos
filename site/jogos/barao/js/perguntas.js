// Banco de perguntas do Show do Barão. Cada uma: { q, a: [certa, errada, errada, errada], cat }.
// A resposta certa é SEMPRE a primeira de `a` aqui; o jogo embaralha as quatro na hora.
// Níveis: 1 (fácil, perguntas 1 a 5), 2 (média, 6 a 10) e 3 (difícil, 11 a 15).
// cat: 'jogo' (mecânicas e itens), 'lore' (universo) ou 'comp' (competitivo).
// Só entram fatos conferidos; na dúvida, a pergunta fica de fora.

const P = (cat, q, ...a) => ({ cat, q, a });

export const FACIL = [
  P('jogo', 'Qual empresa criou League of Legends?', 'Riot Games', 'Blizzard', 'Valve', 'Epic Games'),
  P('jogo', 'Em que ano League of Legends foi lançado?', '2009', '2006', '2011', '2013'),
  P('jogo', 'Quantos jogadores tem cada time em uma partida padrão do Summoner\'s Rift?', '5', '3', '4', '6'),
  P('jogo', 'Qual estrutura precisa ser destruída para vencer a partida?', 'O Nexus', 'A torre externa', 'O Barão Nashor', 'O inibidor'),
  P('lore', 'Como se chama o mundo onde se passa o universo de League of Legends?', 'Runeterra', 'Azeroth', 'Tamriel', 'Midgard'),
  P('lore', 'Qual série animada da Netflix se passa no universo de League of Legends?', 'Arcane', 'Castlevania', 'Cyberpunk: Edgerunners', 'Dota: Dragon\'s Blood'),
  P('lore', 'Em Arcane, quais são as irmãs protagonistas?', 'Vi e Jinx', 'Lux e Fiora', 'Ahri e Ashe', 'Katarina e Cassiopeia'),
  P('lore', 'Qual destes campeões é de Demacia?', 'Garen', 'Darius', 'Jinx', 'Ahri'),
  P('lore', 'Qual destes campeões é um yordle?', 'Teemo', 'Garen', 'Darius', 'Ashe'),
  P('jogo', 'Qual é a tecla padrão da habilidade suprema (ultimate) de um campeão?', 'R', 'Q', 'F', 'T'),
  P('jogo', 'Quantas habilidades ativas (Q, W, E e R) tem um campeão padrão?', '4', '3', '5', '6'),
  P('jogo', 'Qual é o nome do mapa principal 5 contra 5?', 'Summoner\'s Rift', 'Abismo dos Lamentos', 'Floresta Retorcida', 'Mapa dos Poros'),
  P('comp', 'Como se chama o campeonato mundial anual de League of Legends?', 'Worlds', 'MSI', 'All-Star', 'Rift Rivals'),
  P('comp', 'Qual é o principal campeonato brasileiro de League of Legends?', 'CBLOL', 'LCK', 'LEC', 'LCS'),
  P('comp', 'Faker é jogador de qual organização?', 'T1', 'G2 Esports', 'LOUD', 'Fnatic'),
  P('comp', 'Em qual posição Faker joga?', 'Meio (mid)', 'Topo', 'Selva', 'Suporte'),
  P('lore', 'Qual destes campeões é uma criatura do Vazio?', 'Cho\'Gath', 'Garen', 'Lux', 'Ashe'),
  P('lore', 'Qual campeão é famoso por plantar cogumelos explosivos?', 'Teemo', 'Ziggs', 'Heimerdinger', 'Jhin'),
  P('lore', 'Qual campeã atira flechas de gelo e é a rainha dos Avarosanos?', 'Ashe', 'Caitlyn', 'Vayne', 'Varus'),
  P('jogo', 'Quantos itens um campeão pode carregar no inventário principal (sem contar o totem)?', '6', '4', '5', '8'),
  P('jogo', 'Para que servem as sentinelas (wards)?', 'Dar visão do mapa', 'Curar aliados', 'Aumentar o ouro', 'Bloquear o caminho'),
  P('jogo', 'Qual feitiço de invocador dá um salto curto instantâneo?', 'Flash', 'Curar', 'Barreira', 'Fantasma'),
  P('comp', 'Qual país tem mais títulos mundiais de League of Legends?', 'Coreia do Sul', 'China', 'Estados Unidos', 'Brasil'),
];

export const MEDIA = [
  P('lore', 'Qual campeã é irmã de Garen?', 'Lux', 'Fiora', 'Quinn', 'Vayne'),
  P('lore', 'Qual campeão é irmão de Darius?', 'Draven', 'Swain', 'Talon', 'Sion'),
  P('lore', 'Qual campeã é irmã de Morgana?', 'Kayle', 'Leona', 'Soraka', 'Diana'),
  P('lore', 'Katarina é irmã de qual campeã?', 'Cassiopeia', 'LeBlanc', 'Elise', 'Camille'),
  P('lore', 'Qual destes campeões é de Shurima?', 'Azir', 'Ashe', 'Karma', 'Caitlyn'),
  P('lore', 'Qual destes campeões é de Freljord?', 'Tryndamere', 'Yasuo', 'Jayce', 'Nasus'),
  P('lore', 'Karthus é de qual região?', 'Ilhas das Sombras', 'Ionia', 'Piltover', 'Targon'),
  P('lore', 'Qual destas campeãs é de Targon?', 'Leona', 'Fiora', 'Irelia', 'Camille'),
  P('lore', 'Qual destes campeões é de Zaun?', 'Warwick', 'Caitlyn', 'Garen', 'Leona'),
  P('lore', 'Qual destes campeões é de Piltover?', 'Jayce', 'Darius', 'Ashe', 'Yone'),
  P('lore', 'Qual destas campeãs é de Águas de Sentina (Bilgewater)?', 'Miss Fortune', 'Lux', 'Ashe', 'Soraka'),
  P('lore', 'Qual destes campeões é de Noxus?', 'Swain', 'Garen', 'Tryndamere', 'Azir'),
  P('lore', 'Em Arcane, qual era o nome de Jinx antes de ela se tornar Jinx?', 'Powder', 'Violet', 'Caitlyn', 'Mylo'),
  P('jogo', 'Quantos dragões elementais é preciso derrotar para conquistar a Alma do Dragão?', '4', '3', '5', '6'),
  P('jogo', 'Qual modo de jogo usa o mapa Abismo dos Lamentos?', 'ARAM', 'Draft Pick', 'Ranqueada Solo', 'Arena'),
  P('jogo', 'Qual é o nível máximo de um campeão em uma partida?', '18', '15', '20', '25'),
  P('jogo', 'Qual runa-chave dispara dano ao acertar 3 ataques ou habilidades diferentes no mesmo alvo?', 'Eletrocutar', 'Conquistador', 'Pressione o Ataque', 'Colheita Sombria'),
  P('comp', 'Qual time venceu o Worlds de 2024?', 'T1', 'Bilibili Gaming', 'Gen.G', 'G2 Esports'),
  P('comp', 'Qual time venceu o Worlds de 2019, disputado em Paris?', 'FunPlus Phoenix', 'G2 Esports', 'SK Telecom T1', 'Invictus Gaming'),
  P('lore', 'Como se chama a tecnologia que une magia e ciência, criada por Jayce e Viktor?', 'Hextec', 'Runatec', 'Magitec', 'Cristaltec'),
  P('lore', 'Qual campeão é um dragão cósmico que forja estrelas?', 'Aurelion Sol', 'Shyvana', 'Smolder', 'Anivia'),
  P('lore', 'Qual destes campeões NÃO é um yordle?', 'Garen', 'Teemo', 'Tristana', 'Lulu'),
  P('lore', 'Qual destes campeões estava entre os primeiros lançados, na fase alfa do jogo?', 'Annie', 'Aphelios', 'Viego', 'Zeri'),
  P('jogo', 'Qual item aumenta muito o poder de habilidade de quem o carrega?', 'Chapéu Mortal de Rabadon', 'Lâmina do Rei Destruído', 'Armadura de Espinhos', 'Botas de Mercúrio'),
  P('lore', 'Qual campeão é conhecido como o rei pirata de Águas de Sentina?', 'Gangplank', 'Graves', 'Fizz', 'Nautilus'),
  P('lore', 'Em Arcane, quem criou Vi e Powder depois da morte dos pais?', 'Vander', 'Silco', 'Singed', 'Jayce'),
  P('comp', 'Qual time venceu o Worlds de 2023, disputado em Seul?', 'T1', 'Weibo Gaming', 'JD Gaming', 'Gen.G'),
];

export const DIFICIL = [
  P('comp', 'Qual time venceu o primeiro Worlds, em 2011?', 'Fnatic', 'Taipei Assassins', 'SK Telecom T1', 'Against All authority'),
  P('comp', 'De qual região era o Taipei Assassins, campeão mundial de 2012?', 'Taiwan', 'Coreia do Sul', 'China', 'América do Norte'),
  P('comp', 'Qual time venceu o Worlds de 2020, disputado em Xangai?', 'DAMWON Gaming', 'Suning', 'G2 Esports', 'Top Esports'),
  P('comp', 'Qual time venceu o Worlds de 2021, disputado em Reykjavik?', 'Edward Gaming', 'DWG KIA', 'T1', 'Cloud9'),
  P('comp', 'Qual time venceu o Worlds de 2022, em San Francisco?', 'DRX', 'T1', 'JD Gaming', 'Gen.G'),
  P('comp', 'Qual time venceu o Worlds de 2018, disputado na Coreia do Sul?', 'Invictus Gaming', 'Fnatic', 'G2 Esports', 'Cloud9'),
  P('comp', 'Qual time europeu foi vice-campeão do Worlds de 2019?', 'G2 Esports', 'Fnatic', 'Origen', 'Misfits'),
  P('comp', 'Em qual posição jogava Uzi, lenda chinesa do League of Legends?', 'Atirador (ADC)', 'Topo', 'Selva', 'Meio (mid)'),
  P('comp', 'Qual time venceu o Worlds de 2017, disputado em Pequim?', 'Samsung Galaxy', 'SK Telecom T1', 'Royal Never Give Up', 'Misfits'),
  P('lore', 'Qual rei perdeu a amada rainha Isolde e criou a Névoa Negra?', 'Viego', 'Mordekaiser', 'Swain', 'Jarvan III'),
  P('lore', 'Qual ordem ionia, de Shen e Kennen, mantém o equilíbrio entre os mundos?', 'Kinkou', 'Ordem das Sombras', 'Guarda Crownguard', 'Vigilantes'),
  P('lore', 'Qual campeão ergueu o Disco Solar e restaurou Shurima?', 'Azir', 'Nasus', 'Renekton', 'Xerath'),
  P('lore', 'Quem é o grande vilão de Zaun na primeira temporada de Arcane?', 'Silco', 'Vander', 'Singed', 'Heimerdinger'),
  P('lore', 'Qual yordle é Conselheiro de Piltover em Arcane?', 'Heimerdinger', 'Teemo', 'Tristana', 'Ziggs'),
  P('comp', 'Em qual cidade foi disputada a final do Worlds de 2023?', 'Seul', 'Paris', 'Londres', 'Xangai'),
  P('comp', 'Em qual cidade foi disputada a final do Worlds de 2024?', 'Londres', 'Seul', 'Paris', 'Berlim'),
  P('comp', 'Em que ano Faker conquistou o seu primeiro título mundial?', '2013', '2011', '2015', '2016'),
  P('comp', 'Qual time venceu o Worlds de 2016, em Los Angeles?', 'SK Telecom T1', 'Samsung Galaxy', 'Royal Never Give Up', 'ROX Tigers'),
  P('comp', 'Qual time venceu o Worlds de 2015, disputado em Berlim?', 'SK Telecom T1', 'KOO Tigers', 'Origen', 'Fnatic'),
  P('lore', 'Em Arcane, qual conselheira de Piltover tem origem noxiana?', 'Mel Medarda', 'Ambessa Medarda', 'Caitlyn Kiramman', 'Sevika'),
  P('lore', 'Qual é o título de Viego?', 'O Rei Arruinado', 'O Rei Caído', 'O Rei das Sombras', 'O Rei Esquecido'),
  P('lore', 'Em Arcane, quem transforma Vander no monstro Warwick?', 'Singed', 'Silco', 'Jayce', 'Viktor'),
];

export const BANCO = { 1: FACIL, 2: MEDIA, 3: DIFICIL };
