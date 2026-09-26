// Empacota o jogo num único HTML autocontido (CSS + todos os módulos JS),
// útil para publicar como Artifact ou mandar o arquivo para alguém.
// Uso: node scripts/build-bundle.mjs [--logos=oficiais|escudos] > bundle.html
// As imagens dos times e troféus (shared/assets/times, emblemas e trofeus) vão embutidas no arquivo.
// --logos troca o modo de TEAM_LOGOS só nesta versão (útil para testar as logos).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = resolve(root, '../../shared/assets');
const logosMode = process.argv.find((a) => a.startsWith('--logos='))?.slice('--logos='.length);
const order = [];
const seen = new Set();

// Ordena os módulos por dependência (dependências primeiro).
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s*(?:\{[^}]*\}|\*\s*as\s+\w+)\s*from\s*'([^']+)'/g)) visit(join(dirname(file), m[1]));
  order.push({ file, src });
}
visit(join(root, 'js/main.js'));

const key = (file) => relative(root, file);
const modules = order.map(({ file, src }) => {
  const exported = [];
  let body = src;
  if (logosMode && key(file).endsWith('shared/config.js')) {
    body = body.replace(/export const TEAM_LOGOS = '[^']*'/, `export const TEAM_LOGOS = '${logosMode}'`);
  }
  body = body.replace(/import\s*\*\s*as\s+(\w+)\s*from\s*'([^']+)';?/g, (_, name, from) => `const ${name} = __m['${key(join(dirname(file), from))}'];`);
  body = body.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/g, (_, names, from) => {
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean)
      .map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __m['${key(join(dirname(file), from))}'];`;
  });
  body = body.replace(/^export\s+((?:async\s+)?(?:const|let|function|class))\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  return `// ---- ${key(file)}\n(() => {\n${body}\n__m['${key(file)}'] = { ${exported.join(', ')} };\n})();`;
});

const html = readFileSync(join(root, 'index.html'), 'utf8');
// Todos os <link rel="stylesheet"> locais viram <style> embutido.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="((?!https?:)[^"]+)" \/>/g, (_, href) => `<style>\n${readFileSync(join(root, href), 'utf8')}\n</style>`);
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script type="module"[^>]*><\/script>\s*/, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>\s*/, '');

const logoData = {};
for (const dir of ['times', 'emblemas', 'trofeus']) {
  const d = join(assetsDir, dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((x) => x.endsWith('.png'))) {
    logoData[`${dir}/${f}`] = `data:image/png;base64,${readFileSync(join(d, f)).toString('base64')}`;
  }
}

// O arquivo único não alcança o servidor do site: roda em modo visitante.
process.stdout.write(`${head.trim()}
${body.trim()}
<script>
window.__SITE_OFFLINE = true;
window.__TEAM_LOGO_DATA = ${JSON.stringify(logoData)};
const __m = {};
${modules.join('\n')}
</script>
`);
