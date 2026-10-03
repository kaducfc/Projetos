// Animação do resultado de uma escolha: a barra de chance "pisca" entre o
// lado verde (deu certo) e o vermelho (deu errado), desacelerando como uma
// roleta, e para no resultado. São 3 variações, todas entre 2 e 3 segundos.

// Tempo (ms) que cada lado fica aceso, em ordem. O último é o resultado.
const PATTERNS = [
  // Roleta: começa rápido e vai freando.
  [90, 90, 100, 110, 130, 150, 180, 220, 280, 360],
  // Mais calma: poucas trocas, cada vez mais longas.
  [170, 190, 220, 260, 320, 400, 480],
  // Nervosa: muitas trocas rápidas e um "quase" no fim.
  [70, 70, 70, 80, 80, 90, 100, 110, 130, 160, 200, 420, 300],
];
const HOLD = 450; // o resultado fica aceso um pouco antes de mostrar o texto

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

export async function rollChoice(button, ok) {
  const odds = button?.querySelector('.odds');
  if (!odds) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const list = button.closest('.choices');
  list?.classList.add('rolling');
  button.classList.add('rolling-pick');
  odds.classList.add('rolling');

  const steps = reduced ? [300] : PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  // Alterna os lados de forma que o último aceso seja o resultado.
  const last = ok ? 'ok' : 'bad';
  const other = ok ? 'bad' : 'ok';
  for (let i = 0; i < steps.length; i++) {
    const side = (steps.length - 1 - i) % 2 === 0 ? last : other;
    odds.dataset.lit = side;
    await wait(steps[i]);
  }
  odds.dataset.lit = last;
  odds.classList.add('settled');
  await wait(reduced ? 150 : HOLD);
}
