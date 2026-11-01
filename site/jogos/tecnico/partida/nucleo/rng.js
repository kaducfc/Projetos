// Gerador pseudoaleatório com semente (mulberry32): a mesma semente reproduz a mesma partida.
export function criarRng(semente) {
  let s = (typeof semente === 'string' ? hashTexto(semente) : (semente >>> 0)) || 1;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.entre = (a, b) => a + (b - a) * f();
  f.inteiro = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.escolher = (lista) => lista[Math.floor(f() * lista.length)];
  f.chance = (p) => f() < p;
  f.estado = () => s;
  return f;
}
export function hashTexto(txt) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
