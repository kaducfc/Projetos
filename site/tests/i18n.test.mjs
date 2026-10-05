import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, __usarDicionario, traduzirTexto, t } from '../shared/i18n.js';

const IDS = LANGS.map((l) => l.id).filter((id) => id !== 'pt-BR');
const inventario = JSON.parse(readFileSync(new URL('./i18n-inventario.json', import.meta.url), 'utf8'));
const carregar = async (id) => { __usarDicionario((await import(`../shared/i18n/${id}.js`)).default); };

test('i18n: 6 idiomas, português é o padrão e os outros têm arquivo', () => {
  assert.deepEqual(LANGS.map((l) => l.id), ['pt-BR', 'en', 'de', 'es', 'it', 'fr']);
  assert.equal(t('Entrar'), 'Entrar'); // sem idioma carregado, devolve o português
});

test('i18n: todo texto da primeira etapa (site, hub, ranking, perfil, apoio) está traduzido nos 5 idiomas', async () => {
  // Textos que ficam iguais em todos os idiomas ou são nomes/valores dinâmicos.
  const iguais = new Set(['Ranking', 'Runetermo', 'Pix', 'Bronze', 'Painel']);
  for (const id of IDS) {
    await carregar(id);
    const faltam = inventario.filter((k) => !iguais.has(k) && traduzirTexto(k) == null);
    assert.deepEqual(faltam.slice(0, 20), [], `${id}: ${faltam.length} textos sem tradução`);
  }
});

test('i18n: valores {n} entram na tradução e nomes de elo são traduzidos dentro do texto', async () => {
  await carregar('en');
  assert.equal(traduzirTexto('0 de 5'), '0 of 5');
  assert.equal(traduzirTexto('Ferro 3'), 'Iron 3');
  assert.equal(traduzirTexto('de 100 PDR para Ferro 2 · hoje:'), 'of 100 RP to Iron 2 · today:');
  assert.equal(traduzirTexto('Pelo elo e PDR · 12 jogadores'), 'By rank and RP · 12 players');
  await carregar('de');
  assert.equal(traduzirTexto('Ouro 1'), 'Gold 1');
  assert.equal(traduzirTexto('Jogar agora'), 'Jetzt spielen');
});

test('i18n: dicionários gerados batem com as fontes (rode scripts/i18n-build.mjs)', async () => {
  const { default: fonteShell } = await import('../shared/i18n/src/shell.mjs');
  for (const id of IDS) {
    const d = (await import(`../shared/i18n/${id}.js`)).default;
    const i = IDS.indexOf(id) + 1;
    for (const l of fonteShell) assert.equal(d[l[0]], l[i], `${id}: ${l[0]}`);
  }
});

test('i18n: avisos da ranqueada montados com t() e nomes de jogo no idioma certo', async () => {
  await carregar('en');
  assert.equal(t('carreiras'), 'careers');
  assert.equal(t('faltam {resta} {varias} ranqueadas hoje', { resta: 3, varias: t('carreiras') }), '3 ranked careers left today');
  assert.equal(t('Essa {uma} <b>não valeu PDR</b>.', { uma: t('partida no modo Oculto') }), 'That Hidden-mode match <b>did not earn RP</b>.');
  await carregar('fr');
  assert.equal(t('Essa {uma} <b>não valeu PDR</b>.', { uma: t('carreira') }), 'Cette carrière <b>n’a pas rapporté de PDR</b>.');
  // Pares "campo: valor" só mudam quando algum lado é traduzido; listas são traduzidas item a item.
  assert.equal(traduzirTexto('Classe: Mago, Assassino (certo)'), 'Classe : Mage, Assassin (correct)');
  assert.equal(traduzirTexto('Nome do jogador: Fulano'), null);
});
