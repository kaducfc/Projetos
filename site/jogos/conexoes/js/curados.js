// Grupos escritos à mão (itens, feitiços, runas, mapa, monstros, jogadas, eSports, lore…). Cada um tem:
//   dif  1 (fácil) a 4 (difícil): decide a cor do grupo no quebra-cabeça e quais grupos se misturam;
//   fam  a "família": um quebra-cabeça nunca usa duas vezes a mesma família (evita grupos parecidos juntos);
//   tit  o título que aparece quando o jogador acerta;
//   p    as palavras (como aparecem no jogo em português, de preferência curtas).
// Para acrescentar um grupo, basta uma nova linha aqui: os testes conferem tamanho, duplicatas e conflitos.
const c = (dif, fam, tit, palavras) => ({ dif, fam, tit, p: palavras.split('|') });

export const CURADOS = [
  // ---------------------------------------------------------------- fáceis
  c(1, 'posicao', 'Posições do time', 'Top|Jungle|Mid|ADC|Suporte'),
  c(1, 'feitico', 'Feitiços de invocador', 'Flash|Incendiar|Teleporte|Curar|Barreira|Exaustão|Fantasma|Purificar|Golpear|Clareza'),
  c(1, 'elo', 'Elos do ranqueado', 'Ferro|Bronze|Prata|Ouro|Platina|Esmeralda|Diamante|Mestre|Grão-Mestre|Desafiante'),
  c(1, 'liga', 'Ligas profissionais', 'CBLOL|LCK|LPL|LEC|LCS|LLA|PCS|VCS'),
  c(1, 'epico', 'Objetivos épicos', 'Barão Nashor|Arauto do Vale|Dragão Elemental|Dragão Ancião|Larvas do Vazio'),
  c(1, 'regiaoN', 'Regiões de Runeterra', 'Demacia|Noxus|Ionia|Freljord|Piltover|Zaun|Shurima|Targon|Ixtal|Bandópolis|Águas de Sentina|Ilhas das Sombras|Vazio'),
  c(1, 'classeN', 'Classes de campeões', 'Mago|Assassino|Atirador|Lutador|Tanque|Suporte'),
  c(1, 'multikill', 'Anúncios de abates', 'First Blood|Double Kill|Triple Kill|Quadra Kill|Penta Kill|Ace|Shutdown|Killing Spree|Rampage|Unstoppable'),

  // ---------------------------------------------------------------- médios
  c(2, 'modo', 'Modos de jogo', 'ARAM|URF|Clash|Arena|Nexus Blitz|Um por Todos|Ranqueada Solo|Flex|Normal Cega|Treinamento'),
  c(2, 'runa', 'Árvores de runas', 'Precisão|Dominação|Feitiçaria|Determinação|Inspiração'),
  c(2, 'selvaM', 'Monstros da selva', 'Gromp|Krugs|Lobos|Raptores|Caranguejo|Sentinela Azul'),
  c(2, 'dragao', 'Tipos de dragão', 'Dragão Infernal|Dragão do Oceano|Dragão da Montanha|Dragão das Nuvens|Dragão Hextec'),
  c(2, 'estrutura', 'Estruturas do mapa', 'Torre|Inibidor|Nexus|Fonte|Base'),
  c(2, 'mapa', 'Lugares do mapa', 'Rio|Selva|Arbusto|Rota|Base|Parede|Fonte'),
  c(2, 'bota', 'Botas', 'Grevas do Berserker|Botas de Mercúrio|Tabi Ninja|Botas do Feiticeiro|Botas de Mobilidade|Botas Iônicas da Lucidez|Botas de Velocidade'),
  c(2, 'itemI', 'Itens iniciais', 'Lâmina de Doran|Anel de Doran|Escudo de Doran|Poção de Vida|Poção Reutilizável'),
  c(2, 'itemAD', 'Itens de dano físico', 'Gume do Infinito|Sede de Sangue|Dança da Morte|Cutelo Negro|Força da Trindade|Lâmina do Rei Destruído|Lembranças de Lorde Dominik'),
  c(2, 'itemAP', 'Itens de poder de habilidade', 'Capuz da Morte de Rabadon|Cajado do Vazio|Ampulheta de Zhonya|Tormento de Liandry|Eco de Luden|Morellonomicon|Cetro de Cristal de Rylai'),
  c(2, 'itemT', 'Itens de tanque', 'Cota de Espinhos|Armadura de Warmog|Presságio de Randuin|Coração de Aço|Coração Congelado|Máscara Abissal'),
  c(2, 'itemC', 'Itens básicos (componentes)', 'Espada Longa|Adaga|Tomo Amplificador|Cristal de Rubi|Cristal de Safira|Armadura de Tecido|Manto Anulador|Espada B.F.|Picareta|Cajado Grande e Desnecessário'),
  c(2, 'itemS', 'Itens de suporte', 'Redenção|Crisol de Mikael|Incenso Ardente|Medalhão dos Solari de Ferro|Convergência de Zeke'),
  c(2, 'time', 'Times do CBLOL', 'LOUD|paiN Gaming|FURIA|RED Canids|Vivo Keyd Stars|Fluxo|Los Grandes|INTZ|KaBuM|Flamengo|Netshoes Miners'),
  c(2, 'skin', 'Linhas de skins', 'Arcane|K/DA|Pentakill|Projeto|Guardiões Estelares|Flor Espiritual|Lua Sangrenta|Festa na Piscina|Academia de Batalha|Super Galáxia|Odisseia'),
  c(2, 'sigla', 'Siglas do jogo', 'ADC|AFK|KDA|CS|GG|MMR|AP|AD|HP|CC'),
  c(2, 'jogada', 'Jogadas e estratégias', 'Gank|Roam|Farm|Push|Freeze|Split|Dive|Poke|Kite|Peel|Engage|Flank|Snowball|Trade'),
  c(2, 'apelido', 'Tipos de jogador (gíria)', 'Smurf|Troll|Feeder|Noob|Carry|Main|Tryhard|Boosted'),
  c(2, 'cc', 'Efeitos de controle', 'Atordoamento|Lentidão|Silêncio|Enraizamento|Medo|Provocação|Sono|Cegueira|Encanto|Supressão'),

  // ---------------------------------------------------------------- difíceis
  c(3, 'runaK', 'Runas principais', 'Conquistador|Eletrocutar|Colheita Sombria|Pressione o Ataque|Ritmo Fatal|Cometa Arcano|Aperto dos Mortos|Guardião|Pós-Choque|Invocar Aery|Primeiro Golpe|Glacial Aumentado'),
  c(4, 'itemN', 'Itens que levam o nome de alguém', 'Rabadon|Zhonya|Randuin|Liandry|Luden|Rylai|Warmog|Mikael|Doran|Guinsoo|Youmuu|Seraph|Morello'),
  c(3, 'recurso', 'Recursos além da mana', 'Energia|Fúria|Calor|Fluxo|Coragem|Ferocidade'),
  c(3, 'cliente', 'Dentro do cliente do jogo', 'Lobby|Loja|Maestria|Baú Hextec|Essência Azul|Essência Laranja|Missões|Coleção|Passe de Batalha'),
  c(3, 'jogador', 'Lendas dos eSports', 'Faker|Uzi|Caps|Rekkles|Doublelift|Bjergsen|Chovy|Canyon|Keria|Gumayusi|ShowMaker|Perkz|Zeus|Oner'),
  c(3, 'skin', 'Grupos musicais do LoL', 'K/DA|True Damage|Pentakill|HEARTSTEEL'),
  c(3, 'arcane', 'Personagens de Arcane (que não são campeões)', 'Silco|Vander|Sevika|Mylo|Claggor|Powder|Benzo|Marcus|Grayson'),
  c(3, 'verbo', 'Verbos que viraram gíria', 'Gankar|Farmar|Feedar|Tiltar|Splitar|Kitear|Smurfar|Flamar|Reportar|Carregar'),
  c(3, 'povo', 'Povos e criaturas de Runeterra', 'Yordle|Vastaya|Darkin|Celestial|Troll|Brackern|Minotauro|Yeti'),
  c(3, 'rank', 'Termos de ranqueada', 'PDL|Divisão|Promoção|Rebaixamento|Decay|Elojob|Série'),

  c(3, 'raridade', 'Raridades de skins', 'Épica|Lendária|Mítica|Transcendente|Prestígio'),
  c(3, 'torneio', 'Torneios internacionais', 'Mundial|MSI|First Stand|Rift Rivals|All-Star|Worlds'),
  c(2, 'jogosRiot', 'Jogos da Riot Games', 'League of Legends|VALORANT|Teamfight Tactics|Legends of Runeterra|Wild Rift|2XKO'),
  c(2, 'nota', 'Notas de desempenho', 'S+|S|A|B|C|D'),
  c(2, 'placar', 'Números do placar', 'Abates|Mortes|Assistências|Ouro|Dano|Visão|Tropas'),
  c(2, 'minion', 'Tipos de minion', 'Minion Corpo a Corpo|Minion Conjurador|Minion de Cerco|Super Minion'),
  c(2, 'atributo', 'Atributos dos campeões', 'Armadura|Resistência Mágica|Vida|Mana|Velocidade de Ataque|Velocidade de Movimento|Chance de Crítico|Roubo de Vida|Aceleração de Habilidade'),
  c(2, 'fase', 'Momentos da partida', 'Early Game|Mid Game|Late Game|Fase de Rotas|Luta em Equipe'),
  c(2, 'dano', 'Tipos de dano', 'Dano Físico|Dano Mágico|Dano Verdadeiro|Dano Misto'),
  c(2, 'itemAD', 'Itens para atiradores', 'Gume do Infinito|Dançarino Fantasma|Furacão de Runaan|Lembranças de Lorde Dominik|Sede de Sangue'),

  // ---------------------------------------------------------------- bem difíceis
  c(4, 'mundial', 'Campeões mundiais', 'Fnatic|Taipei Assassins|Samsung Galaxy|Invictus Gaming|FunPlus Phoenix|DAMWON|Edward Gaming|DRX|T1'),
  c(4, 'companheiro', 'Companheiros de campeões', 'Tibbers|Willump|Skaarl|Daisy|Pix'),
  c(4, 'hino', 'Músicas do Mundial', 'Warriors|Legends Never Die|RISE|Phoenix|Take Over|Burn It All Down|Star Walkin\'|GODS|Heavy Is the Crown'),
  c(4, 'membro', 'Membros do K/DA', 'Ahri|Akali|Evelynn|Kai\'Sa|Seraphine'),
  c(4, 'membro', 'Membros do True Damage', 'Akali|Ekko|Qiyana|Senna|Yasuo'),
];
