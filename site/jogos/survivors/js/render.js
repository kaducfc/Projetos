// Rift Survivors: desenho no canvas (resolução lógica pequena, ampliada com pixels nítidos).
import { sprite, spriteBranco, icone, animacao, quadroAnim, nQuadros, atlasDeProps } from './sprites.js';
import { CHEFES } from './data.js';
import { statsDe } from './game.js';
import { CH, hash, pedaco, propsDoPedaco, grandesDoPedaco } from './temas.js';

const DIG = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
const FONTE = '8px "Press Start 2P", ui-monospace, monospace';

const AMBIENTE = { ixtal: null, ionia: ['#ffd9ec', 0.1], demacia: ['#fff2cc', 0.07], noxus: ['#ff8a70', 0.16], shurima: ['#ffe2a0', 0.1], freljord: ['#b8d4ff', 0.12] };
const glows = new Map();
function glow(cor, r) { // bolha de luz (gradiente radial) para brilho aditivo
  const k = `${cor}|${r}`; let c = glows.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d'); const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, cor); g.addColorStop(0.35, cor + '66'); g.addColorStop(1, cor + '00'); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); glows.set(k, c); return c;
}

// Luzes dos objetos pequenos por reino: índice no atlas -> [cor, raio, força, altura relativa]. Reinos sem entrada usam as luzes antigas.
// Luzes dos objetos grandes por reino (mesmo formato).
const LUZ_GRANDES = { freljord: { 2: ['#ff9a3a', 12, 0.5, 0.9], 3: ['#58c8ff', 22, 0.4, 0.5], 4: ['#58c8ff', 12, 0.4, 0.45] }, noxus: { 2: ['#ff8a3a', 20, 0.6, 0.93], 4: ['#ff6a2a', 10, 0.3, 0.3], 5: ['#ff6a2a', 24, 0.45, 0.45] } };
const LUZ_PEQ = { noxus: { 7: ['#ff6a2a', 9, 0.35, 0.5], 9: ['#ff6a2a', 8, 0.3, 0.4], 12: ['#ff6a2a', 9, 0.35, 0.4], 14: ['#ff8a3a', 17, 0.6, 0.65], 11: ['#ff6a2a', 8, 0.3, 0.4] } };
export function criarRender(canvas) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const chunks = new Map();
  const R = { w: canvas.width, h: canvas.height, t: 0, camX: 0, camY: 0 };
  let temaAtual = 'ixtal';
  const chunk = (cx, cy) => { const k = `${cx},${cy}`; let c = chunks.get(k); if (!c) { c = pedaco(temaAtual, cx, cy); chunks.set(k, c); if (chunks.size > 80) chunks.delete(chunks.keys().next().value); } return c; };
  const desenhar = (nome, x, y, ox = 0, oy = 0, branco = false, esc = 1, ey = esc) => {
    const s = typeof nome !== 'string' ? nome : branco ? spriteBranco(nome) : sprite(nome); if (!s) return;
    const w = s.width * esc; const h = s.height * ey;
    ctx.drawImage(s, Math.round(x - w / 2 + ox), Math.round(y - h + oy), w, h);
  };
  const luz = (cor, x, y, r, a = 1) => { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(glow(cor, r), Math.round(x - r), Math.round(y - r)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; };
  const num = (n, x, y, cor, esc = 1) => {
    const t = String(n); ctx.fillStyle = cor;
    for (let i = 0; i < t.length; i++) { const g = DIG[t[i]]; for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(Math.round(x + i * 4 * esc + (k % 3) * esc), Math.round(y + ((k / 3) | 0) * esc), esc, esc); }
  };
  const texto = (t, x, y, cor = '#fff', alinhar = 'left') => { ctx.font = FONTE; ctx.textAlign = alinhar; ctx.textBaseline = 'top'; ctx.fillStyle = '#14101e'; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = cor; ctx.fillText(t, x, y); };
  const barra = (x, y, w, h, f, cor, fundo = '#14101e') => { ctx.fillStyle = fundo; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#3b3550'; ctx.fillRect(x, y, w, h); ctx.fillStyle = cor; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, f))), h); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, f))), 1); };

  function tempoTxt(t) { const s = Math.floor(t); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

  // Escolhe a animação do campeão: morte > dano > ataque > andando > parada (cai para as que existirem).
  function quadroDoJogador(S) {
    const P = S.p; const n = S.campeao;
    if (S.estado === 'derrota') { if (R.morte == null) R.morte = R.t; const q = nQuadros(n, 'morte'); if (q) return quadroAnim(n, 'morte', (R.t - R.morte) * 5); } else R.morte = null;
    if (S.estado === 'vitoria' && nQuadros(n, 'vitoria')) return quadroAnim(n, 'vitoria', R.t * 5);
    if (P.flash > 0 && nQuadros(n, 'dano')) return quadroAnim(n, 'dano', (1 - P.flash / 0.15) * nQuadros(n, 'dano'));
    if (P.especial > 0 && nQuadros(n, 'especial')) return quadroAnim(n, 'especial', (1 - P.especial / 0.5) * nQuadros(n, 'especial'));
    if (P.nivelAnim > 0 && nQuadros(n, 'nivel')) return quadroAnim(n, 'nivel', P.nivelAnim > 0.25 ? 0 : 1);
    if (P.ataque > 0 && nQuadros(n, 'ataque')) return quadroAnim(n, 'ataque', (1 - P.ataque / 0.42) * nQuadros(n, 'ataque'));
    if (P.andando && nQuadros(n, 'andando')) {
      const aba = P.corre && nQuadros(n, 'correr') ? 'correr' : 'andando'; const ciclo = aba === 'correr' ? 34 : 22; const q = nQuadros(n, aba);
      return quadroAnim(n, aba, Math.floor(P.dist / (ciclo / q)) % q, P.flash > 0 && !nQuadros(n, 'dano'));
    }
    return animacao(n, 'parada', R.t, P.flash > 0 && !nQuadros(n, 'dano'));
  }
  function quadro(S, opc = {}) {
    const { w, h } = R; const P = S.p;
    R.t += 1 / 60;
    if (S.R.tema !== temaAtual) { temaAtual = S.R.tema; chunks.clear(); }
    let sx = 0; let sy = 0; if (S.shake > 0) { sx = Math.round((Math.random() - 0.5) * 4 * Math.min(1, S.shake * 3)); sy = Math.round((Math.random() - 0.5) * 4 * Math.min(1, S.shake * 3)); }
    const camX = Math.round(P.x - w / 2) + sx; const camY = Math.round(P.y - h / 2) + sy;
    R.camX = camX; R.camY = camY;
    // chão
    const c0x = Math.floor(camX / CH); const c0y = Math.floor(camY / CH);
    for (let cy = c0y; cy <= Math.floor((camY + h) / CH); cy++) for (let cx = c0x; cx <= Math.floor((camX + w) / CH); cx++) ctx.drawImage(chunk(cx, cy), cx * CH - camX, cy * CH - camY);
    ctx.save(); ctx.translate(-camX, -camY);
    // zonas de luz
    for (const z of S.zonas) {
      const a = 0.12 + 0.06 * Math.sin(R.t * 8); ctx.fillStyle = `rgba(255,230,120,${a})`; ctx.beginPath(); ctx.arc(Math.round(z.x), Math.round(z.y), z.r, 0, 6.2832); ctx.fill();
      const fz = quadroAnim('fx_singular', 'parada', Math.floor(R.t * 10) % 4); if (fz) ctx.drawImage(fz, Math.round(z.x - z.r * 1.15), Math.round(z.y - z.r * 1.05), Math.round(z.r * 2.3), Math.round(z.r * 2.1));
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(z.x), Math.round(z.y), z.r * (0.4 + 0.6 * (z.t / z.d)), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    }
    // aura de gelo
    for (const a of S.armas) if (a.id === 'aura') { const r = statsDe(S, a).raio * S.a.area; const fa = quadroAnim('fx_nevasca', 'parada', Math.floor(R.t * 7) % 4); ctx.fillStyle = 'rgba(160,230,255,.10)'; ctx.beginPath(); ctx.arc(Math.round(P.x), Math.round(P.y), r, 0, 6.2832); ctx.fill(); if (fa) { ctx.drawImage(fa, Math.round(P.x - r * 1.15), Math.round(P.y - r * 1.05), Math.round(r * 2.3), Math.round(r * 2.1)); continue; } ctx.strokeStyle = 'rgba(210,245,255,.55)'; ctx.setLineDash([2, 4]); ctx.lineDashOffset = -R.t * 20; ctx.beginPath(); ctx.arc(Math.round(P.x), Math.round(P.y), r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    // raios (aviso e coluna)
    for (const r of S.raios) {
      if (r.t > r.d * 0.5) { ctx.strokeStyle = 'rgba(255,240,120,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r * (1 - (r.t - r.d * 0.5) / (r.d * 0.5)), 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r, 0, 6.2832); ctx.stroke(); }
      else if (quadroAnim('fx_raio', 'parada', 1)) { const fr = quadroAnim('fx_raio', 'parada', 1 + Math.min(2, Math.floor((1 - r.t / (r.d * 0.5)) * 3))); ctx.fillStyle = 'rgba(190,230,255,.16)'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r, 0, 6.2832); ctx.fill(); ctx.drawImage(fr, Math.round(r.x - fr.width / 2), Math.round(r.y - fr.height + 4)); }
      else { ctx.fillStyle = '#fff6b0'; ctx.fillRect(Math.round(r.x) - 2, Math.round(r.y) - 120, 5, 120); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) - 120, 3, 120); ctx.fillStyle = 'rgba(255,240,120,.45)'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), r.r, 0, 6.2832); ctx.fill(); }
    }
    for (const p of S.pegadas) { ctx.globalAlpha = Math.min(0.55, (p.t / p.d) * 0.7); ctx.fillStyle = S.R.rastro || '#1f4f22'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 2); ctx.globalAlpha = 1; }
    // ataques avisados no chão
    for (const m of S.marcas) {
      const k = 1 - m.t / m.d; ctx.fillStyle = `rgba(255,60,60,${0.12 + 0.2 * k})`; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), m.r, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = `rgba(255,120,120,${0.6 + 0.4 * Math.sin(R.t * 18)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), m.r, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,90,.45)'; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), m.r * k, 0, 6.2832); ctx.fill();
    }
    // gemas e coletáveis
    for (const g of S.gemas) { if (g.x < camX - 10 || g.x > camX + w + 10 || g.y < camY - 10 || g.y > camY + h + 10) continue; desenhar(g.v >= 10 ? 'gema3' : g.v >= 3 ? 'gema2' : 'gema1', g.x, g.y + 3, 0, Math.round(Math.sin(R.t * 5 + g.x) * 1)); }
    for (const it of S.itens) desenhar(it.tipo, it.x, it.y + 4, 0, Math.round(Math.sin(R.t * 4 + it.x) * 1.5));
    // entidades por profundidade
    const ents = [];
    const AT = atlasDeProps(S.R.tema); // objetos do cenário entram na mesma ordenação (quem está mais abaixo aparece na frente)
    if (AT) for (let cy = Math.floor((camY - 20) / CH); cy <= Math.floor((camY + h + 60) / CH); cy++) for (let cx = Math.floor((camX - 40) / CH); cx <= Math.floor((camX + w + 40) / CH); cx++) for (const p of propsDoPedaco(S.R.tema, cx, cy)) ents.push({ prop: true, i: p.i, x: p.x, y: p.y });
    const AG = atlasDeProps(S.R.tema + '_g');
    if (AG) for (let cy = Math.floor((camY - 20) / CH); cy <= Math.floor((camY + h + 90) / CH); cy++) for (let cx = Math.floor((camX - 60) / CH); cx <= Math.floor((camX + w + 60) / CH); cx++) for (const p of grandesDoPedaco(S.R.tema, cx, cy)) ents.push({ prop: true, grande: true, i: p.i, x: p.x, y: p.y });
    for (const e of S.inim) if (e.x > camX - 40 && e.x < camX + w + 40 && e.y > camY - 40 && e.y < camY + h + 60) ents.push(e);
    ents.push({ jogador: true, y: P.y, x: P.x });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.prop) {
        const AA = e.grande ? AG : AT; const cols = AA.cols || 6; const col = e.i % cols; const lin = (e.i / cols) | 0; const pw = AA.w[e.i]; const ph = AA.h[e.i]; const bx = Math.round(e.x); const by = Math.round(e.y);
        // copas e ruínas grandes ficam meio transparentes quando o campeão está atrás delas
        const atras = e.grande && P.y < e.y && P.y > e.y - ph && Math.abs(P.x - e.x) < pw * 0.45;
        if (atras) ctx.globalAlpha = 0.5;
        ctx.drawImage(AA.img, col * AA.cw + Math.floor((AA.cw - pw) / 2), lin * AA.ch + AA.ch - 1 - ph, pw, ph, bx - Math.floor(pw / 2), by - ph, pw, ph);
        ctx.globalAlpha = 1;
        if (!e.grande && LUZ_PEQ[S.R.tema]) { const l = LUZ_PEQ[S.R.tema][e.i]; if (l) luz(l[0], bx, by - ph * l[3], l[1], l[2]); }
        else if (!e.grande) { if (e.i === 20) luz('#ffb347', bx, by - ph * 0.55, 14, 0.55); else if (e.i === 14) luz('#58a8ff', bx, by - ph * 0.5, 16, 0.45); else if (e.i === 21) luz('#ffe36a', bx, by - ph * 0.7, 13, 0.55); }
        else if (LUZ_GRANDES[S.R.tema]) { const l = LUZ_GRANDES[S.R.tema][e.i]; if (l) luz(l[0], bx, by - ph * l[3], l[1], l[2]); }
        else if (e.i === 4) luz('#58a8ff', bx, by - ph * 0.8, 22, 0.5); else if (e.i === 5) luz('#4aa3ff', bx, by - ph * 0.6, 26, 0.35); else if (e.i === 2) luz('#58e8ff', bx, by - ph * 0.8, 12, 0.5);
        continue;
      }
      if (e.jogador) {
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(Math.round(P.x) - 7, Math.round(P.y) - 1, 14, 4); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(Math.round(P.x) - 5, Math.round(P.y), 10, 2);
        const bob = P.andando ? Math.round(Math.abs(Math.sin(R.t * 12)) * 2) : 0;
        if (P.inv > 0 && Math.floor(R.t * 20) % 2 === 0 && S.estado === 'jogando' && P.inv < 5) continue;
        const an = quadroDoJogador(S);
        if (an) {
          const inc = -P.lean * 0.13; const px = Math.round(P.x); const pyF = Math.round(P.y + 8);
          ctx.save(); ctx.translate(px, pyF); if (P.face < 0) ctx.scale(-1, 1); ctx.transform(1, 0, inc * (P.face < 0 ? -1 : 1), 1, 0, 0);
          ctx.drawImage(an, -Math.round(an.width / 2), -an.height); ctx.restore();
          continue;
        }
        if (P.face < 0) { ctx.save(); ctx.translate(Math.round(P.x), 0); ctx.scale(-1, 1); desenhar(S.campeao, 0, P.y + 7, 0, -bob, P.flash > 0); ctx.restore(); } else desenhar(S.campeao, P.x, P.y + 7, 0, -bob, P.flash > 0);
        continue;
      }
      const nome = e.chefe ? (CHEFES[e.tipo].sprite || e.tipo) : e.tipo === 'minion' ? S.R.soldado : (S.R.matiz ? `${e.tipo}@${S.reino}` : e.tipo); const sombraW = Math.round(e.raio * 2.2);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(Math.round(e.x - sombraW / 2 - 1), Math.round(e.y + e.raio * 0.5 - 1), sombraW + 2, 4); ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(Math.round(e.x - sombraW / 2 + 1), Math.round(e.y + e.raio * 0.5), sombraW - 2, 2);
      const bob = Math.round(Math.abs(Math.sin(R.t * 9 + e.id)) * (e.chefe ? 1 : 2));
      if (e.estado === 1) { ctx.strokeStyle = 'rgba(255,60,60,.6)'; ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x + e.dx * 70), Math.round(e.y + e.dy * 70)); ctx.stroke(); }
      const esc = 1;
      const fl = e.flash > 0; let spr;
      if (e.chefe && nQuadros(nome, 'ataque') && (e.animAtq > 0 || e.estado > 0)) spr = quadroAnim(nome, 'ataque', e.estado === 2 || (e.animAtq > 0 && e.animAtq <= 0.55) ? 1 : 0, fl); // preparo e golpe do chefe
      else if (e.chefe && nQuadros(nome, 'parada')) spr = quadroAnim(nome, 'parada', Math.floor(R.t * 3 + e.id) % nQuadros(nome, 'parada'), fl);
      else { const nq = nQuadros(nome, 'andando'); spr = nq ? quadroAnim(nome, 'andando', Math.floor(R.t * 7 + e.id) % nq, fl) : nome; } // animação de caminhada, se houver
      const sq = e.flash > 0 ? 1.14 : 1;
      if (e.face < 0) { ctx.save(); ctx.translate(Math.round(e.x), 0); ctx.scale(-1, 1); desenhar(spr, 0, e.y + e.raio + 2, 0, -bob, e.flash > 0, esc * sq, esc / sq); ctx.restore(); } else desenhar(spr, e.x, e.y + e.raio + 2, 0, -bob, e.flash > 0, esc * sq, esc / sq);
      if (e.encantado > 0) { ctx.fillStyle = '#ff77b8'; ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - e.raio - 12 - Math.round(Math.sin(R.t * 8))), 2, 2); ctx.fillRect(Math.round(e.x + 1), Math.round(e.y - e.raio - 12 - Math.round(Math.sin(R.t * 8))), 2, 2); ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - e.raio - 10), 6, 2); ctx.fillRect(Math.round(e.x - 2), Math.round(e.y - e.raio - 8), 4, 1); }
      if (e.lento > 0) { ctx.fillStyle = 'rgba(160,230,255,.35)'; ctx.fillRect(Math.round(e.x - e.raio), Math.round(e.y + e.raio - 2), e.raio * 2, 3); }
      if (e.hp < e.hpMax && !e.chefe) { const bw = Math.max(10, e.raio * 2); barra(Math.round(e.x - bw / 2), Math.round(e.y - e.raio - 6), bw, 2, e.hp / e.hpMax, '#e04545'); }
    }
    for (const f of S.fant) { // corpo que some em branco ao morrer
      const k = f.t / f.d; const nome = f.chefe ? (CHEFES[f.tipo].sprite || f.tipo) : f.tipo === 'minion' ? S.R.soldado : (S.R.matiz ? `${f.tipo}@${S.reino}` : f.tipo);
      if (f.chefe && nQuadros(nome, 'morte')) { ctx.globalAlpha = Math.min(1, k * 1.6); desenhar(quadroAnim(nome, 'morte', 0, k > 0.85), f.x, f.y + f.raio + 2, 0, 0, false, 1, 1); ctx.globalAlpha = 1; continue; }
      ctx.globalAlpha = Math.min(1, k * 1.4); desenhar(nome, f.x, f.y + f.raio + 2, 0, 0, true, 1 + (1 - k) * 0.3, k * 0.9 + 0.1); ctx.globalAlpha = 1;
    }
    // armas visíveis: lâminas giratórias
    for (const a of S.armas) if (a.id === 'lamina') { const st = statsDe(S, a); const Rr = st.raio * S.a.area; for (let i = 0; i < st.qtd; i++) { const an = a.ang + (i * 6.2832) / st.qtd; const bx = P.x + Math.cos(an) * Rr; const by = P.y + Math.sin(an) * Rr; ctx.save(); ctx.translate(Math.round(bx), Math.round(by)); ctx.rotate(an + 1.5708); const sl = sprite('lamina'); ctx.drawImage(sl, -Math.round(sl.width / 2), -Math.round(sl.height / 2)); ctx.restore(); } }
    // projéteis
    for (const q of S.proj) {
      if (q.tipo === 'orbe') { const s = sprite('orbe'); ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2)); ctx.restore(); }
      else if (q.tipo === 'coracao') { const s = sprite('coracao'); ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2)); ctx.restore(); }
      else if (q.tipo === 'shuriken') { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); const ss = sprite('shuriken'); ctx.drawImage(ss, -Math.round(ss.width / 2), -Math.round(ss.height / 2)); ctx.restore(); }
      else if (q.tipo === 'flecha') { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.ang); const sf = sprite('flecha'); ctx.drawImage(sf, -Math.round(sf.width / 2), -Math.round(sf.height / 2)); ctx.restore(); }
      else { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(Math.atan2(q.vy, q.vx)); const sb = sprite('bala'); ctx.drawImage(sb, -Math.round(sb.width / 2), -Math.round(sb.height / 2)); ctx.restore(); }
    }
    const se = sprite(S.R.tema === 'ixtal' ? 'ejade' : 'eorbe'); for (const q of S.eproj) { ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.drawImage(se, -Math.round(se.width / 2), -Math.round(se.height / 2)); ctx.restore(); }
    // efeitos de morte e explosão
    for (const f of S.efeitos) {
      const k = 1 - f.t / f.d;
      if (f.tipo === 'morte') { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; const r = f.r * (0.6 + k); ctx.fillRect(Math.round(f.x - r), Math.round(f.y - 1), Math.round(r * 2), 2); ctx.fillRect(Math.round(f.x - 1), Math.round(f.y - r), 2, Math.round(r * 2)); }
      else if (f.tipo === 'bauaberto') { const sb = sprite('bauaberto'); if (sb) { ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.drawImage(sb, Math.round(f.x - sb.width / 2), Math.round(f.y + 4 - sb.height - k * 10)); ctx.globalAlpha = 1; } }
      else if (f.tipo === 'faisca') { const fs = quadroAnim('fx_faisca', 'parada', k * 4); if (fs) ctx.drawImage(fs, Math.round(f.x - fs.width / 2), Math.round(f.y - fs.height / 2)); }
      else { const cc = f.cor ? f.cor.join(',') : '255,240,150'; ctx.strokeStyle = `rgba(${cc},${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(f.x), Math.round(f.y), f.r * (0.4 + 0.7 * k), 0, 6.2832); ctx.stroke(); ctx.fillStyle = `rgba(${cc},${0.25 * (1 - k)})`; ctx.fill(); }
    }
    // luzes e partículas (aditivo)
    const COR_LUZ = { orbe: ['#58a8ff', 16], coracao: ['#ff77b8', 14], flecha: ['#58e8ff', 9], shuriken: ['#b45cff', 11], bala: ['#ffe36a', 8] };
    for (const q of S.proj) { const l = COR_LUZ[q.tipo]; if (l) luz(l[0], q.x, q.y, l[1], 0.7); }
    for (const q of S.eproj) luz('#c060ff', q.x, q.y, 9, 0.6);
    for (const g of S.gemas) luz(g.v >= 10 ? '#ff77b8' : g.v >= 3 ? '#9be15d' : '#58e8ff', g.x, g.y, 7, 0.45);
    for (const it of S.itens) luz(it.tipo === 'bau' ? '#ffd24a' : it.tipo === 'vida' ? '#ff6a7a' : '#ffe36a', it.x, it.y, 10, 0.5);
    for (const z of S.zonas) luz('#ffe36a', z.x, z.y, Math.round(z.r * 1.1), 0.25);
    for (const q of S.part) { const k = q.t / q.d; if (q.brilho) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; ctx.fillStyle = q.cor; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.tam, q.tam); ctx.globalAlpha = k * 0.5; ctx.drawImage(glow(q.cor, 5), Math.round(q.x - 5), Math.round(q.y - 5)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } else { ctx.globalAlpha = k * 0.8; ctx.fillStyle = q.cor; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.tam, q.tam); ctx.globalAlpha = 1; } }
    if (S.p.hp > 0) { const pl = S.campeao === 'ahri' ? '#7a9cff' : S.campeao === 'garen' ? '#8ab4ff' : S.campeao === 'jinx' ? '#58e8ff' : '#ffe9a0'; luz(pl, S.p.x, S.p.y - 2, 22, 0.28); }
    // números de dano
    for (const t of S.textos) { const idade = 0.6 - t.t; const esc = t.crit ? (idade < 0.12 ? 3 : 2) : (idade < 0.08 ? 2 : 1); const cor = t.jogador ? '#ff5a5a' : t.crit ? '#ffd24a' : '#ffffff'; num(t.v, t.x - String(t.v).length * 2 * esc + 1, t.y + 1, '#14101e', esc); num(t.v, t.x - String(t.v).length * 2 * esc, t.y, cor, esc); }
    ctx.restore();
    clima(S);
    const am = AMBIENTE[S.reino]; if (am) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1; ctx.fillStyle = am[0]; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; }
    vinheta(w, h);
    // vinheta de dano
    if (P.flash > 0) { ctx.fillStyle = `rgba(255,40,40,${Math.min(0.35, P.flash * 2)})`; ctx.fillRect(0, 0, w, h); }
    if (!S.demo) hud(S);
  }

  let vin = null;
  function vinheta(w, h) {
    if (!vin || vin.width !== w || vin.height !== h) {
      vin = document.createElement('canvas'); vin.width = w; vin.height = h; const x = vin.getContext('2d'); const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      g.addColorStop(0, 'rgba(8,4,20,0)'); g.addColorStop(1, 'rgba(8,4,20,.55)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    ctx.drawImage(vin, 0, 0);
  }
  function clima(S) {
    const tipo = S.R.clima; if (!tipo) return; const { w, h } = R; const T = R.t;
    const cfg = { petalas: [34, '#ffb3d1', 9, 14, 2, 2], folhas: [26, '#c9e46a', 7, 18, 2, 2], brasas: [40, '#ff8a3a', 3, -26, 1, 1], areia: [46, '#f4dc98', 70, 5, 4, 1], neve: [60, '#ffffff', 5, 24, 1, 1] }[tipo];
    if (!cfg) return; const [n, cor, vx, vy, pw, ph] = cfg;
    for (let i = 0; i < n; i++) {
      const sx = hash(i, 11); const sy = hash(i, 23); const sp = 0.6 + hash(i, 37) * 0.8;
      let px = (sx * w + T * vx * sp + Math.sin(T * 1.3 + i) * (tipo === 'petalas' || tipo === 'folhas' ? 6 : 1) - R.camX * 0.25) % w; let py = (sy * h + T * vy * sp - R.camY * 0.25) % h;
      if (px < 0) px += w; if (py < 0) py += h;
      ctx.fillStyle = tipo === 'brasas' && i % 3 === 0 ? '#ffd24a' : cor; ctx.globalAlpha = tipo === 'areia' ? 0.5 : 0.85; ctx.fillRect(Math.round(px), Math.round(py), tipo === 'areia' ? 5 : pw, ph);
    }
    ctx.globalAlpha = 1;
    if (tipo === 'brasas' || tipo === 'areia') { ctx.fillStyle = tipo === 'brasas' ? 'rgba(120,20,10,.10)' : 'rgba(240,200,110,.08)'; ctx.fillRect(0, 0, w, h); }
    if (tipo === 'neve') { ctx.fillStyle = 'rgba(150,200,255,.07)'; ctx.fillRect(0, 0, w, h); }
  }

  function hud(S) {
    const { w, h } = R; const P = S.p;
    barra(0, 0, w, 5, S.xp / S.xpProx, '#58a8ff'); // experiência
    texto(`NV ${S.nivel}`, 4, 8, '#ffe36a');
    barra(4, 20, 52, 5, P.hp / P.hpMax, P.hp / P.hpMax < 0.3 ? '#ff5a5a' : '#e04545');
    texto(`${Math.ceil(P.hp)}/${P.hpMax}`, 60, 19, '#fff');
    const idFinal = S.R.chefes.find((id) => CHEFES[id].final); const falta = S.R.tempo - S.t;
    texto(tempoTxt(S.t), w / 2, 8, falta < 30 && !S.chefes[idFinal] ? '#ff6a6a' : '#fff', 'center');
    ctx.font = FONTE; const ico = (nome, s, y, cor, yy) => { const wt = Math.ceil(ctx.measureText(s).width); texto(s, w - 4, y, cor, 'right'); const ic = icone(nome); if (ic) ctx.drawImage(ic, w - 4 - wt - 17, yy); };
    ico('cranio', `${S.abates}`, 7, '#ffffff', 2); ico('ouro', `${S.ouro}`, 25, '#f5c82e', 20);
    // armas e itens
    let x = 4; const y = h - 17;
    for (const a of S.armas) { const ic = icone(a.id); ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 1, y - 2, 18, 18); ctx.drawImage(ic, x, y - 1); texto(String(a.nivel), x + 15, y + 8, a.nivel >= 5 ? '#ffe36a' : '#fff', 'right'); x += 19; }
    x += 4;
    for (const [id, nv] of Object.entries(S.passivas)) { const ic = icone(id); ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 1, y - 2, 18, 18); ctx.drawImage(ic, x, y - 1); texto(String(nv), x + 15, y + 8, nv >= 5 ? '#ffe36a' : '#fff', 'right'); x += 19; }
    if (S.combo.n >= 8 && S.t - S.combo.t < 3) texto(`COMBO x${S.combo.n}`, w - 4, 40, '#ffb347', 'right');
    if (S.maldicoes.length) texto('☠'.repeat(S.maldicoes.length), 4, 28, '#ff6a7a');
    // chefe
    const b = S.chefeVivo;
    if (b && b.hp > 0) { const bw = Math.min(160, w - 40); barra(Math.round(w / 2 - bw / 2), 34, bw, 6, b.hp / b.hpMax, '#b45cff'); texto(CHEFES[b.tipo].nome.toUpperCase(), w / 2, 42, '#e9d5ff', 'center'); }
    if (!S.chefes[idFinal]) { if (falta > 0 && falta < 60) texto(`${CHEFES[idFinal].nome.split(',')[0].toUpperCase()} EM ${Math.ceil(falta)}s`, w / 2, 20, '#ff9a9a', 'center'); }
  }

  return { quadro, resize(lw, lh) { canvas.width = lw; canvas.height = lh; R.w = lw; R.h = lh; ctx.imageSmoothingEnabled = false; }, get w() { return R.w; }, get h() { return R.h; }, ctx };
}
