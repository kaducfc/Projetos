// Junta shared/i18n/src/*.mjs (linhas [pt, en, de, es, it, fr]) nos dicionários
// shared/i18n/<idioma>.js que o site carrega. Rodar depois de editar os textos:
//   node scripts/i18n-build.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = new URL('../shared/i18n/', import.meta.url);
const IDIOMAS = ['en', 'de', 'es', 'it', 'fr'];
const todos = readdirSync(new URL('src/', pasta)).filter((f) => f.endsWith('.mjs')).sort();
// Eventos da Carreira: carreira-eventos.pt.json (índice → português) + blocos
// carreira-eventos-N.mjs com [en, de, es, it, fr] na mesma ordem.
const blocos = todos.filter((f) => /^carreira-eventos-\d+\.mjs$/.test(f));
const arquivos = todos.filter((f) => !blocos.includes(f));
const dic = Object.fromEntries(IDIOMAS.map((i) => [i, {}]));
let problemas = 0;
for (const f of arquivos) {
  const linhas = (await import(new URL(`src/${f}`, pasta))).default;
  for (const l of linhas) {
    if (l.length !== 6 || l.some((x) => typeof x !== 'string' || !x.trim())) { console.error(`${f}: linha inválida`, l[0]); problemas++; continue; }
    const marcas = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    IDIOMAS.forEach((id, i) => {
      if (marcas(l[0]) !== marcas(l[i + 1])) { console.error(`${f}: {valores} diferentes em ${id}:`, l[0]); problemas++; }
      if (l[0] in dic[id] && dic[id][l[0]] !== l[i + 1]) console.warn(`${f}: texto repetido com tradução diferente em ${id}:`, l[0]);
      dic[id][l[0]] = l[i + 1];
    });
  }
}
const ptEventos = JSON.parse(readFileSync(new URL('src/carreira-eventos.pt.json', pasta), 'utf8'));
const traducoes = [];
for (const f of blocos) traducoes.push(...(await import(new URL(`src/${f}`, pasta))).default);
if (traducoes.length !== ptEventos.length) {
  console.error(`eventos da Carreira: ${ptEventos.length} textos em português, ${traducoes.length} traduções (rode scripts/i18n-extrair-carreira.mjs e complete)`);
  problemas++;
}
ptEventos.forEach((pt, i) => {
  const t = traducoes[i];
  if (!t) return;
  const marcas = (x) => (x.match(/\{\w+\}/g) || []).sort().join(',');
  IDIOMAS.forEach((id, k) => {
    if (typeof t[k] !== 'string' || !t[k].trim()) { console.error(`evento ${i} sem ${id}`); problemas++; return; }
    if (marcas(pt) !== marcas(t[k])) { console.error(`evento ${i}: {valores} diferentes em ${id}: ${pt}`); problemas++; }
    dic[id][pt] = t[k];
  });
});
// Na tela, a etiqueta do evento vem com o ícone ("⚡ SINERGIA"): uma linha por evento.
const { EVENTS } = await import('../jogos/carreira-no-rift/js/data/events.js');
for (const e of EVENTS) {
  if (!e.tag) continue;
  for (const id of IDIOMAS) {
    if (!dic[id][e.tag]) continue;
    dic[id][`⚡ ${e.tag}`] = `⚡ ${dic[id][e.tag]}`;
    if (e.icon) dic[id][`${e.icon} ${e.tag}`] = `${e.icon} ${dic[id][e.tag]}`;
  }
}
for (const id of IDIOMAS) {
  const corpo = Object.entries(dic[id]).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
  writeFileSync(fileURLToPath(new URL(`${id}.js`, pasta)), `// Gerado por scripts/i18n-build.mjs a partir de shared/i18n/src/. Não editar à mão.\nexport default {\n${corpo}\n};\n`);
}
console.log(`${Object.keys(dic.en).length} textos em ${IDIOMAS.length} idiomas${problemas ? `, ${problemas} problema(s)` : ''}`);
process.exitCode = problemas ? 1 : 0;
