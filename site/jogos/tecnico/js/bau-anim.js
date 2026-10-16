// Abertura de baú em tela cheia: carga com tremida, explosão de luz, cartas que saem do baú e viram uma a uma.
// O sorteio já vem do servidor (a promessa `resultado`); aqui é só apresentação.
const COR = { basico: [74, 163, 255], premium: [255, 196, 70] };
const COR_RAR = { comum: [163, 163, 184], raro: [96, 165, 250], epico: [192, 132, 252], lendario: [245, 207, 90], mitico: [251, 113, 133] };
const NOME_BAU = { basico: 'Baú Básico', premium: 'Baú Premium' };
const ORDEM = ['comum', 'raro', 'epico', 'lendario', 'mitico'];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ sons (sintetizados, sem arquivos)
let ctxAudio = null;
const somLigado = () => { try { return localStorage.getItem('tc.som') !== '0'; } catch { return true; } };
const audio = () => { try { ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)(); if (ctxAudio.state === 'suspended') ctxAudio.resume(); return ctxAudio; } catch { return null; } };
function ruido(ac, dur) {
  const b = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b; return s;
}
function som(tipo, arg) {
  if (!somLigado()) return;
  const ac = audio(); if (!ac) return; const t = ac.currentTime;
  const ganho = (v, ini, fim) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, ini); g.gain.exponentialRampToValueAtTime(v, ini + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, fim); g.connect(ac.destination); return g; };
  if (tipo === 'carga') { // rumor grave que sobe
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(42, t); o.frequency.exponentialRampToValueAtTime(120, t + 1.9);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(160, t); f.frequency.exponentialRampToValueAtTime(900, t + 1.9);
    o.connect(f); f.connect(ganho(0.12, t, t + 2)); o.start(t); o.stop(t + 2);
  } else if (tipo === 'explosao') {
    const o = ac.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.6); o.connect(ganho(0.35, t, t + 0.7)); o.start(t); o.stop(t + 0.7);
    const n = ruido(ac, 0.8); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; n.connect(f); f.connect(ganho(0.14, t, t + 0.8)); n.start(t);
  } else if (tipo === 'carta') { // brilho que sobe de tom conforme a raridade
    const base = [440, 523, 659, 784, 988][arg] || 440;
    [1, 1.25, 1.5, 2].slice(0, 2 + Math.min(arg, 2)).forEach((m, i) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = base * m; o.connect(ganho(0.07, t + i * 0.07, t + 0.7 + i * 0.07)); o.start(t + i * 0.07); o.stop(t + 0.9 + i * 0.07); });
  } else if (tipo === 'whoosh') {
    const n = ruido(ac, 0.5); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); n.connect(f); f.connect(ganho(0.08, t, t + 0.45)); n.start(t);
  }
}

