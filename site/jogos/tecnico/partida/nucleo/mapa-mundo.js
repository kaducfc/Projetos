// Configuração do mapa em unidades do mundo (convertida das coordenadas normalizadas de config/mapa.js).
import { MAPA } from '../config/mapa.js';
import { normParaMundo, comprimento } from './coord.js';

const P = (n) => normParaMundo(n[0], n[1]);
const U = MAPA.mundo.largura;
export const MUNDO_MAPA = {
  rotas: Object.fromEntries(Object.entries(MAPA.rotas).map(([k, r]) => {
    const pts = r.pts.map(P);
    return [k, { id: k, nome: r.nome, largura: r.largura * U, pts, comprimento: comprimento(pts) }];
  })),
  bases: Object.fromEntries(Object.entries(MAPA.bases).map(([k, b]) => [k, { lado: k, nexus: P(b.nexus), fonte: P(b.fonte), poligono: b.poligono.map(P) }])),
  estruturas: MAPA.estruturas.map((e) => ({ ...e, ...P(e.pos) })),
  acampamentos: MAPA.acampamentos.map((a) => ({ ...a, ...P(a.pos), raio: a.raio * U })),
  covis: MAPA.covis.map((c) => ({ ...c, ...P(c.pos), raio: c.raio * U })),
};
export const ROTAS = ['topo', 'meio', 'baixo'];
export const outro = (equipe) => (equipe === 'azul' ? 'vermelho' : 'azul');
