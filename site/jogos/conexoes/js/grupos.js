// Biblioteca de grupos: os escritos à mão (curados.js) + os que saem da tabela de campeões (campeoes.js).
import { CAMPEOES } from './campeoes.js';
import { CURADOS } from './curados.js';

// Texto sem acento e em minúsculas: chave para comparar palavras ("Águas" = "aguas").
export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const letras = (nome) => nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length;

const REGIOES = ['Demacia', 'Noxus', 'Ionia', 'Freljord', 'Piltover', 'Zaun', 'Shurima', 'Targon', 'Águas de Sentina', 'Ilhas das Sombras', 'Bandópolis', 'Vazio', 'Ixtal'];
const ROTAS = { Topo: 'jogam no Topo', Selva: 'jogam na Selva', Meio: 'jogam no Meio', Atirador: 'jogam de Atirador (ADC)', Suporte: 'jogam de Suporte' };
const CLASSES = ['Mago', 'Assassino', 'Atirador', 'Lutador', 'Tanque', 'Suporte'];

// Grupos de campeões (família 'regiao', 'rota', 'classe', 'letra' ou 'nome': um quebra-cabeça usa no máximo um de cada).
function deCampeoes() {
  const g = [];
  const nomes = (f) => CAMPEOES.filter(f).map((c) => c.nome);
  for (const r of REGIOES) {
    const p = nomes((c) => c.regiao === r);
    if (p.length >= 5) g.push({ dif: r === 'Ixtal' || r === 'Bandópolis' ? 2 : 1, fam: 'regiao', tit: `Campeões de ${r}`, p });
  }
  g.push({ dif: 2, fam: 'regiao', tit: 'Yordles', p: nomes((c) => c.yordle) });
  g.push({ dif: 3, fam: 'regiao', tit: 'Vastaya', p: nomes((c) => c.vastaya) });
  g.push({ dif: 4, fam: 'regiao', tit: 'Darkin', p: nomes((c) => c.darkin) });
  for (const [rota, texto] of Object.entries(ROTAS)) g.push({ dif: 1, fam: 'rota', tit: `Campeões que ${texto}`, p: nomes((c) => c.rota === rota) });
  for (const k of CLASSES) g.push({ dif: 2, fam: 'classe', tit: `Campeões da classe ${k}`, p: nomes((c) => c.classe === k) });
  const porLetra = {};
  for (const c of CAMPEOES) (porLetra[norm(c.nome)[0].toUpperCase()] ||= []).push(c.nome);
  for (const [l, p] of Object.entries(porLetra)) if (p.length >= 5) g.push({ dif: 3, fam: 'letra', tit: `Campeões que começam com ${l}`, p });
  g.push({ dif: 3, fam: 'nome', tit: 'Nomes curtos (até 3 letras)', p: nomes((c) => letras(c.nome) <= 3) });
  g.push({ dif: 3, fam: 'nome', tit: 'Nomes longos (10 letras ou mais)', p: nomes((c) => letras(c.nome) >= 10) });
  g.push({ dif: 3, fam: 'nome', tit: 'Campeões com apóstrofo no nome', p: nomes((c) => c.nome.includes("'")) });
  g.push({ dif: 3, fam: 'nome', tit: 'Campeões com nome composto', p: nomes((c) => /\s/.test(c.nome)) });
  return g;
}

// Famílias cujas palavras são nomes de campeões (um quebra-cabeça tem no máximo duas delas).
// As famílias 'membro' (K/DA, True Damage) também usam nomes de campeões.
export const FAMILIAS_CAMPEAO = new Set(['regiao', 'rota', 'classe', 'letra', 'nome', 'membro',
  'arcaneC', 'morto', 'alados', 'irmaos', 'forma', 'ultGlobal', 'invoca', 'armaFogo', 'lanca', 'segundaVida', 'escudoAliado', 'curaAliado', 'furtivos', 'pentakill', 'heartsteel']);

export const GRUPOS = [...deCampeoes(), ...CURADOS].map((g, i) => ({ ...g, id: i, chaves: new Set(g.p.map(norm)) }));
