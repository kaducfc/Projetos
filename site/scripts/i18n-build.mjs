// Junta shared/i18n/src/*.mjs (linhas [pt, en, de, es, it, fr]) nos dicionários
// shared/i18n/<idioma>.js que o site carrega. Rodar depois de editar os textos:
//   node scripts/i18n-build.mjs
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = new URL('../shared/i18n/', import.meta.url);
const IDIOMAS = ['en', 'de', 'es', 'it', 'fr'];
const arquivos = readdirSync(new URL('src/', pasta)).filter((f) => f.endsWith('.mjs')).sort();
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
for (const id of IDIOMAS) {
  const corpo = Object.entries(dic[id]).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
  writeFileSync(fileURLToPath(new URL(`${id}.js`, pasta)), `// Gerado por scripts/i18n-build.mjs a partir de shared/i18n/src/. Não editar à mão.\nexport default {\n${corpo}\n};\n`);
}
console.log(`${Object.keys(dic.en).length} textos em ${IDIOMAS.length} idiomas${problemas ? `, ${problemas} problema(s)` : ''}`);
process.exitCode = problemas ? 1 : 0;
