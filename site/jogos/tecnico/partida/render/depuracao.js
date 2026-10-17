// Camadas de depuração do mapa e da simulação. Só desenham por cima do canvas: a imagem original nunca é alterada.
import { T, NOME_TIPO } from '../nucleo/terreno.js';
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { MUNDO, mundoParaTela } from '../nucleo/coord.js';

const COR_TIPO = ['rgba(220,30,30,0.55)', 'rgba(255,200,0,0.22)', 'rgba(0,200,0,0.2)', 'rgba(0,140,255,0.28)', 'rgba(220,220,220,0.18)', 'rgba(255,0,255,0.3)', 'rgba(0,255,255,0.3)'];
export const CAMADAS = [
  ['grade', 'Grade navegável (tipos)'], ['paredes', 'Só paredes'], ['rotas', 'Linhas das rotas e pontos de passagem'], ['estruturas', 'Estruturas'],
  ['selva', 'Acampamentos e covis'], ['bases', 'Bases'], ['caminhos', 'Caminhos calculados'], ['destinos', 'Destinos dos agentes'],
  ['alcances', 'Alcances de ataque'], ['aquisicao', 'Áreas de aquisição de alvos'], ['combate', 'Regiões de combate'],
];

export function desenharDepuracao(ctx, vista, camadas, terreno, partida = null, extra = {}) {
  const px = (x, y) => mundoParaTela(x, y, vista);
  const esc = vista.largura / MUNDO.largura; // pixels de tela por unidade de mundo
  if (camadas.grade || camadas.paredes) {
    const c = terreno.cel;
    for (let cy = 0; cy < terreno.rows; cy++) for (let cx = 0; cx < terreno.cols; cx++) {
      const t = terreno.grade[cy * terreno.cols + cx];
      if (!camadas.grade && t !== 0) continue;
      ctx.fillStyle = COR_TIPO[t];
      const a = px(cx * c, cy * c);
      ctx.fillRect(a.px, a.py, c * esc + 0.5, c * esc + 0.5);
    }
  }
  if (camadas.bases) {
    ctx.lineWidth = 2;
    for (const b of Object.values(MUNDO_MAPA.bases)) {
      ctx.strokeStyle = b.lado === 'azul' ? '#4aa3ff' : '#ff5a5a'; ctx.beginPath();
      b.poligono.forEach((p, i) => { const q = px(p.x, p.y); i ? ctx.lineTo(q.px, q.py) : ctx.moveTo(q.px, q.py); }); ctx.closePath(); ctx.stroke();
    }
  }
  if (camadas.rotas) {
    const cor = { topo: '#ffd54a', meio: '#7dffb0', baixo: '#ff9ad0' };
    for (const r of Object.values(MUNDO_MAPA.rotas)) {
      ctx.strokeStyle = cor[r.id]; ctx.fillStyle = cor[r.id]; ctx.lineWidth = 2; ctx.beginPath();
      r.pts.forEach((p, i) => { const q = px(p.x, p.y); i ? ctx.lineTo(q.px, q.py) : ctx.moveTo(q.px, q.py); }); ctx.stroke();
      r.pts.forEach((p, i) => { const q = px(p.x, p.y); ctx.beginPath(); ctx.arc(q.px, q.py, 3, 0, 7); ctx.fill(); ctx.font = '10px sans-serif'; ctx.fillText(`${r.id[0]}${i}`, q.px + 4, q.py - 4); });
    }
  }
  if (camadas.estruturas) {
    for (const e of MUNDO_MAPA.estruturas) {
      const q = px(e.x, e.y); ctx.strokeStyle = e.equipe === 'azul' ? '#4aa3ff' : '#ff5a5a'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
      const r = e.tipo === 'nexus' ? 9 : e.tipo === 'inibidor' ? 7 : 5;
      ctx.beginPath(); if (e.tipo === 'torre') ctx.rect(q.px - r, q.py - r, r * 2, r * 2); else ctx.arc(q.px, q.py, r, 0, 7); ctx.stroke();
      ctx.font = '10px sans-serif'; ctx.fillText(e.tipo === 'torre' ? `T${e.nivel}` : e.tipo === 'inibidor' ? 'I' : 'N', q.px + r + 2, q.py + 3);
    }
  }
  if (camadas.selva) {
    for (const a of [...MUNDO_MAPA.acampamentos, ...MUNDO_MAPA.covis]) {
      const q = px(a.x, a.y); ctx.strokeStyle = a.lado === 'azul' ? '#9ad0ff' : a.lado === 'vermelho' ? '#ff9a9a' : '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.px, q.py, a.raio * esc, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText(a.id + (a.ajustar ? ' ⚠' : ''), q.px + 6, q.py - 6);
    }
  }
  if (extra.caminho) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
    extra.caminho.forEach((p, i) => { const q = px(p.x, p.y); i ? ctx.lineTo(q.px, q.py) : ctx.moveTo(q.px, q.py); }); ctx.stroke();
    ctx.fillStyle = '#fff'; extra.caminho.forEach((p) => { const q = px(p.x, p.y); ctx.beginPath(); ctx.arc(q.px, q.py, 4, 0, 7); ctx.fill(); });
  }
  if (partida) desenharDepuracaoPartida(ctx, vista, camadas, partida, px, esc);
}

// Camadas que dependem do estado da partida (caminhos, destinos, alcances, aquisição, combate).
function desenharDepuracaoPartida(ctx, vista, camadas, partida, px, esc) {
  for (const u of partida.todasUnidades()) {
    if (u.morto) continue;
    const q = px(u.x, u.y);
    if (camadas.caminhos && u.caminho && u.caminho.length) {
      ctx.strokeStyle = u.equipe === 'azul' ? 'rgba(120,190,255,0.8)' : 'rgba(255,140,140,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(q.px, q.py);
      for (const p of u.caminho) { const r = px(p.x, p.y); ctx.lineTo(r.px, r.py); } ctx.stroke();
    }
    if (camadas.destinos && u.destino) { const r = px(u.destino.x, u.destino.y); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(r.px - 4, r.py); ctx.lineTo(r.px + 4, r.py); ctx.moveTo(r.px, r.py - 4); ctx.lineTo(r.px, r.py + 4); ctx.stroke(); }
    if (camadas.alcances && u.alcance) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(q.px, q.py, u.alcance * esc, 0, 7); ctx.stroke(); }
    if (camadas.aquisicao && u.aquisicao) { ctx.strokeStyle = 'rgba(255,220,80,0.35)'; ctx.beginPath(); ctx.arc(q.px, q.py, u.aquisicao * esc, 0, 7); ctx.stroke(); }
  }
  if (camadas.combate) for (const l of partida.lutas || []) { const q = px(l.x, l.y); ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.px, q.py, l.raio * esc, 0, 7); ctx.stroke(); }
}
