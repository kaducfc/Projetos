// Tabela de campeões do jogo (nome como aparece no cliente em português). Dela saem sozinhos os grupos "de campeões"
// (região, rota, classe, letra inicial, tamanho do nome…), então as listas são sempre completas e consistentes: se um
// campeão está numa região ou rota, nenhum quebra-cabeça o usa em outro grupo do mesmo tipo por engano.
//
// Colunas: nome | região | rota | classe | marcas
//   região: Demacia, Noxus, Ionia, Freljord, Piltover, Zaun, Shurima, Targon, Águas de Sentina, Ilhas das Sombras,
//           Bandópolis, Vazio, Ixtal; "Runeterra" = sem região de destaque (não entra em grupo de região).
//   rota:   Topo, Selva, Meio, Atirador, Suporte; "-" = joga em mais de uma (não entra em grupo de rota).
//   classe: a principal, entre Mago, Assassino, Atirador, Lutador, Tanque e Suporte.
//   marcas: Y = yordle, D = darkin, V = vastaya.
const TABELA = `
Aatrox|Runeterra|Topo|Lutador|D
Ahri|Ionia|Meio|Mago|V
Akali|Ionia|Meio|Assassino|
Akshan|Shurima|Meio|Atirador|
Alistar|Runeterra|Suporte|Tanque|
Ambessa|Noxus|Topo|Lutador|
Amumu|Shurima|Selva|Tanque|
Anivia|Freljord|Meio|Mago|
Annie|Noxus|Meio|Mago|
Aphelios|Targon|Atirador|Atirador|
Ashe|Freljord|Atirador|Atirador|
Aurelion Sol|Targon|Meio|Mago|
Azir|Shurima|Meio|Mago|
Bardo|Runeterra|Suporte|Suporte|
Bel'Veth|Vazio|Selva|Lutador|
Blitzcrank|Zaun|Suporte|Tanque|
Brand|Freljord|Suporte|Mago|
Braum|Freljord|Suporte|Tanque|
Briar|Noxus|Selva|Lutador|
Caitlyn|Piltover|Atirador|Atirador|
Camille|Piltover|Topo|Lutador|
Cassiopeia|Noxus|Meio|Mago|
Cho'Gath|Vazio|Topo|Tanque|
Corki|Bandópolis|Meio|Atirador|Y
Darius|Noxus|Topo|Lutador|
Diana|Targon|Selva|Lutador|
Dr. Mundo|Zaun|Topo|Tanque|
Draven|Noxus|Atirador|Atirador|
Ekko|Zaun|Selva|Assassino|
Elise|Ilhas das Sombras|Selva|Mago|
Evelynn|Runeterra|Selva|Assassino|
Ezreal|Piltover|Atirador|Atirador|
Fiddlesticks|Runeterra|Selva|Mago|
Fiora|Demacia|Topo|Lutador|
Fizz|Águas de Sentina|Meio|Assassino|Y
Galio|Demacia|Meio|Tanque|
Gangplank|Águas de Sentina|Topo|Lutador|
Garen|Demacia|Topo|Lutador|
Gnar|Freljord|Topo|Lutador|Y
Gragas|Freljord|Selva|Lutador|
Graves|Águas de Sentina|Selva|Atirador|
Gwen|Ilhas das Sombras|Topo|Lutador|
Hecarim|Ilhas das Sombras|Selva|Lutador|
Heimerdinger|Piltover|Meio|Mago|Y
Hwei|Ionia|Meio|Mago|
Illaoi|Águas de Sentina|Topo|Lutador|
Irelia|Ionia|Topo|Lutador|
Ivern|Ionia|Selva|Suporte|
Janna|Zaun|Suporte|Suporte|
Jarvan IV|Demacia|Selva|Lutador|
Jax|Runeterra|Topo|Lutador|
Jayce|Piltover|Topo|Lutador|
Jhin|Ionia|Atirador|Atirador|
Jinx|Zaun|Atirador|Atirador|
K'Sante|Shurima|Topo|Tanque|
Kai'Sa|Vazio|Atirador|Atirador|
Kalista|Ilhas das Sombras|Atirador|Atirador|
Karma|Ionia|Suporte|Mago|
Karthus|Ilhas das Sombras|Selva|Mago|
Kassadin|Vazio|Meio|Assassino|
Katarina|Noxus|Meio|Assassino|
Kayle|Demacia|Topo|Lutador|
Kayn|Ionia|Selva|Lutador|D
Kennen|Ionia|Topo|Mago|Y
Kha'Zix|Vazio|Selva|Assassino|
Kindred|Runeterra|Selva|Atirador|
Kled|Noxus|Topo|Lutador|Y
Kog'Maw|Vazio|Atirador|Atirador|
LeBlanc|Noxus|Meio|Assassino|
Lee Sin|Ionia|Selva|Lutador|
Leona|Targon|Suporte|Tanque|
Lillia|Ionia|Selva|Mago|V
Lissandra|Freljord|Meio|Mago|
Lucian|Demacia|Atirador|Atirador|
Lulu|Bandópolis|Suporte|Suporte|Y
Lux|Demacia|-|Mago|
Malphite|Runeterra|Topo|Tanque|
Malzahar|Vazio|Meio|Mago|
Maokai|Ilhas das Sombras|Suporte|Tanque|
Mestre Yi|Ionia|Selva|Assassino|
Milio|Ixtal|Suporte|Suporte|
Miss Fortune|Águas de Sentina|Atirador|Atirador|
Mordekaiser|Runeterra|Topo|Lutador|
Morgana|Demacia|Suporte|Mago|
Naafiri|Shurima|Meio|Assassino|D
Nami|Runeterra|Suporte|Suporte|
Nasus|Shurima|Topo|Tanque|
Nautilus|Águas de Sentina|Suporte|Tanque|
Neeko|Ixtal|Meio|Mago|V
Nidalee|Ixtal|Selva|Assassino|
Nilah|Runeterra|Atirador|Lutador|
Nocturne|Runeterra|Selva|Assassino|
Nunu e Willump|Freljord|Selva|Tanque|
Olaf|Freljord|Topo|Lutador|
Orianna|Piltover|Meio|Mago|
Ornn|Freljord|Topo|Tanque|
Pantheon|Targon|Topo|Lutador|
Poppy|Demacia|Topo|Tanque|Y
Pyke|Águas de Sentina|Suporte|Assassino|
Qiyana|Ixtal|Meio|Assassino|
Quinn|Demacia|Topo|Atirador|
Rakan|Ionia|Suporte|Suporte|V
Rammus|Shurima|Selva|Tanque|
Rek'Sai|Vazio|Selva|Lutador|
Rell|Noxus|Suporte|Tanque|
Renata Glasc|Zaun|Suporte|Suporte|
Renekton|Shurima|Topo|Lutador|
Rengar|Runeterra|Selva|Assassino|V
Riven|Noxus|Topo|Lutador|
Rumble|Bandópolis|Topo|Lutador|Y
Ryze|Runeterra|Meio|Mago|
Samira|Noxus|Atirador|Atirador|
Sejuani|Freljord|Selva|Tanque|
Senna|Ilhas das Sombras|Suporte|Atirador|
Seraphine|Piltover|Suporte|Mago|
Sett|Ionia|Topo|Lutador|V
Shaco|Runeterra|Selva|Assassino|
Shen|Ionia|Topo|Tanque|
Shyvana|Demacia|Selva|Lutador|
Singed|Zaun|Topo|Tanque|
Sion|Noxus|Topo|Tanque|
Sivir|Shurima|Atirador|Atirador|
Skarner|Shurima|Selva|Tanque|
Smolder|Runeterra|Atirador|Atirador|
Sona|Demacia|Suporte|Suporte|
Soraka|Targon|Suporte|Suporte|
Swain|Noxus|-|Mago|
Sylas|Demacia|Meio|Mago|
Syndra|Ionia|Meio|Mago|
Tahm Kench|Águas de Sentina|Suporte|Tanque|
Taliyah|Shurima|Selva|Mago|
Talon|Noxus|Meio|Assassino|
Taric|Targon|Suporte|Suporte|
Teemo|Bandópolis|Topo|Atirador|Y
Thresh|Ilhas das Sombras|Suporte|Suporte|
Tristana|Bandópolis|Atirador|Atirador|Y
Trundle|Freljord|Selva|Lutador|
Tryndamere|Freljord|Topo|Lutador|
Twisted Fate|Águas de Sentina|Meio|Mago|
Twitch|Zaun|Atirador|Atirador|
Udyr|Freljord|Selva|Lutador|
Urgot|Zaun|Topo|Lutador|
Varus|Ionia|Atirador|Atirador|D
Vayne|Demacia|Atirador|Atirador|
Veigar|Bandópolis|Meio|Mago|Y
Vel'Koz|Vazio|Meio|Mago|
Vex|Ilhas das Sombras|Meio|Mago|Y
Vi|Piltover|Selva|Lutador|
Viego|Ilhas das Sombras|Selva|Assassino|
Viktor|Zaun|Meio|Mago|
Vladimir|Noxus|Meio|Mago|
Volibear|Freljord|Topo|Lutador|
Warwick|Zaun|Selva|Lutador|
Wukong|Ionia|-|Lutador|V
Xayah|Ionia|Atirador|Atirador|V
Xerath|Shurima|Meio|Mago|
Xin Zhao|Demacia|Selva|Lutador|
Yasuo|Ionia|Meio|Lutador|
Yone|Ionia|-|Lutador|
Yorick|Ilhas das Sombras|Topo|Lutador|
Yuumi|Bandópolis|Suporte|Suporte|Y
Zac|Zaun|Selva|Tanque|
Zed|Ionia|Meio|Assassino|
Zeri|Zaun|Atirador|Atirador|
Ziggs|Bandópolis|Meio|Mago|Y
Zilean|Runeterra|Suporte|Suporte|
Zoe|Targon|Meio|Mago|
Zyra|Runeterra|Suporte|Mago|
`;

export const CAMPEOES = TABELA.trim().split('\n').map((linha) => {
  const [nome, regiao, rota, classe, marcas = ''] = linha.split('|');
  return { nome, regiao, rota, classe, yordle: marcas.includes('Y'), darkin: marcas.includes('D'), vastaya: marcas.includes('V') };
});
