import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseBarao, ajustarPdr, PDR_BARAO } from '../shared/ranked.js';
import { existsSync, readFileSync } from 'node:fs';
import { FACIL, MEDIA, DIFICIL, IMPOSSIVEL, BANCO } from '../../barao-banco/perguntas.mjs';
import {
  semAjuda, NIVEIS, PREMIOS, PULOS, premioAoErrar, premioAoParar,
} from '../jogos/barao/js/logic.js';

const sql = (nome) => readFileSync(new URL(`../supabase/migrations/${nome}`, import.meta.url), 'utf8');
const faixa = (n) => (n <= 3 ? 1 : n <= 6 ? 2 : n <= 10 ? 3 : 4);

test('barão: banco com 250+ perguntas válidas (4 opções distintas, sem repetição)', () => {
  const todas = [...FACIL, ...MEDIA, ...DIFICIL, ...IMPOSSIVEL];
  assert.ok(todas.length >= 250, `só ${todas.length} perguntas`);
  assert.ok(FACIL.length >= 30 && MEDIA.length >= 30 && DIFICIL.length >= 30 && IMPOSSIVEL.length >= 10, 'poucas perguntas por faixa');
  assert.deepEqual(Object.keys(BANCO), ['1', '2', '3', '4']);
  const vistas = new Set();
  for (const p of todas) {
    assert.equal(p.a.length, 4, p.q);
    assert.equal(new Set(p.a.map((x) => x.trim().toLowerCase())).size, 4, `opções repetidas em: ${p.q}`);
    assert.ok(p.q.endsWith('?'), p.q);
    assert.ok(['jogo', 'lore', 'comp'].includes(p.cat), p.q);
    assert.ok(!vistas.has(p.q.toLowerCase()), `repetida: ${p.q}`);
    vistas.add(p.q.toLowerCase());
  }
});

test('barão: 11 perguntas (3 fáceis, 3 médias, 4 difíceis, 1 quase impossível) e prêmios crescentes', () => {
  assert.equal(NIVEIS, 11);
  assert.equal(PREMIOS.length, NIVEIS);
  assert.equal(PREMIOS[10], 1000000);
  assert.equal(PREMIOS[9], 500000);
  assert.ok(PREMIOS.every((v, i) => i === 0 || v > PREMIOS[i - 1]));
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(faixa), [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4]);
  assert.equal(premioAoParar(1), 0);
  assert.equal(premioAoParar(8), PREMIOS[6]);
  // errar custa um degrau abaixo do que o jogador já tem (o "parar")
  assert.equal(premioAoErrar(1), 0);
  assert.equal(premioAoErrar(2), 0);
  assert.equal(premioAoErrar(3), PREMIOS[0]);
  assert.equal(premioAoErrar(7), PREMIOS[4]);
  assert.equal(premioAoErrar(11), PREMIOS[8]); // com 500.000 no bolso, errar vale 250.000
  for (let n = 3; n <= 11; n += 1) assert.ok(premioAoErrar(n) < premioAoParar(n));
});

test('barão: o banco de perguntas NÃO fica no site (só no servidor)', () => {
  assert.ok(!existsSync(new URL('../jogos/barao/js/perguntas.js', import.meta.url)), 'perguntas.js não pode ficar em site/');
  const main = readFileSync(new URL('../jogos/barao/js/main.js', import.meta.url), 'utf8');
  assert.ok(!/perguntas/.test(main.replace(/Pergunta|pergunta/g, '')), 'main.js não pode importar o banco');
  const logic = readFileSync(new URL('../jogos/barao/js/logic.js', import.meta.url), 'utf8');
  assert.ok(!/BANCO|import .*perguntas/.test(logic));
});

test('barão: regras de prêmio do site e do servidor (0066) batem', () => {
  const s = sql('0066_barao_servidor.sql');
  assert.ok(s.includes(`array[${PREMIOS.join(', ')}]`), 'prêmios');
  assert.equal(PULOS, 2);
  assert.ok(s.includes('pulos int not null default 2'));
  assert.ok(s.includes('when n <= 3 then 1 when n <= 6 then 2 when n <= 10 then 3 else 4'));
  // errar: degrau abaixo do que o jogador tinha (PREMIOS[n-3] no site = prem[n-2] no SQL, base 1)
  assert.ok(s.includes('case when p.nivel >= 3 then prem[p.nivel - 2] else 0 end'));
  // parar: o prêmio da pergunta anterior
  assert.ok(s.includes('premio = prem[p.nivel - 1]'));
  assert.equal(premioAoParar(5), PREMIOS[3]);
  assert.equal(premioAoErrar(5), PREMIOS[2]);
  // ajudas nunca na última pergunta
  assert.ok(semAjuda(NIVEIS));
  assert.equal((s.match(/p\.nivel >= 11/g) || []).length >= 3, true);
  // visitantes e contas podem jogar; ninguém lê as tabelas direto
  assert.ok(s.includes('grant execute on function public.site_barao_comecar() to anon, authenticated'));
  assert.ok(s.includes('revoke all on table public.site_barao_perguntas from anon, authenticated'));
  assert.ok(s.includes('revoke all on table public.site_barao_partidas from anon, authenticated'));
  // a resposta certa só sai depois de respondida
  assert.ok(s.includes("'certa', case when p.status <> 'jogando' then p.certa end"));
  // limpeza das partidas abandonadas
  assert.ok(s.includes("interval '6 hours'") && s.includes("interval '3 days'"));
});

