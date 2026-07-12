#!/usr/bin/env node
// Bundles the no-build-step ES-module source into a single self-contained
// HTML file for Artifact publishing: strips import/export, concatenates
// modules in dependency order, inlines CSS, and base64-inlines any real
// image assets referenced by path in the JS (see assets/chispim/).
//
// Usage: node build-bundle.mjs > /tmp/idle-hunter-bundle.html

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MODULE_ORDER = [
  'js/version.js',
  'js/data/monsters.js',
  'js/data/elements.js',
  'js/data/items.js',
  'js/data/upgrades.js',
  'js/data/events.js',
  'js/data/achievements.js',
  'js/data/shop.js',
  'js/data/cards.js',
  'js/format.js',
  'js/state.js',
  'js/systems/stats.js',
  'js/systems/combat.js',
  'js/systems/equipment.js',
  'js/systems/crafting.js',
  'js/systems/upgrades.js',
  'js/systems/offline.js',
  'js/systems/events.js',
  'js/systems/achievements.js',
  'js/systems/shop.js',
  'js/ui/monsterAnim.js',
  'js/ui/render.js',
  'js/main.js',
];

function stripModuleSyntax(src, relPath) {
  return src
    // multi-line `import { ... } from '...';`
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+.*?from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
    .trim()
    .concat(`\n// ---- end ${relPath} ----\n`);
}

let jsBundle = MODULE_ORDER.map((rel) => {
  const src = readFileSync(path.join(ROOT, rel), 'utf8');
  return `\n// ---- ${rel} ----\n` + stripModuleSyntax(src, rel);
}).join('\n');

// Inline every asset path literal ('assets/...') referenced in the JS as a
// base64 data URI, so the published artifact has no external file deps.
const assetRefs = new Set([...jsBundle.matchAll(/['"](assets\/[^'"]+\.(?:png|jpe?g|webp))['"]/g)].map((m) => m[1]));
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
for (const rel of assetRefs) {
  const ext = rel.split('.').pop().toLowerCase();
  const data = readFileSync(path.join(ROOT, rel));
  const dataUri = `data:${MIME[ext]};base64,${data.toString('base64')}`;
  jsBundle = jsBundle.split(`'${rel}'`).join(`'${dataUri}'`);
}

const css = readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="css\/style\.css" \/>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main\.js"><\/script>/, `<script type="module">\n${jsBundle}\n</script>`);

process.stdout.write(html);
