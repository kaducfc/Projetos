// Rift Survivors: desenho no canvas (resolução lógica pequena, ampliada com pixels nítidos).
import { sprite, spriteBranco, icone, animacao } from './sprites.js';
import { CHEFES, ARMAS, TEMPO_BARAO } from './data.js';

const CH = 128; // tamanho do pedaço de chão
const hash = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const DIG = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
const FONTE = '8px "Press Start 2P", ui-monospace, monospace';

function pedaco(cx, cy) {
  const c = document.createElement('canvas'); c.width = CH; c.height = CH; const x = c.getContext('2d');
  for (let ty = 0; ty < CH / 8; ty++) for (let tx = 0; tx < CH / 8; tx++) {
    const r = hash(cx * 16 + tx, cy * 16 + ty);
    x.fillStyle = (tx + ty) % 2 ? '#2f6b2e' : '#34752f'; x.fillRect(tx * 8, ty * 8, 8, 8);
    if (r < 0.16) { x.fillStyle = '#285c28'; x.fillRect(tx * 8 + ((r * 97) % 6 | 0), ty * 8 + ((r * 53) % 6 | 0), 2, 1); x.fillRect(tx * 8 + 1 + ((r * 31) % 5 | 0), ty * 8 + 2 + ((r * 17) % 5 | 0), 1, 2); }
    else if (r > 0.94) { x.fillStyle = '#4a9a3a'; x.fillRect(tx * 8 + 2, ty * 8 + 3, 1, 2); x.fillRect(tx * 8 + 5, ty * 8 + 1, 1, 2); }
  }
  // trilha de terra (como as rotas do mapa) em alguns pedaços
  if (hash(cx, cy) < 0.18) { const y0 = 40 + ((hash(cx + 9, cy) * 40) | 0); x.fillStyle = '#8a7a52'; x.fillRect(0, y0, CH, 14); x.fillStyle = '#9c8c62'; x.fillRect(0, y0 + 2, CH, 3); x.fillStyle = '#76683f'; x.fillRect(0, y0 + 11, CH, 3); for (let i = 0; i < 10; i++) { x.fillStyle = '#6e613a'; x.fillRect(((hash(cx + i, cy + 7) * CH) | 0), y0 + 3 + ((hash(cx + 3, cy + i) * 8) | 0), 2, 1); } }
  else if (hash(cx + 5, cy + 3) < 0.07) { // poço de água
    const px = 20 + ((hash(cx, cy + 1) * 60) | 0); const py = 20 + ((hash(cx + 1, cy) * 60) | 0);
    x.fillStyle = '#7a6a45'; x.fillRect(px - 1, py - 1, 38, 24); x.fillStyle = '#2e7fc0'; x.fillRect(px + 2, py + 2, 32, 16); x.fillStyle = '#4aa3e0'; x.fillRect(px + 6, py + 5, 10, 1); x.fillRect(px + 18, py + 11, 12, 1);
  }
  // decoração
  const n = 3 + ((hash(cx, cy * 3) * 4) | 0);
  for (let i = 0; i < n; i++) {
    const dx = (hash(cx * 7 + i, cy) * (CH - 14)) | 0; const dy = (hash(cx, cy * 7 + i) * (CH - 14)) | 0; const k = hash(cx + i * 3, cy + i * 5);
    if (k < 0.34) { x.fillStyle = '#1f4f22'; x.fillRect(dx, dy + 6, 11, 6); x.fillStyle = '#2a6a2a'; x.fillRect(dx + 1, dy + 3, 9, 7); x.fillStyle = '#3a8a36'; x.fillRect(dx + 3, dy + 2, 5, 3); }
    else if (k < 0.55) { x.fillStyle = '#5d626f'; x.fillRect(dx, dy + 3, 9, 6); x.fillStyle = '#8a8f99'; x.fillRect(dx + 1, dy + 2, 7, 4); x.fillStyle = '#b0b5bf'; x.fillRect(dx + 2, dy + 2, 3, 1); }
    else if (k < 0.8) { const cor = ['#ff77b8', '#ffe36a', '#ffffff', '#58e8ff'][(k * 100 | 0) % 4]; x.fillStyle = '#2a6a2a'; x.fillRect(dx + 1, dy + 3, 1, 3); x.fillStyle = cor; x.fillRect(dx, dy + 1, 3, 3); x.fillStyle = '#ffe36a'; x.fillRect(dx + 1, dy + 2, 1, 1); }
    else { x.fillStyle = '#5a3a1e'; x.fillRect(dx + 4, dy + 9, 4, 6); x.fillStyle = '#1f4f22'; x.fillRect(dx, dy + 2, 12, 9); x.fillStyle = '#2a6a2a'; x.fillRect(dx + 1, dy, 10, 8); x.fillStyle = '#3a8a36'; x.fillRect(dx + 3, dy + 1, 4, 3); }
  }
  return c;
}

