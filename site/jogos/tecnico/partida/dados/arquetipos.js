// Arquétipos de campeão e habilidades como dados configuráveis (sem lógica exclusiva por personagem).
// Os 173 campeões do catálogo viram perfis a partir da classe, do alcance e de uma variação determinística (campeoes-sim.js).
//
// Habilidade: { id, nome, tipo, tecla, alcance, cd (s), custo (mana), uso, dano:{base,rank,ad,ap,fis}, alvo, ... }
//   tipo: 'alvo' (instantâneo) | 'projetil' (reta, tem velocidade/largura) | 'area' (círculo no chão, com atraso) | 'dash' (mobilidade) |
//         'escudo' | 'cura' | 'buff' | 'dot'
//   uso (para a IA): 'iniciar' | 'poke' | 'finalizar' | 'defesa' | 'fuga' | 'suporte' | 'sempre'
//   efeitos: [{ tipo: 'lentidao'|'stun'|'silencio', pct?, dur }]
//   dano.fis = true -> dano físico (escala com AD), senão mágico (escala com AP)
const H = (id, nome, tipo, tecla, o) => ({ id, nome, tipo, tecla, ...o });

export const ARQUETIPOS = {
  tanque: {
    nome: 'Tanque', funcao: 'engajar',
    base: { hp: 620, hpNv: 95, ad: 58, adNv: 3.2, armadura: 36, armNv: 4.8, resist: 32, resNv: 2.0, vel: 335, alcance: 175, as: 0.62, asNv: 0.015, mana: 320, manaNv: 40 },
    variantes: [
      [H('q', 'Golpe de Escudo', 'alvo', 'Q', { alcance: 250, cd: 7, custo: 40, uso: 'iniciar', dano: { base: 50, rank: 35, ad: 0.5, fis: true }, efeitos: [{ tipo: 'lentidao', pct: 0.3, dur: 1.5 }] }),
       H('w', 'Postura Firme', 'escudo', 'W', { alcance: 0, cd: 14, custo: 50, uso: 'defesa', escudo: { base: 60, rank: 35, hpPct: 0.05, dur: 3 } }),
       H('e', 'Investida', 'dash', 'E', { alcance: 650, cd: 16, custo: 60, uso: 'iniciar', dist: 500, dano: { base: 40, rank: 25, ad: 0.3, fis: true }, efeitos: [{ tipo: 'stun', dur: 0.8 }] }),
       H('r', 'Terremoto', 'area', 'R', { alcance: 0, raio: 450, cd: 110, custo: 100, uso: 'iniciar', atraso: 0.4, dano: { base: 150, rank: 90, ad: 0.6, fis: true }, efeitos: [{ tipo: 'stun', dur: 1.3 }] })],
      [H('q', 'Soco Sísmico', 'projetil', 'Q', { alcance: 900, largura: 90, vel: 1700, cd: 9, custo: 50, uso: 'iniciar', dano: { base: 60, rank: 40, hpPct: 0.04, ad: 0.3, fis: true }, efeitos: [{ tipo: 'stun', dur: 0.9 }] }),
       H('w', 'Casca Dura', 'buff', 'W', { alcance: 0, cd: 16, custo: 40, uso: 'defesa', buff: { armadura: 25, resist: 25, dur: 4 } }),
       H('e', 'Pisada', 'area', 'E', { alcance: 0, raio: 380, cd: 9, custo: 45, uso: 'sempre', atraso: 0.25, dano: { base: 45, rank: 30, ad: 0.4, fis: true }, efeitos: [{ tipo: 'lentidao', pct: 0.35, dur: 1.5 }] }),
       H('r', 'Muralha Viva', 'area', 'R', { alcance: 600, raio: 400, cd: 120, custo: 100, uso: 'iniciar', atraso: 0.5, dano: { base: 120, rank: 80, ad: 0.5, fis: true }, efeitos: [{ tipo: 'stun', dur: 1.2 }] })],
    ],
  },
  lutador: {
    nome: 'Lutador', funcao: 'combater',
    base: { hp: 600, hpNv: 100, ad: 63, adNv: 3.5, armadura: 33, armNv: 4.2, resist: 32, resNv: 1.5, vel: 345, alcance: 175, as: 0.66, asNv: 0.022, mana: 280, manaNv: 35 },
    variantes: [
      [H('q', 'Corte Giratório', 'area', 'Q', { alcance: 0, raio: 300, cd: 6, custo: 30, uso: 'sempre', atraso: 0.2, dano: { base: 45, rank: 30, ad: 0.9, fis: true } }),
       H('w', 'Fúria', 'buff', 'W', { alcance: 0, cd: 14, custo: 35, uso: 'iniciar', buff: { as: 0.35, dur: 4 } }),
       H('e', 'Salto Cortante', 'dash', 'E', { alcance: 550, cd: 11, custo: 40, uso: 'iniciar', dist: 450, dano: { base: 50, rank: 30, ad: 0.6, fis: true } }),
       H('r', 'Execução', 'alvo', 'R', { alcance: 400, cd: 100, custo: 100, uso: 'finalizar', dano: { base: 120, rank: 100, ad: 1.0, fis: true, execucao: 0.5 } })],
      [H('q', 'Lança Longa', 'projetil', 'Q', { alcance: 700, largura: 80, vel: 1800, cd: 8, custo: 45, uso: 'iniciar', dano: { base: 55, rank: 40, ad: 1.0, fis: true }, efeitos: [{ tipo: 'lentidao', pct: 0.25, dur: 1.5 }] }),
       H('w', 'Defesa Sombria', 'escudo', 'W', { alcance: 0, cd: 15, custo: 50, uso: 'defesa', escudo: { base: 70, rank: 40, ad: 0.4, dur: 3 } }),
       H('e', 'Giro Letal', 'area', 'E', { alcance: 0, raio: 350, cd: 9, custo: 40, uso: 'sempre', atraso: 0.2, dano: { base: 40, rank: 30, ad: 0.8, fis: true } }),
       H('r', 'Fúria da Lâmina', 'alvo', 'R', { alcance: 450, cd: 110, custo: 100, uso: 'iniciar', dano: { base: 150, rank: 90, ad: 0.9, fis: true }, efeitos: [{ tipo: 'stun', dur: 1.0 }] })],
    ],
  },
  assassino: {
    nome: 'Assassino', funcao: 'eliminar',
    base: { hp: 570, hpNv: 90, ad: 64, adNv: 3.3, armadura: 29, armNv: 3.8, resist: 32, resNv: 1.25, vel: 350, alcance: 175, as: 0.67, asNv: 0.02, mana: 300, manaNv: 40 },
    variantes: [
      [H('q', 'Lâmina Sombria', 'projetil', 'Q', { alcance: 700, largura: 70, vel: 2000, cd: 6, custo: 35, uso: 'poke', dano: { base: 60, rank: 40, ad: 0.8, fis: true } }),
       H('w', 'Passo de Sombra', 'dash', 'W', { alcance: 600, cd: 12, custo: 40, uso: 'iniciar', dist: 500, dano: { base: 40, rank: 30, ad: 0.4, fis: true } }),
       H('e', 'Véu', 'escudo', 'E', { alcance: 0, cd: 14, custo: 30, uso: 'defesa', escudo: { base: 50, rank: 30, ad: 0.3, dur: 2.5 } }),
       H('r', 'Execução Sombria', 'alvo', 'R', { alcance: 600, cd: 90, custo: 100, uso: 'finalizar', dano: { base: 150, rank: 120, ad: 1.2, fis: true, execucao: 0.6 } })],
      [H('q', 'Rajada de Adagas', 'area', 'Q', { alcance: 550, raio: 260, cd: 6, custo: 30, uso: 'iniciar', atraso: 0.25, dano: { base: 55, rank: 35, ad: 0.9, fis: true }, efeitos: [{ tipo: 'lentidao', pct: 0.25, dur: 1.2 }] }),
       H('w', 'Salto Mortal', 'dash', 'W', { alcance: 650, cd: 14, custo: 40, uso: 'iniciar', dist: 550, dano: { base: 50, rank: 30, ad: 0.5, fis: true } }),
       H('e', 'Escape', 'dash', 'E', { alcance: 0, cd: 15, custo: 40, uso: 'fuga', dist: 450 }),
       H('r', 'Dança Letal', 'alvo', 'R', { alcance: 550, cd: 100, custo: 100, uso: 'finalizar', dano: { base: 140, rank: 110, ad: 1.1, fis: true, execucao: 0.5 } })],
    ],
  },
  mago: {
    nome: 'Mago', funcao: 'dano',
    base: { hp: 540, hpNv: 88, ad: 53, adNv: 3.0, armadura: 21, armNv: 3.9, resist: 30, resNv: 1.3, vel: 335, alcance: 550, as: 0.65, asNv: 0.018, mana: 420, manaNv: 55 },
    variantes: [
      [H('q', 'Orbe Arcano', 'projetil', 'Q', { alcance: 950, largura: 80, vel: 1500, cd: 6, custo: 50, uso: 'poke', dano: { base: 70, rank: 45, ap: 0.65 } }),
       H('w', 'Zona Gélida', 'area', 'W', { alcance: 700, raio: 280, cd: 11, custo: 60, uso: 'iniciar', atraso: 0.6, dano: { base: 60, rank: 40, ap: 0.5 }, efeitos: [{ tipo: 'lentidao', pct: 0.4, dur: 2 }] }),
       H('e', 'Barreira', 'escudo', 'E', { alcance: 0, cd: 14, custo: 60, uso: 'defesa', escudo: { base: 70, rank: 45, ap: 0.4, dur: 3 } }),
       H('r', 'Cataclismo', 'area', 'R', { alcance: 900, raio: 420, cd: 100, custo: 100, uso: 'iniciar', atraso: 0.8, dano: { base: 180, rank: 110, ap: 0.8 }, efeitos: [{ tipo: 'stun', dur: 1.0 }] })],
      [H('q', 'Bola de Fogo', 'projetil', 'Q', { alcance: 850, largura: 90, vel: 1400, cd: 7, custo: 55, uso: 'poke', dano: { base: 65, rank: 45, ap: 0.7 }, efeitos: [{ tipo: 'lentidao', pct: 0.2, dur: 1 }] }),
       H('w', 'Prisão de Raízes', 'projetil', 'W', { alcance: 800, largura: 70, vel: 1600, cd: 12, custo: 60, uso: 'iniciar', dano: { base: 50, rank: 35, ap: 0.5 }, efeitos: [{ tipo: 'stun', dur: 1.2 }] }),
       H('e', 'Salto Arcano', 'dash', 'E', { alcance: 0, cd: 14, custo: 50, uso: 'fuga', dist: 400 }),
       H('r', 'Tempestade', 'area', 'R', { alcance: 800, raio: 450, cd: 90, custo: 100, uso: 'iniciar', atraso: 0.7, dano: { base: 160, rank: 100, ap: 0.8 } })],
    ],
  },
  atirador: {
    nome: 'Atirador', funcao: 'dano',
    base: { hp: 560, hpNv: 92, ad: 60, adNv: 3.0, armadura: 26, armNv: 3.6, resist: 30, resNv: 1.3, vel: 325, alcance: 575, as: 0.68, asNv: 0.028, mana: 300, manaNv: 40 },
    variantes: [
      [H('q', 'Tiro Certeiro', 'projetil', 'Q', { alcance: 1000, largura: 60, vel: 2200, cd: 7, custo: 40, uso: 'poke', dano: { base: 50, rank: 35, ad: 1.1, fis: true } }),
       H('w', 'Frenesi', 'buff', 'W', { alcance: 0, cd: 14, custo: 40, uso: 'iniciar', buff: { as: 0.4, dur: 4 } }),
       H('e', 'Recuo Ágil', 'dash', 'E', { alcance: 0, cd: 14, custo: 40, uso: 'fuga', dist: 400, efeitos: [] }),
       H('r', 'Disparo Final', 'projetil', 'R', { alcance: 2200, largura: 120, vel: 2000, cd: 100, custo: 100, uso: 'finalizar', dano: { base: 200, rank: 120, ad: 1.0, fis: true } })],
      [H('q', 'Rajada Dupla', 'projetil', 'Q', { alcance: 900, largura: 70, vel: 1900, cd: 6, custo: 35, uso: 'poke', dano: { base: 45, rank: 35, ad: 1.0, fis: true } }),
       H('w', 'Armadilha', 'area', 'W', { alcance: 800, raio: 250, cd: 13, custo: 45, uso: 'iniciar', atraso: 0.3, dano: { base: 40, rank: 25, ad: 0.5, fis: true }, efeitos: [{ tipo: 'stun', dur: 1.0 }] }),
       H('e', 'Rolamento', 'dash', 'E', { alcance: 0, cd: 13, custo: 40, uso: 'fuga', dist: 400 }),
       H('r', 'Chuva de Balas', 'area', 'R', { alcance: 900, raio: 480, cd: 100, custo: 100, uso: 'iniciar', atraso: 0.5, dano: { base: 170, rank: 110, ad: 0.9, fis: true } })],
    ],
  },
  suporte: {
    nome: 'Suporte', funcao: 'proteger',
    base: { hp: 560, hpNv: 86, ad: 52, adNv: 2.8, armadura: 28, armNv: 4.0, resist: 30, resNv: 1.3, vel: 335, alcance: 550, as: 0.64, asNv: 0.016, mana: 450, manaNv: 60 },
    variantes: [
      [H('q', 'Onda Curativa', 'cura', 'Q', { alcance: 700, cd: 9, custo: 60, uso: 'suporte', cura: { base: 70, rank: 45, ap: 0.5 } }),
       H('w', 'Escudo Protetor', 'escudo', 'W', { alcance: 650, cd: 11, custo: 60, uso: 'suporte', escudo: { base: 70, rank: 45, ap: 0.5, dur: 3 }, alvo: 'aliado' }),
       H('e', 'Prisão de Luz', 'projetil', 'E', { alcance: 850, largura: 80, vel: 1700, cd: 13, custo: 70, uso: 'iniciar', dano: { base: 50, rank: 30, ap: 0.4 }, efeitos: [{ tipo: 'stun', dur: 1.1 }] }),
       H('r', 'Renascer', 'cura', 'R', { alcance: 0, raio: 800, cd: 110, custo: 100, uso: 'suporte', cura: { base: 150, rank: 100, ap: 0.7 }, area: true })],
      [H('q', 'Gancho', 'projetil', 'Q', { alcance: 1000, largura: 70, vel: 1800, cd: 12, custo: 60, uso: 'iniciar', dano: { base: 60, rank: 40, ap: 0.5 }, efeitos: [{ tipo: 'stun', dur: 1.0 }], puxa: true }),
       H('w', 'Aura de Vigor', 'buff', 'W', { alcance: 0, raio: 650, cd: 16, custo: 60, uso: 'suporte', buff: { vel: 40, armadura: 15, dur: 4 }, area: true }),
       H('e', 'Muro de Energia', 'area', 'E', { alcance: 600, raio: 300, cd: 12, custo: 60, uso: 'iniciar', atraso: 0.4, dano: { base: 45, rank: 30, ap: 0.4 }, efeitos: [{ tipo: 'lentidao', pct: 0.4, dur: 2 }] }),
       H('r', 'Sentença', 'area', 'R', { alcance: 0, raio: 500, cd: 110, custo: 100, uso: 'iniciar', atraso: 0.5, dano: { base: 130, rank: 90, ap: 0.6 }, efeitos: [{ tipo: 'stun', dur: 1.2 }] })],
    ],
  },
};
export const CLASSE_PARA_ARQUETIPO = { Tanque: 'tanque', Lutador: 'lutador', Assassino: 'assassino', Mago: 'mago', Atirador: 'atirador', Suporte: 'suporte' };
