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
  'js/systems/leveling.js',
  'js/systems/stats.js',
  'js/systems/cards.js',
  'js/systems/combat.js',
  'js/systems/tower.js',
  'js/systems/goldmine.js',
  'js/systems/equipment.js',
  'js/systems/crafting.js',
  'js/systems/upgrades.js',
  'js/systems/offline.js',
  'js/systems/events.js',
  'js/systems/achievements.js',
  'js/systems/shop.js',
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

let css = readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Inline every asset path literal referenced in the JS, the static HTML
// (e.g. the bottom-nav <img src="assets/ui/nav/...">), or the CSS itself
// (e.g. a `background: url('../assets/...')` rule) as a base64 data URI, so
// the published artifact has no external file deps. CSS references are
// written relative to css/style.css (so '../assets/...'), everything else
// relative to the repo root ('assets/...') — the regex captures either
// prefix, and the leading '../' (if present) is stripped again before
// resolving against ROOT below.
const ASSET_RE = /['"](\.\.\/)?(assets\/[^'"]+\.(?:png|jpe?g|webp))['"]/g;
function collectAssetRefs(text) {
  return [...text.matchAll(ASSET_RE)].map((m) => m[0].slice(1, -1));
}
const assetRefs = new Set([
  ...collectAssetRefs(jsBundle),
  ...collectAssetRefs(html),
  ...collectAssetRefs(css),
]);
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
for (const rel of assetRefs) {
  const cleanRel = rel.replace(/^\.\.\//, '');
  const ext = cleanRel.split('.').pop().toLowerCase();
  const data = readFileSync(path.join(ROOT, cleanRel));
  const dataUri = `data:${MIME[ext]};base64,${data.toString('base64')}`;
  jsBundle = jsBundle.split(`'${rel}'`).join(`'${dataUri}'`).split(`"${rel}"`).join(`"${dataUri}"`);
  html = html.split(`'${rel}'`).join(`'${dataUri}'`).split(`"${rel}"`).join(`"${dataUri}"`);
  css = css.split(`'${rel}'`).join(`'${dataUri}'`).split(`"${rel}"`).join(`"${dataUri}"`);
}

html = html.replace(/<link rel="stylesheet" href="css\/style\.css" \/>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main\.js"><\/script>/, `<script type="module">\n${jsBundle}\n</script>`);

process.stdout.write(html);
