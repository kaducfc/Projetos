// Efeitos sonoros do picks e bans (sintetizados, sem arquivos). Respeitam a mesma preferência de som do resto do jogo ('tc.som').
let ctx = null;
export const somLigado = () => { try { return localStorage.getItem('tc.som') !== '0'; } catch { return true; } };
export function definirSom(ligado) { try { localStorage.setItem('tc.som', ligado ? '1' : '0'); } catch { /* sem storage: vale só nesta sessão */ } }
const audio = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; } };
function ruido(ac, dur) {
  const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b; return s;
}

export function somDraft(tipo) {
  if (!somLigado()) return;
  const ac = audio(); if (!ac) return; const t = ac.currentTime;
  const saida = (v, ini, fim) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, ini); g.gain.exponentialRampToValueAtTime(v, ini + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, fim); g.connect(ac.destination); return g; };
  const nota = (tipoOnda, f0, f1, ini, dur, v) => { const o = ac.createOscillator(); o.type = tipoOnda; o.frequency.setValueAtTime(f0, ini); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, ini + dur); o.connect(saida(v, ini, ini + dur)); o.start(ini); o.stop(ini + dur + 0.05); };
  const sopro = (filtro, freq, ini, dur, v) => { const n = ruido(ac, dur); const f = ac.createBiquadFilter(); f.type = filtro; f.frequency.value = freq; n.connect(f); f.connect(saida(v, ini, ini + dur)); n.start(ini); };
  if (tipo === 'ban') { // golpe grave que "nega": batida surda, estalo metálico e um tom que desaba
    nota('sine', 150, 38, t, 0.45, 0.4);
    nota('sawtooth', 320, 70, t, 0.42, 0.1);
    sopro('bandpass', 1800, t, 0.18, 0.16);
    nota('square', 110, 80, t + 0.08, 0.3, 0.05);
  } else if (tipo === 'pick') { // "trava" brilhante: clique, duas notas que sobem e um brilho agudo
    sopro('highpass', 4000, t, 0.05, 0.12);
    nota('triangle', 523, 523, t, 0.28, 0.12); nota('triangle', 784, 784, t + 0.08, 0.34, 0.12); nota('triangle', 1047, 1047, t + 0.16, 0.5, 0.09);
    nota('sine', 2093, 2093, t + 0.16, 0.6, 0.035);
  } else if (tipo === 'vez') { // sua vez: sino suave de duas notas
    nota('sine', 659, 659, t, 0.45, 0.1); nota('sine', 988, 988, t + 0.12, 0.6, 0.1); nota('sine', 1976, 1976, t + 0.12, 0.5, 0.02);
  } else if (tipo === 'tic') { nota('sine', 880, 880, t, 0.09, 0.08);
  } else if (tipo === 'tic-urgente') { nota('square', 1180, 1180, t, 0.1, 0.05); nota('sine', 590, 590, t, 0.12, 0.07);
  } else if (tipo === 'clique') { nota('sine', 700, 520, t, 0.05, 0.05);
  } else if (tipo === 'inicio') { // abertura do draft: varredura que sobe e acorde
    sopro('bandpass', 600, t, 0.5, 0.07);
    [196, 294, 392].forEach((f, i) => nota('sawtooth', f, f * 1.01, t + i * 0.05, 0.9, 0.045));
    nota('sine', 98, 49, t, 0.6, 0.25);
  } else if (tipo === 'fim') { // draft completo: arpejo de fanfarra
    [392, 494, 587, 784].forEach((f, i) => { nota('triangle', f, f, t + i * 0.11, 0.7, 0.1); nota('sine', f * 2, f * 2, t + i * 0.11, 0.7, 0.03); });
  }
}
