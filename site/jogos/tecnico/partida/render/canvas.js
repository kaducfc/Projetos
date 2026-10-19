// Renderização: só desenha o estado oficial do motor (posições, vida, mortes, efeitos). Nunca decide acertos, quedas ou mortes.
import { MUNDO } from '../nucleo/coord.js';
import { campIcone, campUrl } from '../../js/campeoes-img.js';

const COR = { azul: '#4aa3ff', vermelho: '#ff5a5a', neutro: '#d8c27a' };
const COR_MON = { sentinela: '#5aa9ff', brambleback: '#ff6a5a', gromp: '#7bd36b', lobos: '#b0b7c6', raptores: '#f08a4b', krugs: '#b79a6a', caranguejo: '#7fe0d0' };

export class Renderizador {
  constructor(canvas, imagemMapa) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.img = imagemMapa;
    this.icones = new Map(); this.sprites = new Map(); this.rumo = new Map(); this.interp = { a: 1, prev: new Map() };
    this.camadas = {}; this.fxDano = []; this.selecionado = null;
    this.estruturasCaidas = new Map();
    this.fog = null; // equipe cujo campo de visão é mostrado ('azul' | 'vermelho'); null = vê tudo
    this._moitaCv = null; this._fogCv = null;
  }
  ajustar(largura) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const altura = Math.round(largura * MUNDO.altura / MUNDO.largura);
    this.cv.style.width = largura + 'px'; this.cv.style.height = altura + 'px';
    this.cv.width = Math.round(largura * dpr); this.cv.height = Math.round(altura * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = largura; this.h = altura; this.k = largura / MUNDO.largura;
    this.u = Math.max(0.55, Math.min(1.25, largura / 1000)); // fator de tamanho dos ícones
    this._moitaCv = null; this._fogCv = null;
  }
  // A unidade aparece na tela? Com fog, inimigos só aparecem dentro do campo de visão da equipe mostrada (e fora de moitas escondidas).
  visto(P, u) {
    if (!this.fog || u.equipe === this.fog || u.tipo === 'estrutura') return true;
    if (!P.visivelPara(this.fog, u)) return false;
    for (const f of P.equipes[this.fog].fontes || []) if (Math.hypot(f.x - u.x, f.y - u.y) <= f.r) return true;
    return false;
  }
  vista() { return { largura: this.w, altura: this.h }; }
  // Ícone do campeão (Data Dragon). Só desenha a imagem de um quadro em que ela já carregou; se o endereço ainda
  // não existe ou a imagem falhou, tenta de novo depois de alguns segundos em vez de ficar para sempre com a inicial.
  icone(nome) {
    let e = this.icones.get(nome); const agora = Date.now();
    if (e && (e.ok || (e.img && !e.falhou) || agora - e.tentou < 5000)) return e;
    const u = campUrl(nome); e = { img: null, ok: false, falhou: false, tentou: agora };
    if (u && typeof Image === 'function') { const im = new Image(); im.onload = () => { e.ok = true; }; im.onerror = () => { e.falhou = true; }; im.src = u; e.img = im; }
    this.icones.set(nome, e); return e;
  }
  // Miniaturas das estruturas e monstros (img/*.webp). Sem imagem carregada, volta ao desenho geométrico.
  sprite(nome) {
    let e = this.sprites.get(nome); if (e) return e;
    e = { img: typeof Image === 'function' ? new Image() : null, ok: false };
    if (!e.img) { this.sprites.set(nome, e); return e; } // sem DOM (testes em Node)
    e.img.onload = () => { e.ok = true; }; e.img.src = new URL(`../img/${nome}.webp`, import.meta.url).href;
    this.sprites.set(nome, e); return e;
  }
  desenharSprite(c, nome, x, y, larg, ancora = 0.5, alpha = 1) {
    const e = this.sprite(nome); if (!e.ok) return false;
    const h = larg * e.img.naturalHeight / e.img.naturalWidth;
    if (alpha < 1) c.globalAlpha = alpha;
    c.drawImage(e.img, x - larg / 2, y - h * ancora, larg, h);
    if (alpha < 1) c.globalAlpha = 1;
    return true;
  }
  pos(u) {
    const p = this.interp.prev.get(u.id); const a = this.interp.a;
    if (!p || a >= 1) return { x: u.x * this.k, y: u.y * this.k };
    const dx = u.x - p.x, dy = u.y - p.y; if (dx * dx + dy * dy > 1500 * 1500) return { x: u.x * this.k, y: u.y * this.k }; // teleporte/recall: sem interpolar
    return { x: (p.x + dx * a) * this.k, y: (p.y + dy * a) * this.k };
  }
  desenhar(P, depur) {
    const c = this.ctx, k = this.k, U = this.u;
    c.clearRect(0, 0, this.w, this.h);
    if (this.img && this.img.complete) c.drawImage(this.img, 0, 0, this.w, this.h);
    c.fillStyle = 'rgba(4,10,24,0.22)'; c.fillRect(0, 0, this.w, this.h); // leve escurecimento para destacar as unidades
    if (depur) depur(c);
    this.moitas(P, c);
    if (this.fog) this.neblina(P, c);
    this.estruturas(P, c, U);
    this.selva(P, c, U);
    this.minions(P, c, U);
    this.efeitosChao(P, c, U);
    this.wards(P, c, U);
    this.campeoes(P, c, U);
    this.projeteis(P, c, U);
    this.efeitosAcima(P, c, U);
    this.mortos(P, c, U);
    if (P.fim) this.fimDeJogo(P, c);
  }
  // Campeões mortos: círculo com a foto em preto e branco e os segundos que faltam para renascer, no canto de baixo do time (azul à esquerda, vermelho à direita), na mesma altura nos dois lados.
  mortos(P, c, U) {
    const D = Math.max(34, Math.min(54, this.w * 0.042)); const r = D / 2; const gap = 8 * U;
    for (const eq of ['azul', 'vermelho']) {
      let i = 0;
      for (const u of P.campeoes) {
        if (u.equipe !== eq || !u.morto) continue;
        const x = eq === 'azul' ? r + 10 * U : this.w - r - 10 * U; const y = this.h - r - 14 * U - i * (D + gap); i++; // os dois times na mesma altura, no canto de baixo, empilhando para cima
        const falta = Math.max(0, u.renasceEm - P.t);
        c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
        const ic = this.icone(u.campeao);
        if (ic.ok) { c.drawImage(ic.img, x - r, y - r, D, D); c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(x - r, y - r, D, D); c.globalCompositeOperation = 'source-over'; }
        else { c.fillStyle = '#3a3f4a'; c.fillRect(x - r, y - r, D, D); c.fillStyle = '#9aa3b2'; c.font = `bold ${Math.round(r)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText((u.campeao || '?')[0], x, y + r * 0.35); }
        c.fillStyle = 'rgba(5,10,22,0.55)'; c.fillRect(x - r, y - r, D, D);
        c.restore();
        c.strokeStyle = COR[eq]; c.lineWidth = 2.4 * U; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
        c.font = `bold ${Math.round(r * 0.95)}px Inter, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.fillStyle = '#fff';
        const t = String(Math.ceil(falta)); c.strokeText(t, x, y + r * 0.34); c.fillText(t, x, y + r * 0.34);
      }
    }
  }
  // Moitas: camada verde sobre as células marcadas (desenhada uma vez por tamanho de tela).
  moitas(P, c) {
    const T = P.terreno; if (!T.moitas || !T.moitas.length || typeof document === 'undefined') return;
    if (!this._moitaCv) {
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(this.w)); cv.height = Math.max(1, Math.round(this.h)); const g = cv.getContext('2d');
      const cel = T.cel * this.k;
      for (let y = 0; y < T.rows; y++) for (let x = 0; x < T.cols; x++) {
        if (!T.moita[y * T.cols + x]) continue;
        g.fillStyle = 'rgba(46,150,62,0.34)'; g.fillRect(x * cel, y * cel, cel + 0.6, cel + 0.6);
      }
      this._moitaCv = cv;
    }
    c.drawImage(this._moitaCv, 0, 0, this.w, this.h);
  }
  // Neblina: escurece o que a equipe mostrada não enxerga e deixa claro o raio de visão de campeões, minions, torres e wards.
  neblina(P, c) {
    if (typeof document === 'undefined') return;
    if (!this._fogCv) { this._fogCv = document.createElement('canvas'); this._fogCv.width = Math.max(1, Math.round(this.w)); this._fogCv.height = Math.max(1, Math.round(this.h)); }
    const f = this._fogCv.getContext('2d'); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, this._fogCv.width, this._fogCv.height);
    f.fillStyle = 'rgba(3,8,20,0.58)'; f.fillRect(0, 0, this._fogCv.width, this._fogCv.height);
    f.globalCompositeOperation = 'destination-out';
    for (const s of P.equipes[this.fog].fontes || []) {
      const x = s.x * this.k, y = s.y * this.k, r = s.r * this.k;
      const g = f.createRadialGradient(x, y, r * 0.55, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, 7); f.fill();
    }
    c.drawImage(this._fogCv, 0, 0, this.w, this.h);
  }
  // Wards: as da equipe mostrada sempre aparecem; as inimigas só quando reveladas por uma Ward de Controle (ou com a visão total ligada, esmaecidas).
  wards(P, c, U) {
    for (const w of P.wards || []) {
      if (w.morto) continue;
      const mostrada = !this.fog || w.equipe === this.fog || (w.reveladaPara && w.reveladaPara[this.fog]);
      const x = w.x * this.k, y = w.y * this.k; const cor = COR[w.equipe]; const r = (w.subtipo === 'controle' ? 6 : 5) * U;
      if (!mostrada) continue;
      const aliada = !this.fog || w.equipe === this.fog;
      c.save(); c.globalAlpha = aliada || this.fog ? 1 : 0.6;
      const arco = (rr) => { if (w.expira !== Infinity) { c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (w.expira - P.t) / (w.expira - w.criadaEm))); c.stroke(); } };
      const nome = w.subtipo === 'controle' ? 'ward_controle' : 'ward'; const larg = (w.subtipo === 'controle' ? 22 : 20) * U;
      if (this.sprite(nome).ok) { // imagem da ward, com um anel na cor do time embaixo (e o tempo que falta, nos totens)
        c.strokeStyle = cor; c.lineWidth = 2 * U; c.globalAlpha *= 0.9; c.beginPath(); c.ellipse(x, y + larg * 0.2, larg * 0.42, larg * 0.16, 0, 0, 7); c.stroke(); c.globalAlpha = aliada || this.fog ? 1 : 0.6;
        this.desenharSprite(c, nome, x, y + larg * 0.3, larg, 0.8);
        arco(larg * 0.62);
      } else {
        c.fillStyle = w.subtipo === 'controle' ? '#e05aff' : '#ffd84a'; c.strokeStyle = cor; c.lineWidth = 1.6 * U;
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#10203d'; c.beginPath(); c.arc(x, y, r * 0.38, 0, 7); c.fill();
        arco(r + 2.4 * U);
      }
      c.restore();
    }
  }
  barra(c, x, y, w, h, f, cor) {
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = cor; c.fillRect(x, y, Math.max(0, w * Math.min(1, f)), h);
  }
  estruturas(P, c, U) {
    for (const e of P.estruturas) {
      const x = e.x * this.k, y = e.y * this.k; const cor = COR[e.equipe];
      const r = (e.subtipo === 'nexus' ? 15 : e.subtipo === 'inibidor' ? 9 : 8) * U;
      if (e.morto) {
        c.strokeStyle = 'rgba(180,180,180,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * 0.7, y - r * 0.7); c.lineTo(x + r * 0.7, y + r * 0.7); c.moveTo(x + r * 0.7, y - r * 0.7); c.lineTo(x - r * 0.7, y + r * 0.7); c.stroke();
        c.fillStyle = 'rgba(60,60,60,0.55)'; c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fill();
        continue;
      }
      const vuln = P.estruturaVulneravel(e);
      const larg = (e.subtipo === 'nexus' ? 66 : e.subtipo === 'inibidor' ? 38 : 34) * U;
      if (this.sprite(`${e.subtipo}_${e.equipe}`).ok) { // miniatura na cor do time
        c.fillStyle = cor; c.globalAlpha = 0.28; c.beginPath(); c.ellipse(x, y + larg * 0.12, larg * 0.5, larg * 0.2, 0, 0, 7); c.fill(); c.globalAlpha = 1;
        this.desenharSprite(c, `${e.subtipo}_${e.equipe}`, x, y + larg * 0.3, larg, e.subtipo === 'torre' ? 0.82 : 0.7, vuln ? 1 : 0.8);
        if (e.hp < e.hpMax || e.subtipo === 'nexus') this.barra(c, x - larg * 0.4, y - larg * 0.62 - 4 * U, larg * 0.8, 3 * U, e.hp / e.hpMax, e.hp / e.hpMax > 0.5 ? '#6adf7a' : '#e8b34a');
        continue;
      }
      c.save(); c.translate(x, y);
      c.fillStyle = 'rgba(8,16,36,0.85)'; c.strokeStyle = cor; c.lineWidth = 2.2 * U;
      c.beginPath();
      if (e.subtipo === 'torre') { c.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5); }
      else if (e.subtipo === 'inibidor') { c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); }
      else { c.arc(0, 0, r, 0, 7); }
      c.fill(); c.stroke();
      if (e.subtipo === 'torre') { c.fillStyle = cor; c.beginPath(); c.arc(0, 0, r * 0.3, 0, 7); c.fill(); }
      if (e.subtipo === 'nexus') { c.fillStyle = cor; c.beginPath(); c.arc(0, 0, r * 0.45, 0, 7); c.fill(); }
      if (!vuln) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r + 3 * U, 0, 7); c.stroke(); }
      c.restore();
      if (e.hp < e.hpMax || e.subtipo === 'nexus') this.barra(c, x - r, y - r - 6 * U, r * 2, 3 * U, e.hp / e.hpMax, e.hp / e.hpMax > 0.5 ? '#6adf7a' : '#e8b34a');
    }
  }
  selva(P, c, U) {
    for (const m of P.monstros) {
      if (m.morto || !this.visto(P, m)) continue; const x = m.x * this.k, y = m.y * this.k; const camp = P.acampamentos.find((a) => a.id === m.campo);
      const grande = m.raio >= 70; const r = (grande ? 6.5 : 4) * U;
      if (camp && this.sprite(camp.tipo).ok) { const l = (camp.tipo === 'caranguejo' ? 22 : m.raio >= 80 ? 40 : m.raio >= 60 ? 32 : m.raio >= 45 ? 24 : 18) * U; this.desenharSprite(c, camp.tipo, x, y + l * 0.25, l, 0.6); if (m.hp < m.hpMax) this.barra(c, x - l * 0.4, y - l * 0.5 - 3 * U, l * 0.8, 2.5 * U, m.hp / m.hpMax, '#d36b4a'); continue; }
      c.fillStyle = COR_MON[camp?.tipo] || '#d8c27a'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
      if (m.hp < m.hpMax) this.barra(c, x - r, y - r - 5 * U, r * 2, 2.5 * U, m.hp / m.hpMax, '#d36b4a');
    }
    for (const e of P.epicos) {
      if (e.morto || !this.visto(P, e)) continue; const x = e.x * this.k, y = e.y * this.k; const r = (e.subtipo === 'barao' ? 15 : 12) * U;
      const grd = c.createRadialGradient(x, y, 2, x, y, r * 2); grd.addColorStop(0, e.subtipo === 'barao' ? 'rgba(170,90,255,0.9)' : e.subtipo === 'arauto' ? 'rgba(90,200,255,0.9)' : 'rgba(255,150,70,0.9)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grd; c.beginPath(); c.arc(x, y, r * 2, 0, 7); c.fill();
      const sp = e.subtipo === 'anciao' ? 'dragao' : e.subtipo;
      if (this.sprite(sp).ok) { const l = r * (e.subtipo === 'barao' ? 3.4 : 3.1); this.desenharSprite(c, sp, x, y + l * 0.1, l, 0.55); this.barra(c, x - r * 1.4, y - l * 0.55 - 6 * U, r * 2.8, 4 * U, e.hp / e.hpMax, '#e07040'); continue; }
      c.fillStyle = '#1a1030'; c.strokeStyle = '#f0cf72'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#f0cf72'; c.font = `bold ${Math.round(10 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText(e.subtipo === 'barao' ? 'B' : e.subtipo === 'arauto' ? 'A' : e.subtipo === 'anciao' ? 'DA' : 'D', x, y + 3.5 * U);
      this.barra(c, x - r * 1.4, y - r - 8 * U, r * 2.8, 4 * U, e.hp / e.hpMax, '#e07040');
    }
    // temporizadores dos covis e acampamentos que renascem
    c.font = `${Math.round(9 * U)}px Inter, sans-serif`; c.textAlign = 'center';
    for (const a of P.acampamentos) if (a.estado === 'morto' && a.respawnEm) { const s = Math.ceil(a.respawnEm - P.t); if (s > 0 && s < 100) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText(s + 's', a.x * this.k, a.y * this.k + 3 * U); } }
  }
  minions(P, c, U) {
    for (const m of P.minions) {
      if (m.morto || !this.visto(P, m)) continue; const p = this.pos(m); const cor = COR[m.equipe];
      if (m.auraBarao || m.subtipo === 'arauto') { // aura roxa: no minion com o buff do Barão e, só para destacar no mapa, no Arauto conquistado (que não recebe bônus)
        const lm = (m.subtipo === 'arauto' ? 40 : m.subtipo === 'cerco' ? 22 : m.subtipo === 'super' ? 28 : m.subtipo === 'conjurador' ? 16 : 18) * U; const ra = lm * 0.95;
        const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, ra); g.addColorStop(0, 'rgba(200,120,255,0.75)'); g.addColorStop(0.6, 'rgba(170,80,255,0.45)'); g.addColorStop(1, 'rgba(150,60,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, ra, 0, 7); c.fill();
        c.save(); c.strokeStyle = '#d27bff'; c.lineWidth = Math.max(2, 2.2 * U); c.shadowColor = '#b04dff'; c.shadowBlur = 8 * U;
        c.beginPath(); c.ellipse(p.x, p.y + lm * 0.1, lm * 0.62, lm * 0.3, 0, 0, 7); c.stroke();
        c.beginPath(); c.arc(p.x, p.y - lm * 0.05, lm * 0.55, 0, 7); c.globalAlpha = 0.7; c.stroke(); c.restore();
      }
      if (m.subtipo === 'arauto' && this.sprite('arauto').ok) { // o Arauto conquistado usa a mesma imagem do Arauto do rio
        const l = 40 * U;
        c.fillStyle = cor; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(p.x, p.y + l * 0.2, l * 0.4, l * 0.15, 0, 0, 7); c.fill(); c.globalAlpha = 1;
        this.desenharSprite(c, 'arauto', p.x, p.y + l * 0.1, l, 0.7);
        this.barra(c, p.x - l * 0.35, p.y - l * 0.5, l * 0.7, 3 * U, m.hp / m.hpMax, '#6adf7a');
        continue;
      }
      if (m.subtipo !== 'arauto') { // miniatura na cor do time; de costas quando sobe no mapa, de frente quando desce
        const ant = this.interp.prev.get(m.id); if (ant && Math.abs(m.y - ant.y) > 0.5) this.rumo.set(m.id, m.y < ant.y ? 'costas' : 'frente');
        const lado = this.rumo.get(m.id) || (m.equipe === 'azul' ? 'costas' : 'frente');
        const l = (m.subtipo === 'cerco' ? 22 : m.subtipo === 'super' ? 28 : m.subtipo === 'conjurador' ? 16 : 18) * U;
        if (this.sprite(`minion_${m.equipe}_${lado}`).ok) {
          c.fillStyle = cor; c.globalAlpha = 0.3; c.beginPath(); c.ellipse(p.x, p.y + l * 0.05, l * 0.38, l * 0.14, 0, 0, 7); c.fill(); c.globalAlpha = 1;
          this.desenharSprite(c, `minion_${m.equipe}_${lado}`, p.x, p.y + l * 0.3, l, 0.85);
          if (m.hp < m.hpMax * 0.98) this.barra(c, p.x - l * 0.35, p.y - l * 0.6 - 2 * U, l * 0.7, 1.8 * U, m.hp / m.hpMax, '#6adf7a');
          continue;
        }
      }
      const r = (m.subtipo === 'cerco' ? 4.6 : m.subtipo === 'super' ? 5.5 : m.subtipo === 'arauto' ? 8 : 3.4) * U;
      c.fillStyle = cor; c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 1;
      c.beginPath();
      if (m.subtipo === 'conjurador') { c.moveTo(p.x, p.y - r); c.lineTo(p.x + r, p.y + r * 0.8); c.lineTo(p.x - r, p.y + r * 0.8); c.closePath(); }
      else if (m.subtipo === 'cerco' || m.subtipo === 'super') c.rect(p.x - r, p.y - r, r * 2, r * 2);
      else c.arc(p.x, p.y, r, 0, 7);
      c.fill(); c.stroke();
      if (m.hp < m.hpMax * 0.98) this.barra(c, p.x - r, p.y - r - 3.5 * U, r * 2, 1.8 * U, m.hp / m.hpMax, '#6adf7a');
    }
  }
  campeoes(P, c, U) {
    const D = Math.max(22, Math.min(40, this.w * 0.027)); const r = D / 2;
    for (const u of P.campeoes) {
      if (!u.morto && !this.visto(P, u)) continue;
      const p = this.pos(u); const cor = COR[u.equipe];
      if (u.morto) {
        c.globalAlpha = 0.5; this.desenharIcone(c, u, p.x, p.y, r * 0.8, '#777', true); c.globalAlpha = 1;
        c.fillStyle = '#fff'; c.font = `bold ${Math.round(11 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText(Math.ceil(Math.max(0, u.renasceEm - P.t)) + 's', p.x, p.y + 4 * U);
        continue;
      }
      // anel de vida/estado
      if (u.recallAte && u.recallAte > P.t) { c.strokeStyle = 'rgba(120,200,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (u.recallAte - P.t) / P.regras.campeao.recall.canal)); c.stroke(); }
      if (u.estado === 'lutando' || u.estado === 'gank') { c.strokeStyle = 'rgba(255,90,70,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, r + 4, 0, 7); c.stroke(); }
      this.desenharIcone(c, u, p.x, p.y, r, cor, false);
      if (u.escudo > 0 && u.escudoAte > P.t) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 2, 0, 7); c.stroke(); }
      if (u.efeitos.some((e) => e.tipo === 'stun' && e.ate > P.t)) { c.fillStyle = '#ffe14a'; c.font = `bold ${Math.round(13 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText('✦', p.x, p.y - r - 12 * U); }
      // barra de vida + recurso e nível
      this.barra(c, p.x - r, p.y + r + 2, r * 2, 4 * U, u.hp / u.hpMax, u.equipe === 'azul' ? '#4aa3ff' : '#ff6a6a');
      this.barra(c, p.x - r, p.y + r + 2 + 4.6 * U, r * 2, 2 * U, u.mana / Math.max(1, u.manaMax), '#7aa0ff');
      c.fillStyle = 'rgba(8,16,36,0.92)'; c.strokeStyle = cor; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x - r + 2, p.y - r + 2, 7 * U, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = `bold ${Math.round(9 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText(u.nivel, p.x - r + 2, p.y - r + 2 + 3 * U);
      if (this.selecionado === u.id) { c.strokeStyle = '#f0cf72'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 9, 0, 7); c.stroke(); }
    }
  }
  desenharIcone(c, u, x, y, r, cor, cinza) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
    const ic = this.icone(u.campeao);
    if (ic.ok) { c.drawImage(ic.img, x - r, y - r, r * 2, r * 2); if (cinza) { c.fillStyle = 'rgba(40,40,40,0.55)'; c.fillRect(x - r, y - r, r * 2, r * 2); } }
    else { c.fillStyle = cinza ? '#444' : '#10203d'; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = '#e6edf7'; c.font = `bold ${Math.round(r * 1.1)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText((u.campeao || '?')[0], x, y + r * 0.38); }
    c.restore();
    c.strokeStyle = cor; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  }
  projeteis(P, c, U) {
    for (const p of P.projeteis) { c.fillStyle = p.equipe === 'azul' ? '#9cd0ff' : '#ffb0b0'; c.beginPath(); c.arc(p.x * this.k, p.y * this.k, 3.2 * U, 0, 7); c.fill(); }
  }
  efeitosChao(P, c, U) {
    for (const f of P.fx) {
      const idade = P.t - f.t;
      if (f.k === 'hab' && f.tipo === 'area' && idade < f.atraso + 0.4) {
        const x = f.x * this.k, y = f.y * this.k; const prog = Math.min(1, idade / f.atraso);
        c.strokeStyle = 'rgba(255,210,90,0.85)'; c.fillStyle = `rgba(255,170,60,${0.10 + 0.14 * prog})`; c.lineWidth = 1.5;
        c.beginPath(); c.arc(x, y, f.raio * this.k, 0, 7); c.fill(); c.stroke();
      }
    }
  }
  efeitosAcima(P, c, U) {
    for (const f of P.fx) {
      const idade = P.t - f.t;
      if (f.k === 'ataque' && idade < 0.22 && !f.proj) { const de = P.mapaUnidades.get(f.de), pa = P.mapaUnidades.get(f.para); if (de && pa) { c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(de.x * this.k, de.y * this.k); c.lineTo(pa.x * this.k, pa.y * this.k); c.stroke(); } }
      else if (f.k === 'ataque' && f.proj && idade < 0.3) { const de = f.x0 !== undefined ? { x: f.x0, y: f.y0 } : null, pa = P.mapaUnidades.get(f.para); if (de && pa) { const t = Math.min(1, idade / 0.3); const x = (de.x + (pa.x - de.x) * t) * this.k, y = (de.y + (pa.y - de.y) * t) * this.k; c.fillStyle = f.torre ? '#ffd9a0' : '#fff'; c.beginPath(); c.arc(x, y, (f.torre ? 3.2 : 2.2) * U, 0, 7); c.fill(); } }
      else if (f.k === 'hab' && idade < 0.35 && f.tipo !== 'area') { c.strokeStyle = 'rgba(255,230,140,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(f.x * this.k, f.y * this.k, (6 + idade * 40) * U, 0, 7); c.stroke(); }
      else if (f.k === 'dano' && idade < 0.9 && (f.champ || f.v >= 150)) { c.globalAlpha = 1 - idade / 0.9; c.fillStyle = f.hab ? '#ffd24a' : '#ffffff'; c.font = `bold ${Math.round(10 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText(f.v, f.x * this.k, f.y * this.k - (14 + idade * 26) * U); c.globalAlpha = 1; }
      else if (f.k === 'destruicao' && idade < 1.4) { const x = f.x * this.k, y = f.y * this.k; c.strokeStyle = `rgba(255,200,90,${1 - idade / 1.4})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, (10 + idade * 60) * U, 0, 7); c.stroke(); }
      else if (f.k === 'morte' && idade < 1.2) { const x = f.x * this.k, y = f.y * this.k; c.strokeStyle = `rgba(255,255,255,${1 - idade / 1.2})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, (8 + idade * 40) * U, 0, 7); c.stroke(); }
      else if (f.k === 'renasce' && idade < 1.2) { const x = f.x * this.k, y = f.y * this.k; c.strokeStyle = `rgba(120,255,200,${1 - idade / 1.2})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, (20 - idade * 12) * U, 0, 7); c.stroke(); }
      else if (f.k === 'cura' && idade < 0.7) { const u2 = P.mapaUnidades.get(f.id); if (u2) { c.globalAlpha = 1 - idade / 0.7; c.fillStyle = '#7dffa0'; c.font = `bold ${Math.round(10 * U)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillText('+' + f.v, u2.x * this.k, u2.y * this.k - (14 + idade * 20) * U); c.globalAlpha = 1; } }
    }
  }
  fimDeJogo(P, c) {
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, this.w, this.h);
  }
  // Clique no mapa: devolve o campeão mais próximo (para seguir/destacar).
  campeaoEm(P, px, py) {
    let melhor = null, md = 28 * this.u;
    for (const u of P.campeoes) { const p = this.pos(u); const d = Math.hypot(p.x - px, p.y - py); if (d < md) { md = d; melhor = u; } }
    return melhor;
  }
}
