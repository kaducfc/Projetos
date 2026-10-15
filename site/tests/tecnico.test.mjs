// Simulador de técnico: regras de exibição (JS), conferência com o SQL e integração com o catálogo do site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GAMES, gameById } from '../shared/config.js';
import * as platform from '../shared/platform.js';
import {
  PESOS, FORA_POSICAO, ELENCO_MAX, CONTRATO_MIN, CONTRATO_MAX, TAXA_MERCADO_PCT, PRECO_RC, VAGAS,
  poder, poderEmCampo, preco, salarioDe, taxaDe,
} from '../jogos/tecnico/js/regras.js';
import { escudoSvg, retratoSvg, ESCUDOS } from '../jogos/tecnico/js/art.js';

const ler = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
const sql = ['0085_tecnico_base.sql', '0086_tecnico_mercado_usuarios.sql', '0087_tecnico_campeonatos.sql', '0088_tecnico_consultas.sql', '0089_tecnico_internacionais.sql'].map(ler).join('\n');
const j = (o = {}) => ({ id: 1, nome: 'Teste', pos: 'meio', pos2: [], mec: 60, rotas: 60, macro: 60, tf: 60, mental: 60, fama: 50, forma: 50, idade: 22, potencial: 70, ...o });

test('Poder individual: média ponderada dos cinco atributos, sem a Fama, entre 1 e 100', () => {
  assert.equal(poder(j()), 60);
  assert.equal(poder(j({ fama: 1 })), poder(j({ fama: 100 })), 'a Fama não muda o Poder');
  assert.equal(poder(j({ mec: 100, rotas: 100, macro: 100, tf: 100, mental: 100 })), 100);
  assert.equal(poder(j({ mec: 1, rotas: 1, macro: 1, tf: 1, mental: 1 })), 1);
  // 25/20/20/20/15
  assert.ok(Math.abs(poder(j({ mec: 80, rotas: 40, macro: 40, tf: 40, mental: 40 })) - (0.25 * 80 + 0.75 * 40)) < 1e-9);
  assert.equal(Object.values(PESOS).reduce((a, b) => a + b, 0), 100);
});

test('Poder em campo: penalidade fora da posição e forma limitada', () => {
  assert.equal(poderEmCampo(j(), 'meio'), 60);
  assert.ok(Math.abs(poderEmCampo(j(), 'top') - 60 * FORA_POSICAO) < 1e-9);
  assert.equal(poderEmCampo(j({ pos2: ['top'] }), 'top'), 60, 'posição secundária não penaliza');
  assert.ok(poderEmCampo(j({ forma: 100 }), 'meio') - 60 <= 2.0001, 'a forma pesa pouco');
});

test('Preço, salário e taxa do mercado', () => {
  assert.ok(preco(40, 50, 25, 25) >= 5000);
  assert.ok(preco(80, 85, 70, 21) > preco(60, 85, 70, 21), 'mais Poder, mais caro');
  assert.equal(salarioDe(100000), 1500);
  assert.equal(taxaDe(1000), 50);
  assert.equal(TAXA_MERCADO_PCT, 5);
});

test('constantes do navegador batem com a configuração do SQL', () => {
  const pesos = JSON.parse(/\('pesos', '(\{.*?\})'::jsonb\)/.exec(sql)[1]).global;
  assert.deepEqual(pesos, PESOS);
  assert.equal(Number(/\('fora_posicao', '([0-9.]+)'::jsonb\)/.exec(sql)[1]), FORA_POSICAO);
  const el = JSON.parse(/\('elenco', '(\{.*?\})'::jsonb\)/.exec(sql)[1]);
  assert.equal(el.max, ELENCO_MAX);
  assert.equal(el.contrato_min, CONTRATO_MIN);
  assert.equal(el.contrato_max, CONTRATO_MAX);
  assert.equal(Number(/\('taxa_mercado_pct', '(\d+)'::jsonb\)/.exec(sql)[1]), TAXA_MERCADO_PCT);
  const pr = JSON.parse(/\('preco_rc', '(\{.*?\})'::jsonb\)/.exec(sql)[1]);
  assert.deepEqual(pr, PRECO_RC);
  // mesma conta de preço e salário
  assert.match(sql, /power\(poder \/ 100\.0, 3\) \* 800000/);
  assert.match(sql, /preco \* 0\.015/);
});