export function criarRender(canvas) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const chunks = new Map();
  const R = { w: canvas.width, h: canvas.height, t: 0, camX: 0, camY: 0 };
  const chunk = (cx, cy) => { const k = `${cx},${cy}`; let c = chunks.get(k); if (!c) { c = pedaco(cx, cy); chunks.set(k, c); if (chunks.size > 80) chunks.delete(chunks.keys().next().value); } return c; };
  const desenhar = (nome, x, y, ox = 0, oy = 0, branco = false, esc = 1) => {
    const s = branco ? spriteBranco(nome) : sprite(nome); if (!s) return;
    const w = s.width * esc; const h = s.height * esc;
    ctx.drawImage(s, Math.round(x - w / 2 + ox), Math.round(y - h + oy), w, h);
  };
  const num = (n, x, y, cor, esc = 1) => {
    const t = String(n); ctx.fillStyle = cor;
    for (let i = 0; i < t.length; i++) { const g = DIG[t[i]]; for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(Math.round(x + i * 4 * esc + (k % 3) * esc), Math.round(y + ((k / 3) | 0) * esc), esc, esc); }
  };
  const texto = (t, x, y, cor = '#fff', alinhar = 'left') => { ctx.font = FONTE; ctx.textAlign = alinhar; ctx.textBaseline = 'top'; ctx.fillStyle = '#14101e'; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = cor; ctx.fillText(t, x, y); };
  const barra = (x, y, w, h, f, cor, fundo = '#14101e') => { ctx.fillStyle = fundo; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#3b3550'; ctx.fillRect(x, y, w, h); ctx.fillStyle = cor; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, f))), h); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, f))), 1); };

  function tempoTxt(t) { const s = Math.floor(t); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

  function quadro(S, opc = {}) {
    const { w, h } = R; const P = S.p;
    R.t += 1 / 60;
    let sx = 0; let sy = 0; if (S.shake > 0) { sx = Math.round((Math.random() - 0.5) * 4 * Math.min(1, S.shake * 3)); sy = Math.round((Math.random() - 0.5) * 4 * Math.min(1, S.shake * 3)); }
    const camX = Math.round(P.x - w / 2) + sx; const camY = Math.round(P.y - h / 2) + sy;
    R.camX = camX; R.camY = camY;
    // chão
    const c0x = Math.floor(camX / CH); const c0y = Math.floor(camY / CH);
    for (let cy = c0y; cy <= Math.floor((camY + h) / CH); cy++) for (let cx = c0x; cx <= Math.floor((camX + w) / CH); cx++) ctx.drawImage(chunk(cx, cy), cx * CH - camX, cy * CH - camY);
    ctx.save(); ctx.translate(-camX, -camY);
    // zonas de luz
    for (const z of S.zonas) {
      const a = 0.22 + 0.1 * Math.sin(R.t * 8); ctx.fillStyle = `rgba(255,230,120,${a})`; ctx.beginPath(); ctx.arc(Math.round(z.x), Math.round(z.y), z.r, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(z.x), Math.round(z.y), z.r * (0.4 + 0.6 * (z.t / z.d)), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    }
    // aura de gelo
    for (const a of S.armas) if (a.id === 'aura') { const r = ARMAS.aura.stats(a.nivel).raio * S.a.area; ctx.fillStyle = 'rgba(160,230,255,.14)'; ctx.beginPath(); ctx.arc(Math.round(P.x), Math.round(P.y), r, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(210,245,255,.55)'; ctx.setLineDash([2, 4]); ctx.lineDashOffset = -R.t * 20; ctx.beginPath(); ctx.arc(Math.round(P.x), Math.round(P.y), r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    // raios (aviso e coluna)
    for (const r of S.raios) {
      if (r.t > r.d * 0.5) { ctx.strokeStyle = 'rgba(255,240,120,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r * (1 - (r.t - r.d * 0.5) / (r.d * 0.5)), 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r, 0, 6.2832); ctx.stroke(); }
      else { ctx.fillStyle = '#fff6b0'; ctx.fillRect(Math.round(r.x) - 2, Math.round(r.y) - 120, 5, 120); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) - 120, 3, 120); ctx.fillStyle = 'rgba(255,240,120,.45)'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r, 0, 6.2832); ctx.fill(); }
    }
    // gemas e coletáveis
    for (const g of S.gemas) { if (g.x < camX - 10 || g.x > camX + w + 10 || g.y < camY - 10 || g.y > camY + h + 10) continue; desenhar(g.v >= 10 ? 'gema3' : g.v >= 3 ? 'gema2' : 'gema1', g.x, g.y + 3, 0, Math.round(Math.sin(R.t * 5 + g.x) * 1)); }
    for (const it of S.itens) desenhar(it.tipo, it.x, it.y + 4, 0, Math.round(Math.sin(R.t * 4 + it.x) * 1.5));
    // entidades por profundidade
    const ents = [];
    for (const e of S.inim) if (e.x > camX - 40 && e.x < camX + w + 40 && e.y > camY - 40 && e.y < camY + h + 60) ents.push(e);
    ents.push({ jogador: true, y: P.y, x: P.x });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.jogador) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(P.x) - 6, Math.round(P.y) - 1, 12, 3);
        const bob = P.andando ? Math.round(Math.abs(Math.sin(R.t * 12)) * 2) : 0;
        if (P.inv > 0 && Math.floor(R.t * 20) % 2 === 0 && S.estado === 'jogando') continue;
        const an = animacao(S.campeao, P.andando ? 'andando' : 'parada', R.t, P.flash > 0);
        if (an) { ctx.drawImage(an, Math.round(P.x - an.width / 2), Math.round(P.y + 8 - an.height)); continue; }
        desenhar(S.campeao, P.x, P.y + 7, 0, -bob, P.flash > 0);
        continue;
      }
      const nome = e.tipo; const sombraW = Math.round(e.raio * 2.2);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(e.x - sombraW / 2), Math.round(e.y + e.raio * 0.5), sombraW, 3);
      const bob = Math.round(Math.abs(Math.sin(R.t * 9 + e.id)) * (e.chefe ? 1 : 2));
      if (e.estado === 1) { ctx.strokeStyle = 'rgba(255,60,60,.6)'; ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x + e.dx * 70), Math.round(e.y + e.dy * 70)); ctx.stroke(); }
      const esc = e.tipo === 'golem' ? 1.25 : 1;
      desenhar(nome, e.x, e.y + e.raio + 2, 0, -bob, e.flash > 0, esc);
      if (e.encantado > 0) { ctx.fillStyle = '#ff77b8'; ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - e.raio - 12 - Math.round(Math.sin(R.t * 8))), 2, 2); ctx.fillRect(Math.round(e.x + 1), Math.round(e.y - e.raio - 12 - Math.round(Math.sin(R.t * 8))), 2, 2); ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - e.raio - 10), 6, 2); ctx.fillRect(Math.round(e.x - 2), Math.round(e.y - e.raio - 8), 4, 1); }
      if (e.lento > 0) { ctx.fillStyle = 'rgba(160,230,255,.35)'; ctx.fillRect(Math.round(e.x - e.raio), Math.round(e.y + e.raio - 2), e.raio * 2, 3); }
      if (e.hp < e.hpMax && !e.chefe) { const bw = Math.max(10, e.raio * 2); barra(Math.round(e.x - bw / 2), Math.round(e.y - e.raio - 6), bw, 2, e.hp / e.hpMax, '#e04545'); }
    }
    // armas visíveis: lâminas giratórias
    for (const a of S.armas) if (a.id === 'lamina') { const st = ARMAS.lamina.stats(a.nivel); const Rr = st.raio * S.a.area; for (let i = 0; i < st.qtd; i++) { const an = a.ang + (i * 6.2832) / st.qtd; const bx = P.x + Math.cos(an) * Rr; const by = P.y + Math.sin(an) * Rr; ctx.save(); ctx.translate(Math.round(bx), Math.round(by)); ctx.rotate(an + 1.5708); ctx.drawImage(sprite('lamina'), -3, -8); ctx.restore(); } }
    // projéteis
    for (const q of S.proj) {
      if (q.tipo === 'orbe') { const s = sprite('orbe'); ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2)); ctx.restore(); }
      else if (q.tipo === 'coracao') { const s = sprite('coracao'); ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); ctx.drawImage(s, -Math.round(s.width * 0.7), -Math.round(s.height / 2)); ctx.restore(); }
      else if (q.tipo === 'shuriken') { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); ctx.drawImage(sprite('shuriken'), -5, -5); ctx.restore(); }
      else if (q.tipo === 'flecha') { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); ctx.drawImage(sprite('flecha'), -4, -2); ctx.restore(); }
      else { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.drawImage(sprite('bala'), -2, -1); ctx.restore(); }
    }
    for (const q of S.eproj) ctx.drawImage(sprite('eorbe'), Math.round(q.x - 3), Math.round(q.y - 3));
    // efeitos de morte e explosão
    for (const f of S.efeitos) {
      const k = 1 - f.t / f.d;
      if (f.tipo === 'morte') { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; const r = f.r * (0.6 + k); ctx.fillRect(Math.round(f.x - r), Math.round(f.y - 1), Math.round(r * 2), 2); ctx.fillRect(Math.round(f.x - 1), Math.round(f.y - r), 2, Math.round(r * 2)); }
      else { ctx.strokeStyle = `rgba(255,240,150,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(f.x), Math.round(f.y), f.r * (0.4 + 0.7 * k), 0, 6.2832); ctx.stroke(); ctx.fillStyle = `rgba(255,240,150,${0.25 * (1 - k)})`; ctx.fill(); }
    }
    // números de dano
    for (const t of S.textos) num(t.v, t.x - String(t.v).length * 2, t.y, t.jogador ? '#ff5a5a' : t.crit ? '#ffd24a' : '#ffffff', t.crit ? 2 : 1);
    ctx.restore();
    // vinheta de dano
    if (P.flash > 0) { ctx.fillStyle = `rgba(255,40,40,${Math.min(0.35, P.flash * 2)})`; ctx.fillRect(0, 0, w, h); }
    hud(S);
  }

  function hud(S) {
    const { w, h } = R; const P = S.p;
    barra(0, 0, w, 5, S.xp / S.xpProx, '#58a8ff'); // experiência
    texto(`NV ${S.nivel}`, 4, 8, '#ffe36a');
    barra(4, 20, 52, 5, P.hp / P.hpMax, P.hp / P.hpMax < 0.3 ? '#ff5a5a' : '#e04545');
    texto(`${Math.ceil(P.hp)}/${P.hpMax}`, 60, 19, '#fff');
    texto(tempoTxt(S.t), w / 2, 8, S.t >= TEMPO_BARAO - 30 && !S.chefes.barao ? '#ff6a6a' : '#fff', 'center');
    texto(`${S.abates}`, w - 4, 8, '#ffffff', 'right'); texto(`${S.ouro}`, w - 4, 19, '#f5c82e', 'right');
    // armas e itens
    let x = 4; const y = h - 17;
    for (const a of S.armas) { const ic = icone(a.id); ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 1, y - 1, 16, 16); ctx.drawImage(ic, x, y); texto(String(a.nivel), x + 13, y + 7, a.nivel >= 5 ? '#ffe36a' : '#fff', 'right'); x += 17; }
    x += 4;
    for (const [id, nv] of Object.entries(S.passivas)) { const ic = icone(id); ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 1, y - 1, 16, 16); ctx.drawImage(ic, x, y); texto(String(nv), x + 13, y + 7, nv >= 5 ? '#ffe36a' : '#fff', 'right'); x += 17; }
    // chefe
    const b = S.chefeVivo;
    if (b && b.hp > 0) { const bw = Math.min(160, w - 40); barra(Math.round(w / 2 - bw / 2), 34, bw, 6, b.hp / b.hpMax, '#b45cff'); texto(CHEFES[b.tipo].nome.toUpperCase(), w / 2, 42, '#e9d5ff', 'center'); }
    if (!S.chefes.barao) { const falta = TEMPO_BARAO - S.t; if (falta > 0 && falta < 60) texto(`BARÃO EM ${Math.ceil(falta)}s`, w / 2, 20, '#ff9a9a', 'center'); }
  }

  return { quadro, resize(lw, lh) { canvas.width = lw; canvas.height = lh; R.w = lw; R.h = lh; ctx.imageSmoothingEnabled = false; }, get w() { return R.w; }, get h() { return R.h; }, ctx };
}
