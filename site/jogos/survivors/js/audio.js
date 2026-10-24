// Rift Survivors: efeitos sonoros sintetizados (WebAudio, sem arquivos).
let ctx = null; let mudo = false; const ultimo = {};
const LIMITE = { tiro: 70, orbe: 120, flecha: 120, shuriken: 120, zona: 200, gema: 45, ouro: 60, morte: 50, dano: 120, cuspe: 300 };
export function definirMudo(v) { mudo = v; }
export const estaMudo = () => mudo;
function ac() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}
export function destravar() { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
function tom(freq, dur, tipo = 'square', vol = 0.05, desliza = 0, atraso = 0) {
  const c = ac(); if (!c || mudo) return;
  const t = c.currentTime + atraso; const o = c.createOscillator(); const g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t); if (desliza) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + desliza), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function ruido(dur, vol = 0.05, filtro = 1800) {
  const c = ac(); if (!c || mudo) return;
  const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filtro; const g = c.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination); s.start();
}
export function som(tipo) {
  const agora = performance.now(); if (LIMITE[tipo] && agora - (ultimo[tipo] || 0) < LIMITE[tipo]) return; ultimo[tipo] = agora;
  switch (tipo) {
    case 'tiro': tom(620, 0.05, 'square', 0.025, -300); break;
    case 'orbe': tom(300, 0.18, 'triangle', 0.05, 380); break;
    case 'flecha': tom(900, 0.1, 'sawtooth', 0.025, -500); break;
    case 'shuriken': tom(520, 0.09, 'square', 0.03, 260); break;
    case 'zona': tom(200, 0.3, 'sine', 0.06, 260); break;
    case 'morte': ruido(0.07, 0.035, 1400); break;
    case 'gema': tom(880 + Math.random() * 240, 0.05, 'triangle', 0.03); break;
    case 'ouro': tom(1320, 0.06, 'square', 0.025); tom(1760, 0.08, 'square', 0.025, 0, 0.05); break;
    case 'dano': tom(140, 0.18, 'sawtooth', 0.07, -80); ruido(0.12, 0.05, 900); break;
    case 'nivel': [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.14, 'square', 0.05, 0, i * 0.07)); break;
    case 'escolha': tom(660, 0.08, 'square', 0.05); tom(990, 0.12, 'square', 0.05, 0, 0.07); break;
    case 'cura': [523, 784].forEach((f, i) => tom(f, 0.15, 'triangle', 0.06, 0, i * 0.08)); break;
    case 'ima': tom(300, 0.4, 'sine', 0.07, 700); break;
    case 'bau': [392, 523, 659, 784, 1046].forEach((f, i) => tom(f, 0.12, 'square', 0.05, 0, i * 0.06)); break;
    case 'chefe': tom(110, 0.9, 'sawtooth', 0.09, -50); ruido(0.7, 0.07, 500); break;
    case 'onda': tom(180, 0.5, 'square', 0.06, 120); tom(240, 0.5, 'square', 0.05, 120, 0.15); break;
    case 'cuspe': tom(160, 0.25, 'sawtooth', 0.05, 160); break;
    case 'revive': [330, 440, 660, 880].forEach((f, i) => tom(f, 0.2, 'triangle', 0.07, 0, i * 0.09)); break;
    case 'vitoria': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tom(f, 0.2, 'square', 0.06, 0, i * 0.12)); break;
    case 'derrota': [392, 330, 262, 196].forEach((f, i) => tom(f, 0.3, 'sawtooth', 0.06, -20, i * 0.18)); break;
    case 'clique': tom(500, 0.05, 'square', 0.04); break;
    default: break;
  }
}
// Evento da simulação -> som.
export const SOM_EVENTO = { tiro: 'tiro', orbe: 'orbe', flecha: 'flecha', shuriken: 'shuriken', zona: 'zona', morte: 'morte', gema: 'gema', ouro: 'ouro', dano: 'dano', nivel: 'nivel', cura: 'cura', ima: 'ima', bau: 'bau', chefe: 'chefe', onda: 'onda', cuspe: 'cuspe', revive: 'revive', vitoria: 'vitoria', derrota: 'derrota' };
