// Ícones dos campeões: Data Dragon (CDN oficial da Riot, uso permitido a projetos de fã), como no jogo Campeão.
// O nome do arquivo de cada ícone vem da tabela do jogo Campeão (mesmos nomes); sem rede, aparece a inicial.
const DDRAGON = 'https://ddragon.leagueoflegends.com';
let versao = null;
const arquivo = new Map(); // nome do campeão -> nome do arquivo no Data Dragon

async function lerVersao() {
  try {
    const c = JSON.parse(globalThis.localStorage?.getItem('campeao.ddragon') || 'null'); // mesma chave do jogo Campeão
    if (c && Date.now() - c.at < 864e5) return c.v;
  } catch { /* sem storage */ }
  try {
    const v = (await (await fetch(`${DDRAGON}/api/versions.json`)).json())[0];
    try { localStorage.setItem('campeao.ddragon', JSON.stringify({ v, at: Date.now() })); } catch { /* sem storage */ }
    return v;
  } catch { return null; }
}

export async function prepararImagens() {
  if (versao && arquivo.size) return;
  try {
    const [v, d] = await Promise.all([lerVersao(), fetch('../campeao/dados/campeoes.json').then((r) => r.json())]);
    versao = v;
    d.campeoes.forEach((c) => arquivo.set(c.nome, c.img));
  } catch { /* fica com a inicial */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const campUrl = (nome) => (versao && arquivo.has(nome) ? `${DDRAGON}/cdn/${versao}/img/champion/${encodeURIComponent(arquivo.get(nome))}.png` : '');
// Quadrado com o ícone (ou a inicial, se a imagem não carregar).
export function campIcone(nome, tam = 44) {
  const u = campUrl(nome);
  const ini = esc((nome || '?')[0]);
  return `<span class="tc-ci" style="--t:${tam}px"><span class="ini">${ini}</span>${u ? `<img src="${u}" alt="" loading="lazy" width="${tam}" height="${tam}" />` : ''}</span>`;
}
// Imagem que falha (sem rede ou campeão novo demais) some e deixa a inicial à mostra.
if (typeof document !== 'undefined') document.addEventListener('error', (e) => { if (e.target?.tagName === 'IMG' && e.target.closest('.tc-ci')) e.target.remove(); }, true);