test('segurança: todas as tabelas tc_* têm RLS e nenhum acesso direto; funções fixam search_path', () => {
  const tabelas = [...sql.matchAll(/create table if not exists public\.(tc_\w+)/g)].map((m) => m[1]);
  assert.ok(tabelas.length >= 12);
  for (const t of tabelas) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t} sem RLS`);
    assert.match(sql, new RegExp(`revoke all on [^;]*public\\.${t}[ ,;][^;]*from anon, authenticated`), `${t} acessível direto`);
  }
  const funcs = [...sql.matchAll(/create or replace function public\.(tc_\w+)\(([^)]*)\)\s*returns[^$]*?\$\$/gs)];
  assert.ok(funcs.length > 40);
  for (const [bloco, nome] of funcs) {
    if (/language sql[^$]*immutable/.test(bloco) && !/security definer/.test(bloco)) continue; // funções puras
    assert.match(bloco, /set search_path = public/, `${nome} sem search_path`);
  }
  assert.ok(!/grant (all|insert|update|delete)/i.test(sql), 'nada de escrita direta para o navegador');
});

test('só as funções de uso do jogo são liberadas para contas logadas (nunca para anon)', () => {
  const liberadas = [...sql.matchAll(/grant execute on function public\.(tc_\w+)\(/g)].map((m) => m[1]);
  assert.ok(!sql.includes('to anon'));
  for (const interna of ['tc_creditos_mexer', 'tc_processar_partida', 'tc_simular', 'tc_encerrar_liga', 'tc_gerar_jogadores', 'tc_rank_liga', 'tc_fechar_semana_org']) {
    assert.ok(!liberadas.includes(interna), `${interna} não pode ser chamada pelo navegador`);
    assert.match(sql, new RegExp(`revoke all on function public\\.${interna}\\([^)]*\\) from public, anon, authenticated`));
  }
  // toda função liberada exige o jogo aberto/conta (tc_exigir)
  for (const f of liberadas) {
    const corpo = new RegExp(`function public\\.${f}\\([^)]*\\)[\\s\\S]*?\\$\\$;`, 'g');
    const blocos = sql.match(corpo) || [];
    assert.ok(blocos.some((b) => /tc_exigir\(/.test(b)), `${f} não confere o acesso`);
  }
});

test('o navegador só chama funções que existem no SQL', () => {
  const chamadas = [...readFileSync(new URL('../shared/platform.js', import.meta.url), 'utf8').matchAll(/rpcTecnico\('(tc_\w+)'/g)].map((m) => m[1]);
  assert.ok(chamadas.length >= 18);
  for (const c of new Set(chamadas)) assert.match(sql, new RegExp(`function public\\.${c}\\(`), `${c} não existe no SQL`);
  assert.deepEqual(Object.keys(platform.tecnico).sort().slice(0, 3), Object.keys(platform.tecnico).sort().slice(0, 3));
});

test('catálogo: o jogo está em teste (só administradores) e tem capa no hub', () => {
  const g = gameById('tecnico');
  assert.ok(g, 'jogo no catálogo');
  assert.equal(g.soAdmin, true, 'oculto até o lançamento');
  assert.equal(g.ranked, undefined, 'o card de ranqueada do hub só passa a listá-lo quando for lançado');
  assert.match(readFileSync(new URL('../js/hub.js', import.meta.url), 'utf8'), /\btecnico: `/);
  assert.equal(GAMES.filter((x) => x.id === 'tecnico').length, 1);
  assert.match(readFileSync(new URL('../jogos/tecnico/index.html', import.meta.url), 'utf8'), /noindex/);
});

test('migrações novas seguem a numeração e o jogo nasce fechado, sem Rank', () => {
  const nomes = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((f) => /^008[5-9]_tecnico/.test(f));
  assert.equal(nomes.length, 5);
  assert.match(sql, /\('aberto', 'false'::jsonb\)/);
  assert.match(sql, /\('rank_ativo', 'false'::jsonb\)/);
});

test('arte: escudos e retratos são determinísticos', () => {
  assert.equal(ESCUDOS.length, 6);
  for (const e of ESCUDOS) assert.match(escudoSvg(e, '#112233', '#ddaa22', 'ABC'), /<svg/);
  assert.equal(retratoSvg(j({ id: 7, nome: 'Zyn' })), retratoSvg(j({ id: 7, nome: 'Zyn' })));
  assert.notEqual(retratoSvg(j({ id: 7, nome: 'Zyn' })), retratoSvg(j({ id: 8, nome: 'Kro' })));
  assert.match(retratoSvg(j({ retrato: '/x.webp' })), /<img/);
  assert.equal(VAGAS.length, 5);
});
