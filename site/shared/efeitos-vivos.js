// Efeitos de nome que precisam de um "diretor": o CSS faz o desenho, aqui se decide QUANDO e QUAIS letras agem.
// Neon do Submundo: de 1 a 4 letras falham juntas (quantas, conforme o tamanho do nick); quando param, o nome descansa cerca de
// 1 s e outras letras falham. Um só relógio cuida de todos os nomes com o efeito que estiverem na página.

// Quantas letras podem falhar ao mesmo tempo: 1 em nicks de até 5 letras, até 2 de 6 a 8, até 3 de 9 a 12 e até 4 nos maiores.
export const maxFalhas = (n) => (n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4);

// Sorteia as letras desta rodada (índices distintos): entre metade do máximo e o máximo, evitando as da rodada anterior.
export function escolherFalhas(n, anteriores = [], rand = Math.random) {
  if (n <= 0) return [];
  const max = Math.min(maxFalhas(n), n);
  const min = Math.max(1, Math.ceil(max / 2));
  const k = min + Math.floor(rand() * (max - min + 1));
  const livres = [...Array(n).keys()].filter((i) => !anteriores.includes(i));
  const pool = livres.length >= k ? livres : [...Array(n).keys()];
  const out = [];
  while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out.sort((a, b) => a - b);
}

const DESCANSO_MS = 1000; // pausa entre uma rodada de falhas e a seguinte
const estado = new WeakMap(); // nome → { fase, ate, letras }

function passo(agora) {
  for (const el of document.getElementsByClassName('fx-zn-neon')) {
    const letras = el.querySelectorAll(':scope > i');
    if (!letras.length) continue;
    let e = estado.get(el);
    if (!e) { e = { fase: 'descanso', ate: agora + 600 + Math.random() * 1200, idx: [] }; estado.set(el, e); }
    if (agora < e.ate) continue;
    if (e.fase === 'descanso') {
      const idx = escolherFalhas(letras.length, e.idx);
      let fim = 0;
      for (const i of idx) {
        const l = letras[i];
        const dur = (2.1 + (parseFloat(l.style.getPropertyValue('--r')) || Math.random()) * 1.1) * 1000;
        fim = Math.max(fim, dur);
        l.classList.add('falha');
      }
      e.fase = 'falha'; e.idx = idx; e.ate = agora + fim + 80;
    } else {
      for (const l of letras) l.classList.remove('falha');
      e.fase = 'descanso'; e.ate = agora + DESCANSO_MS + Math.random() * 250;
    }
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  setInterval(() => { if (!document.hidden) passo(performance.now()); }, 250);
}