// ------------------------------------------------------------------ partículas
class Fx {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.p = []; this.vivo = true; this.ajustar(); this.laco = this.laco.bind(this); this.ult = performance.now(); requestAnimationFrame(this.laco); }
  ajustar() { const r = this.c.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); this.c.width = Math.max(1, r.width * d); this.c.height = Math.max(1, r.height * d); this.d = d; }
  emitir(n, ox, oy, o = {}) {
    for (let i = 0; i < n; i++) {
      const ang = (o.ang ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.abre ?? 1.2); const v = (o.vel ?? 520) * (0.35 + Math.random() * 0.8);
      this.p.push({ x: ox + (Math.random() - 0.5) * (o.larg ?? 60), y: oy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: o.g ?? 520, vida: 0, dur: (o.dur ?? 1.3) * (0.6 + Math.random() * 0.7), r: (o.r ?? 3) * (0.5 + Math.random()), cor: o.cor || [255, 255, 255] });
    }
  }
  laco(ts) {
    if (!this.vivo) return;
    const dt = Math.min(0.05, (ts - this.ult) / 1000); this.ult = ts;
    const { x, c, d } = this; x.clearRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'lighter';
    this.p = this.p.filter((q) => (q.vida += dt) < q.dur);
    for (const q of this.p) {
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.995;
      const a = 1 - q.vida / q.dur; const rad = q.r * d * (0.6 + a * 0.6);
      const gr = x.createRadialGradient(q.x * d, q.y * d, 0, q.x * d, q.y * d, rad * 3);
      gr.addColorStop(0, rgba(q.cor, a)); gr.addColorStop(0.35, rgba(q.cor, a * 0.45)); gr.addColorStop(1, rgba(q.cor, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(q.x * d, q.y * d, rad * 3, 0, 7); x.fill();
    }
    requestAnimationFrame(this.laco);
  }
  parar() { this.vivo = false; }
}

// ------------------------------------------------------------------ cena
// opc: { bau: 'basico'|'premium', qtd, resultado: Promise<{itens}|null>, renderCarta(item) => html, titulo(itens) => string }
export function abrirBau(opc) {
  return new Promise((fim) => {
    const cor = COR[opc.bau] || COR.basico;
    const d = document.createElement('div');
    d.className = `bx-stage bau-${opc.bau}`; d.style.setProperty('--bx', cor.join(','));
    d.innerHTML = `<div class="bx-bg"></div><div class="bx-rays"></div><div class="bx-glow"></div>
      <div class="bx-chest-wrap"><div class="bx-charge"><i></i><i></i><i></i></div>
        <div class="bx-chest"><img class="fechado" alt="" src="img/baus/${opc.bau}-fechado.webp" /><img class="aberto" alt="" src="img/baus/${opc.bau}-aberto.webp" /></div>
        <div class="bx-beam"></div><div class="bx-ring"></div><div class="bx-ring r2"></div></div>
      <canvas class="bx-fx"></canvas><div class="bx-flash"></div>
      <div class="bx-topo"><h2>${NOME_BAU[opc.bau] || 'Baú'}</h2><p class="bx-sub">Abrindo…</p></div>
      <div class="bx-cartas n${opc.qtd}"></div>
      <div class="bx-rodape"><button type="button" class="bx-btn" data-a="pular">Pular animação</button><button type="button" class="bx-btn ouro" data-a="fechar" hidden>Fechar</button></div>
      <button type="button" class="bx-som" aria-label="Som" title="Som"></button>`;
    document.body.appendChild(d); document.body.style.overflow = 'hidden';
    const $ = (s) => d.querySelector(s);
    const fx = new Fx($('.bx-fx'));
    const onResize = () => fx.ajustar(); window.addEventListener('resize', onResize);
    let pular = false, aberto = false, fechado = false;
    const espera = (ms) => (pular ? Promise.resolve() : dorme(ms));
    const sub = (t) => { $('.bx-sub').textContent = t; };
    const marcarSom = () => { $('.bx-som').textContent = somLigado() ? '🔊' : '🔇'; }; marcarSom();
    $('.bx-som').onclick = () => { try { localStorage.setItem('tc.som', somLigado() ? '0' : '1'); } catch { /* sem storage */ } marcarSom(); };
    const fechar = () => {
      if (fechado) return; fechado = true; fx.parar(); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', tecla);
      d.classList.add('saindo'); document.body.style.overflow = '';
      setTimeout(() => { d.remove(); fim(); }, 280);
    };
    const tecla = (e) => { if (e.key === 'Escape' && aberto) fechar(); }; document.addEventListener('keydown', tecla);
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'pular') pular = true;
      if (b.dataset.a === 'fechar') fechar();
    });
    const centro = () => { const r = $('.bx-chest').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.38, w: r.width, base: r.bottom }; };
    const tremer = (n) => { const c = $('.bx-chest'); c.classList.remove('s1', 's2', 's3'); if (n) { void c.offsetWidth; c.classList.add(`s${n}`); } };

    (async () => {
      const t0 = performance.now();
      d.classList.add('entra'); som('carga');
      tremer(1); await dorme(750); tremer(2); d.classList.add('carga2'); await dorme(750); tremer(3); d.classList.add('carga3');
      // faíscas de energia sobem durante a carga
      const energia = setInterval(() => { const c = centro(); fx.emitir(3, c.x, c.base - 8, { vel: 160, abre: 2.6, g: -40, dur: 1, r: 2, cor, larg: c.w * 0.8 }); }, 90);
      const r = await opc.resultado;
      clearInterval(energia);
      if (!r || r === true || !r.itens) { fx.parar(); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', tecla); document.body.style.overflow = ''; d.remove(); fim(); return; }
      const itens = r.itens;
      const melhor = itens.reduce((m, i) => Math.max(m, ORDEM.indexOf(i.raridade)), 0);
      if (performance.now() - t0 < 1900) await dorme(1900 - (performance.now() - t0));
      // --- explosão
      tremer(0); som('explosao');
      d.classList.add('explode'); const c = centro();
      const corM = COR_RAR[ORDEM[melhor]] || cor;
      d.style.setProperty('--rc', (melhor >= 3 ? corM : cor).join(','));
      fx.emitir(140, c.x, c.y, { vel: 900, abre: 1.5, g: 700, dur: 1.6, r: 3.2, cor, larg: c.w * 0.5 });
      fx.emitir(60, c.x, c.y, { vel: 600, abre: 3.2, g: 300, dur: 1.2, r: 2.2, cor: [255, 255, 255], larg: c.w * 0.4 });
      if (melhor >= 3) fx.emitir(110, c.x, c.y, { vel: 1100, abre: 1.9, g: 800, dur: 1.9, r: 3.6, cor: corM, larg: c.w * 0.5 });
      aberto = true;
      await espera(850);
      // --- cartas saem do baú
      sub(opc.titulo ? opc.titulo(itens) : '');
      const box = $('.bx-cartas');
      box.innerHTML = itens.map((it, i) => `<div class="bx-card r-${it.raridade}" style="--rc:${(COR_RAR[it.raridade] || cor).join(',')}"><div class="in"><div class="costas"><span>◆</span></div><div class="frente">${opc.renderCarta(it)}</div></div></div>`).join('');
      const cartas = [...box.children];
      cartas.forEach((el, i) => {
        const rc = el.getBoundingClientRect();
        el.style.setProperty('--dx', `${Math.round(c.x - (rc.left + rc.width / 2))}px`); el.style.setProperty('--dy', `${Math.round(c.y - (rc.top + rc.height / 2))}px`);
        el.style.animationDelay = `${i * 0.14}s`; el.classList.add('sobe');
      });
      som('whoosh');
      await espera(700 + itens.length * 140);
      // --- revela uma a uma (ou ao clicar na carta)
      const virar = (el, i) => {
        if (el.classList.contains('vira')) return;
        el.classList.add('vira'); const it = itens[i]; const ri = ORDEM.indexOf(it.raridade); const cc = COR_RAR[it.raridade] || cor;
        som('carta', ri);
        const rr = el.getBoundingClientRect();
        fx.emitir(18 + ri * 14, rr.left + rr.width / 2, rr.top + rr.height / 2, { vel: 260 + ri * 90, abre: 6.3, g: 120, dur: 0.9 + ri * 0.2, r: 2.4, cor: cc, larg: rr.width * 0.7, ang: 0 });
        if (ri >= 3) { d.classList.remove('pulso'); void d.offsetWidth; d.classList.add('pulso'); d.style.setProperty('--rc', cc.join(',')); }
      };
      cartas.forEach((el, i) => el.addEventListener('click', () => virar(el, i)));
      sub('Toque nas cartas para revelar');
      for (let i = 0; i < cartas.length; i++) { await espera(i === 0 ? 350 : 520); virar(cartas[i], i); }
      await espera(600);
      sub(opc.final ? opc.final(itens, r) : '');
      $('[data-a=pular]').hidden = true; const bf = $('[data-a=fechar]'); bf.hidden = false; bf.focus();
    })();
  });
}
