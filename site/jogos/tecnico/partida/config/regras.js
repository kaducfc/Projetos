// Configuração central da simulação: todos os números de equilíbrio ficam aqui. Nenhuma regra de movimento ou de IA tem
// valor "escondido" no código; para ajustar o jogo, altere este arquivo (ou passe `regras` ao criar a partida).
// Unidades: distância em unidades de mundo (10 por pixel do mapa), tempo em segundos, velocidade em unidades por segundo.
export const REGRAS = {
  versao: 1,
  passo: 0.1,                 // segundos de jogo por passo fixo da simulação
  limiteTecnico: 4800,        // proteção contra travamento (segundos de jogo). Se atingido, a partida é registrada como "interrompida", sem vencedor inventado
  velocidades: [1, 2, 4, 8, 16, 32],
  velocidadePadrao: 8,
  maxPassosPorQuadro: 400,    // evita que um quadro atrasado cause um salto enorme

  // ---- atributos do simulador -> parâmetros de combate (função central em config/atributos.js)
  atributos: {
    forca:  [0.88, 1.12],                                   // desempenho geral derivado dos cinco atributos (peso do Poder)
    mec:    { dano: [0.90, 1.10], acerto: [0.58, 0.92], farm: [0.35, 1.0] }, // multiplicador de dano de habilidades; chance de acertar projéteis; chance de garantir o último golpe (farm)
    rotas:  { troca: [0.95, 1.06], fim: 840 },              // qualidade das trocas de dano na rota; as vantagens somem após `fim` segundos
    macro:  { decisao: [1.25, 0.8], ruido: [0.35, 0.08] },  // multiplicador do intervalo de decisão; ruído nas avaliações de risco
    tf:     { luta: [0.93, 1.10] },                         // multiplicador de dano e resistência em lutas com 3+ campeões
    mental: { erro: [0.12, 0.02], tilt: 0.06 },             // chance de decisão ruim; perda de desempenho máxima quando atrás e com mental baixo
  },

  // ---- economia
  economia: {
    ouroInicial: 500, ouroPassivo: 2.0, ouroPassivoInicio: 110,   // ouro/s; começa aos 1:50
    abate: 300, assistenciaPct: 0.5, bonusPrimeiroAbate: 100,
    escalaOuro: 1.35, escalaXp: 1.3,   // ajuste global de ritmo: a partida é uma versão resumida de um jogo de minimapa
    nivelMax: 18,
    xpNivel: [0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360],
    xpAbate: [42, 42, 66, 90, 114, 138, 162, 186, 210, 234, 258, 282, 306, 330, 354, 378, 402, 426],
    raioXp: 1600,             // aliados nesta distância dividem a experiência de um abate de unidade
    torre: { ouro: 250, ouroEquipe: 50 },
    inibidor: { ouro: 50 },
  },

  // ---- campeões
  campeao: {
    velocidade: 335, raio: 60, aquisicao: 1250, visao: 1300,
    respawn: [6, 6, 8, 8, 10, 12, 16, 21, 26.5, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5],
    respawnPorMinuto: 0.0128, respawnInicioEscala: 900, respawnMaxFator: 1.5,
    regenBase: 0.0075,        // fração da vida máxima por segundo
    regenBase_mana: 0.006,
    regenFonte: 0.12,         // fração por segundo na fonte da base
    recall: { canal: 8, raioFonte: 700, vidaBaixa: 0.35 },
    saida: { jungleAtrasoInicial: 0, espacamento: 120 },
    ouroCompraMin: 350,
  },

  // ---- minions
  minions: {
    // Último golpe de campeão em rota (a chance vem da Mecânica: atributos.mec.farm): tolerância do intervalo de ataque (s), alcance extra
    // e janela de farm na rota (u.), fator de acerto na janela, fator do suporte e fração do intervalo de ataque gasta ao garantir o golpe.
    farm: { tolerancia: 2, raioExtra: 450, raioJanela: 3500, fatorJanela: 0.95, suporte: 0.12, cadencia: 0.45 },
    primeiraOnda: 32.5, intervaloOnda: 30, csCanhao: 4, espacamentoSpawn: 0.8, // 1ª onda aos 0:32 (metade da espera original); o canhão conta como 4 minions no farm
    cercoCadaOnda: [[0, 3], [900, 2], [1500, 1]],   // a partir de X segundos, um canhão a cada N ondas
    crescimentoCada: 90, crescimento: { hp: 0.06, dano: 0.04 },
    aquisicao: 800, persistencia: 2.5, ociosoMax: 90,   // segundos parado e sem alvo antes de o minion ser retirado (e contado nos diagnósticos)
    onda: ['corpo', 'corpo', 'corpo', 'corpo', 'conjurador', 'conjurador', 'conjurador'], // composição de cada onda (mais o canhão a cada N ondas)
    tipos: {
      corpo:     { hp: 477, dano: 12,  armadura: 0,  resist: 0,  vel: 325, alcance: 110, intervalo: 1.25, ouro: 21, xp: 60,  raio: 45, proj: 0 },
      conjurador:{ hp: 296, dano: 23,  armadura: 0,  resist: 0,  vel: 325, alcance: 550, intervalo: 1.6,  ouro: 14, xp: 30,  raio: 40, proj: 1000 },
      cerco:     { hp: 900, dano: 40,  armadura: 0,  resist: 0,  vel: 325, alcance: 300, intervalo: 1.2,  ouro: 60, xp: 93,  raio: 55, proj: 1100 },
      super:     { hp: 1500, dano: 140, armadura: 40, resist: 30, vel: 360, alcance: 170, intervalo: 0.85, ouro: 40, xp: 97,  raio: 60, proj: 0 },
    },
  },

  // ---- estruturas
  estruturas: {
    torre: {
      1: { hp: 3200, dano: 140, armadura: 50, resist: 50, alcance: 775, intervalo: 0.9 },
      2: { hp: 3400, dano: 150, armadura: 55, resist: 55, alcance: 775, intervalo: 0.9 },
      3: { hp: 3400, dano: 160, armadura: 60, resist: 60, alcance: 775, intervalo: 0.9 },
      4: { hp: 3000, dano: 170, armadura: 60, resist: 60, alcance: 775, intervalo: 0.9 },
    },
    danoEscalaPorTiro: 0.4, danoEscalaMax: 3,   // dano extra acumulado ao repetir o mesmo alvo (fração do dano base, por tiro, até o limite)
    protecaoInicial: { ate: 300, reducao: 0.5 }, // primeiros minutos: as torres externas resistem melhor
    sentinela: 0.35,                            // dano de campeões reduzido sem minion aliado por perto (proteção contra "backdoor")
    raioMinionPerto: 700,
    inibidor: { hp: 2600, armadura: 20, resist: 20, respawn: 300, raio: 80 },
    nexus: { hp: 3800, armadura: 0, resist: 0, regen: 8, raio: 130, exige: 'ambas' }, // exige: torres do Nexus ('ambas' | 'uma')
    prioridadeTorre: { agressor: 1.0, cerco: 0.8, corpo: 0.7, conjurador: 0.6, super: 0.65, campeao: 0.5 },
    duracaoAgressor: 2.0,
  },

  // ---- selva
  selva: {
    primeiroSpawn: 90, respawn: 135, respawnBuff: 300, primeiroSpawnCaranguejo: 210, respawnCaranguejo: 150,
    aquisicao: 650, leash: 1600, regenFora: 0.35,
    resetSemCombateS: 4, resetRecuperaS: 2, // monstros e épicos sem tomar dano por 4 s recuperam toda a vida em 2 s
    escalaVida: 0.55, escalaDano: 0.45, // ajuste de equilíbrio global dos monstros (a selva tem de ser limpável por um campeão com sustentação)
    sustentoAtaque: 0.35,                // fração do dano de ataque que o jungler recupera ao bater em monstros
    campos: {
      sentinela:   { monstros: [{ n: 'Sentinela Azul', hp: 2300, dano: 70, intervalo: 1.2, alcance: 175, raio: 85, ouro: 95, xp: 150, off: [0, 0] }, { n: 'Sentinelinha', hp: 700, dano: 25, intervalo: 1.2, alcance: 175, raio: 50, ouro: 0, xp: 40, off: [-110, 90] }, { n: 'Sentinelinha', hp: 700, dano: 25, intervalo: 1.2, alcance: 175, raio: 50, ouro: 0, xp: 40, off: [110, 90] }], buff: 'azul', respawn: 300 },
      brambleback: { monstros: [{ n: 'Brambleback', hp: 2300, dano: 75, intervalo: 1.2, alcance: 175, raio: 85, ouro: 95, xp: 150, off: [0, 0] }, { n: 'Espinho', hp: 700, dano: 25, intervalo: 1.2, alcance: 175, raio: 50, ouro: 0, xp: 40, off: [-110, 90] }, { n: 'Espinho', hp: 700, dano: 25, intervalo: 1.2, alcance: 175, raio: 50, ouro: 0, xp: 40, off: [110, 90] }], buff: 'vermelho', respawn: 300 },
      gromp:       { monstros: [{ n: 'Gromp', hp: 2050, dano: 80, intervalo: 1.3, alcance: 175, raio: 80, ouro: 105, xp: 120, off: [0, 0] }] },
      lobos:       { monstros: [{ n: 'Lobo Cinzento', hp: 1600, dano: 45, intervalo: 1.1, alcance: 175, raio: 70, ouro: 55, xp: 100, off: [0, 0] }, { n: 'Lobinho', hp: 550, dano: 20, intervalo: 1.1, alcance: 175, raio: 45, ouro: 25, xp: 30, off: [-100, 80] }, { n: 'Lobinho', hp: 550, dano: 20, intervalo: 1.1, alcance: 175, raio: 45, ouro: 25, xp: 30, off: [100, 80] }] },
      raptores:    { monstros: [{ n: 'Raptor Carmesim', hp: 1250, dano: 55, intervalo: 1.0, alcance: 175, raio: 65, ouro: 50, xp: 80, off: [0, 0] }, { n: 'Raptorzinho', hp: 400, dano: 18, intervalo: 1.0, alcance: 175, raio: 38, ouro: 14, xp: 20, off: [-120, 90] }, { n: 'Raptorzinho', hp: 400, dano: 18, intervalo: 1.0, alcance: 175, raio: 38, ouro: 14, xp: 20, off: [120, 90] }, { n: 'Raptorzinho', hp: 400, dano: 18, intervalo: 1.0, alcance: 175, raio: 38, ouro: 14, xp: 20, off: [-60, 140] }, { n: 'Raptorzinho', hp: 400, dano: 18, intervalo: 1.0, alcance: 175, raio: 38, ouro: 14, xp: 20, off: [60, 140] }] },
      krugs:       { monstros: [{ n: 'Krug Anciao', hp: 2000, dano: 70, intervalo: 1.2, alcance: 175, raio: 75, ouro: 70, xp: 120, off: [0, 0] }, { n: 'Krug Médio', hp: 900, dano: 35, intervalo: 1.2, alcance: 175, raio: 50, ouro: 30, xp: 40, off: [-110, 90] }, { n: 'Krug Médio', hp: 900, dano: 35, intervalo: 1.2, alcance: 175, raio: 50, ouro: 30, xp: 40, off: [110, 90] }] },
      caranguejo:  { monstros: [{ n: 'Caranguejo', hp: 1400, dano: 0, intervalo: 9, alcance: 0, raio: 55, ouro: 70, xp: 120, off: [0, 0], passivo: true }], respawn: 150 },
    },
    buffs: { azul: { dur: 120, mana: 1.5, cdr: 0.1 }, vermelho: { dur: 120, ad: 0.08, lentidaoDot: 0.1 } },
  },

  // ---- objetivos épicos
  epicos: {
    dragao:  { hp: 4200, dano: 80, armadura: 25, resist: 25, alcance: 400, intervalo: 1.6, spawn: 300, respawn: 300, aquisicao: 800, ouro: 100, xp: 400, raio: 150, leash: 1200, bonusEquipe: { ouro: 25 }, pilha: { dano: 0.03, resist: 0.02 }, almaPilhas: 4, alma: { dano: 0.07, duracao: 0 } },
    anciao:  { hp: 8000, dano: 160, armadura: 40, resist: 40, alcance: 450, intervalo: 1.4, spawn: 420, respawn: 360, aquisicao: 900, ouro: 150, xp: 700, raio: 170, leash: 1300, efeito: { duracao: 150, dano: 0.15 }, aposAlma: true },
    arauto:  { hp: 5500, dano: 90, armadura: 30, resist: 30, alcance: 400, intervalo: 1.6, spawn: 480, desaparece: 1185, aquisicao: 800, ouro: 100, xp: 250, raio: 160, leash: 1200, carga: { hp: 2500, danoEstrutura: 700, intervalo: 1.0, vel: 280, duracao: 100 } },
    barao:   { hp: 9000, dano: 190, armadura: 60, resist: 60, alcance: 480, intervalo: 1.3, spawn: 1200, respawn: 360, aquisicao: 900, ouro: 300, xp: 900, raio: 190, leash: 1300, efeito: { duracao: 180, ad: 0, ap: 0, vel: 0, minion: { hp: 0.5, dano: 0.2 } } }, // buff do Barão: aura roxa nos minions perto de um campeão com o buff (alcance = distância entre a T1 e a T2 do meio, calculada do mapa)
    avaliacao: { margemRisco: 0.15, tempoAjuda: 12 },
  },

  // ---- combate
  combate: {
    dano: { variacaoCritico: 0, minimo: 1 },
    resistenciaCC: { janela: 4.0, reducao: 0.5, minimo: 0.25 }, // CC repetido em sequência fica mais curto (nunca incapacitado para sempre)
    duracaoMaxCC: 2.5,
    tempoMortoPersistencia: 3,
    janelaAssistencia: 10,
    persecucaoMax: 2200,      // um campeão desiste de perseguir além desta distância do ponto de origem da perseguição
  },

  // ---- IA
  ia: {
    intervaloDecisao: 0.6, intervaloEstrategia: 2.0,
    perigo: { vidaBaixa: 0.32, vidaCritica: 0.2, margemLuta: 1.12 },
    recallIntervaloMin: 150,                                       // segundos mínimos entre duas idas à base só por ouro (a vida baixa ainda volta antes)
    faseDeRotas: { ate: 840, dragaoDesde: 420, arautoDesde: 600 }, // até `ate`, os laners ficam farmando: o primeiro Dragão só depois de `dragaoDesde` e o Arauto depois de `arautoDesde` (s)
    gank: { intervalo: 5, pontuacaoMin: 55, duracaoMax: 22, vidaMin: 0.55, tempoMin: 190, esfriamento: 45 },
    rotacao: { tempoMin: 840, intervalo: 8 },
    objetivoMargem: 1.25,
    distanciaSegura: { corpo: 220, distancia: 520 },
    visaoPersistencia: 6,
  },

  // ---- fases macro (segundos)
  fases: { inicial: 840, intermediaria: 1500 },
};

export function mesclarRegras(base, extra) {
  if (!extra) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(extra)) {
    out[k] = (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') ? mesclarRegras(base[k], extra[k]) : extra[k];
  }
  return out;
}
