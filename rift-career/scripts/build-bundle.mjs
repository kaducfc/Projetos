// Empacota o jogo num único HTML autocontido (CSS + todos os módulos JS),
// útil para publicar como Artifact ou mandar o arquivo para alguém.
// Uso: node scripts/build-bundle.mjs > bundle.html
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const order = [];
const seen = new Set();

// Ordena os módulos por dependência (dependências primeiro).
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s*\{[^}]*\}\s*from\s*'([^']+)'/g)) visit(join(dirname(file), m[1]));
  order.push({ file, src });
}
visit(join(root, 'js/main.js'));

const key = (file) => file.slice(root.length + 1);
const modules = order.map(({ file, src }) => {
  const exported = [];
  let body = src.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/g, (_, names, from) => {
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean)
      .map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __m['${key(join(dirname(file), from))}'];`;
  });
  body = body.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  return `// ---- ${key(file)}\n(() => {\n${body}\n__m['${key(file)}'] = { ${exported.join(', ')} };\n})();`;
});

const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="css\/style.css" \/>/, `<style>\n${css}\n</style>`);

process.stdout.write(`${head.trim()}
<div id="app"></div>
<script>
const __m = {};
${modules.join('\n')}
</script>
`);