test('barão: tradução completa — telas, perguntas e alternativas nos 5 idiomas', async () => {
  const { __usarDicionario, traduzirTexto, t, LANGS } = await import('../shared/i18n.js');
  const { default: ui } = await import('../shared/i18n/src/barao-ui.mjs');
  const ids = LANGS.map((l) => l.id).filter((id) => id !== 'pt-BR');
  const todas = Object.values(BANCO).flat();
  // alternativas que ficam iguais em todos os idiomas (nomes de campeões, times, lugares, números…)
  const opcoesTraduzidas = new Set((await import('../shared/i18n/src/barao-opcoes.mjs')).default.map((l) => l[0]));
  for (const id of ids) {
    __usarDicionario((await import(`../shared/i18n/${id}.js`)).default, id);
    const faltam = todas.filter((p) => traduzirTexto(p.q) == null).map((p) => p.q);
    assert.deepEqual(faltam.slice(0, 5), [], `${id}: ${faltam.length} perguntas sem tradução`);
    for (const l of ui) if (!/^\{\w+\} pontos$/.test(l[0])) assert.ok(traduzirTexto(l[0]) != null || l[0] === 'Quiz', `${id}: ${l[0]}`);
    for (const o of opcoesTraduzidas) assert.ok(traduzirTexto(o) != null, `${id}: ${o}`);
  }
  // as alternativas com palavras em português estão todas cobertas (o resto é nome próprio)
  const palavras = /\b(de|do|da|dos|das|e|o|a|os|as|um|uma|em|no|na|fase|dano|time|guerra|rei|ilhas?)\b/i;
  const semTraducao = [...new Set(todas.flatMap((p) => p.a))].filter((o) => palavras.test(o) && !opcoesTraduzidas.has(o) && !/^[A-Z][\w'’.\-\/ ]+$/.test(o));
  assert.deepEqual(semTraducao, [], 'alternativas em português sem tradução');
  // valores dentro do texto continuam funcionando
  __usarDicionario((await import('../shared/i18n/en.js')).default, 'en');
  assert.equal(t('{carta}: {n} opções erradas eliminadas!', { carta: 'Blue Card', n: 2 }), 'Blue Card: 2 wrong options removed!');
  assert.equal(traduzirTexto('A resposta certa era B: Dragão Infernal.'), 'The correct answer was B: Infernal Drake.');
});

test('barão: PDR da ranqueada pelo prêmio final e % por elo', () => {
  const esperado = { 0: -20, 500: -20, 1000: -15, 2000: -10, 5000: -5, 10000: 5, 20000: 10, 50000: 15, 100000: 20, 250000: 25, 500000: 30, 1000000: 35 };
  for (const [premio, pdr] of Object.entries(esperado)) assert.equal(baseBarao(Number(premio)), pdr, `prêmio ${premio}`);
  // todos os prêmios possíveis do jogo estão na tabela
  for (const p of [0, ...PREMIOS]) assert.ok(baseBarao(p) != null);
  assert.equal(PDR_BARAO.length, 11);
  // ganhos passam pelo % do elo (Ferro 100%, Mestre 50%); perdas ficam iguais
  assert.equal(ajustarPdr(baseBarao(1000000), 0), 35);
  assert.equal(ajustarPdr(baseBarao(1000000), 7), 18);
  assert.equal(ajustarPdr(baseBarao(10000), 4), 4); // 5 × 70%
  assert.equal(ajustarPdr(baseBarao(0), 9), -20);
  assert.equal(ajustarPdr(baseBarao(5000), 6), -5);
});

test('barão: o SQL da ranqueada (0065) usa a mesma tabela e as mesmas regras', async () => {
  const sql = readFileSync(new URL('../supabase/migrations/0065_barao_ranqueada.sql', import.meta.url), 'utf8');
  for (const [min, pdr] of PDR_BARAO.slice(0, -1)) assert.ok(sql.includes(`when premio >= ${min} then ${pdr}`), `${min} → ${pdr}`);
  assert.ok(sql.includes('else -20 end'));
  assert.ok(sql.includes("('carreira-no-rift', 'cblol', 'barao')"));
});
