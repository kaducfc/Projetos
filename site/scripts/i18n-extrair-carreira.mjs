// Lista os textos em português dos eventos da Carreira (data/events.js) na ordem
// em que aparecem, para traduzir. Grava shared/i18n/src/carreira-eventos.pt.json
// (índice → texto). As traduções ficam em shared/i18n/src/carreira-eventos-*.mjs,
// um array de [en, de, es, it, fr] na mesma ordem. Rodar de novo só quando os
// textos dos eventos mudarem: os que mudarem aparecem como "sem tradução" no teste.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENTS } from '../jogos/carreira-no-rift/js/data/events.js';

const vistos = new Map();
const add = (v) => {
  if (typeof v === 'string') { if (v.trim() && !vistos.has(v)) vistos.set(v, vistos.size); }
  else if (v && typeof v === 'object') Object.values(v).forEach(add);
};
for (const e of EVENTS) {
  add(e.tag); add(e.title); add(e.text);
  for (const c of e.choices) {
    add(c.label); add(c.good); add(c.bad);
    add(c.ok?.text); add(c.fail?.text);
  }
}
const lista = [...vistos.keys()];
writeFileSync(fileURLToPath(new URL('../shared/i18n/src/carreira-eventos.pt.json', import.meta.url)), JSON.stringify(lista, null, 0));
console.log(`${EVENTS.length} eventos, ${lista.length} textos`);
