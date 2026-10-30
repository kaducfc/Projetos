// Do campeão do catálogo (dados do jogo Campeão) ao perfil de simulação: arquétipo pela classe, variante e pequenas variações determinísticas por nome.
import { ARQUETIPOS, CLASSE_PARA_ARQUETIPO } from './arquetipos.js';
import { BUILDS, ESTILO_DA_CLASSE } from './itens.js';
import { ESTILO_DO_CAMPEAO, CATEGORIA_DO_ESTILO } from '../config/papeis.js';
import { hashTexto } from '../nucleo/rng.js';
import { POSICOES } from '../config/posicoes.js';

const POS = { top: 'Top', selva: 'Jungle', meio: 'Mid', atirador: 'ADC', suporte: 'Suporte' };
export const posicoesDe = (c) => POSICOES[c.nome] || c.posicoes || [];
const var01 = (nome, chave) => (hashTexto(nome + ':' + chave) % 1000) / 1000; // 0..0.999 estável

export function perfilDoCampeao(c) {
  const classes = (c.classes && c.classes.length ? c.classes : ['Lutador']).map((x) => CLASSE_PARA_ARQUETIPO[x]).filter(Boolean);
  const principal = classes[0] || 'lutador';
  const arq = ARQUETIPOS[principal];
  const secundaria = classes[1] ? ARQUETIPOS[classes[1]] : null;
  const corpoACorpo = (c.alcance || ['Corpo a corpo'])[0] === 'Corpo a corpo';
  const base = { ...arq.base };
  if (secundaria) for (const k of Object.keys(base)) base[k] = base[k] * 0.78 + secundaria.base[k] * 0.22;
  // ranged/melee de acordo com o catálogo, mesmo que o arquétipo normalmente seja o contrário
  if (corpoACorpo && base.alcance > 300) { base.alcance = 175; base.hp *= 1.08; base.vel += 5; }
  if (!corpoACorpo && base.alcance < 300) { base.alcance = 500; base.hp *= 0.92; base.ad *= 0.95; }
  for (const k of ['hp', 'ad', 'armadura', 'resist', 'vel']) base[k] *= 0.94 + 0.12 * var01(c.nome, k);
  const variantes = arq.variantes; const hab = variantes[hashTexto(c.nome) % variantes.length];
  const estilo = ESTILO_DO_CAMPEAO[c.nome] || ESTILO_DA_CLASSE[principal] || 'lutador';
  const papel = CATEGORIA_DO_ESTILO[estilo] || 'ad';
  const ap = papel === 'ap' || estilo === 'hibrido_ap' || (!ESTILO_DO_CAMPEAO[c.nome] && (['mago', 'suporte'].includes(principal) || (secundaria && classes[1] === 'mago')));
  return {
    id: c.id || c.nome, nome: c.nome, classe: principal, classes, corpoACorpo,
    base, habilidades: hab.map((h) => ({ ...h })), funcao: arq.funcao, danoMagico: !!ap,
    build: BUILDS[estilo], estilo, papel,
    posicoes: posicoesDe(c),
  };
}

// Escolha automática enquanto não há fase de Pick and Ban: favorito do jogador na posição, senão um campeão compatível, sem repetir.
export function escolherCampeao(jogador, catalogo, usados, rng) {
  const pos = POS[jogador.pos];
  const porId = new Map(catalogo.map((c) => [c.id || c.nome, c]));
  for (const f of jogador.favoritos || []) { const c = porId.get(f.id) || porId.get(f.nome); if (c && !usados.has(c.nome)) return c; }
  const pool = catalogo.filter((c) => !usados.has(c.nome) && posicoesDe(c).includes(pos));
  const base = pool.length ? pool : catalogo.filter((c) => !usados.has(c.nome));
  return base[Math.floor(rng() * base.length)];
}
