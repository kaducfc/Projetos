// Simulador de técnico: regras de exibição (JS), conferência com o SQL e integração com o catálogo do site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { GAMES, gameById } from '../shared/config.js';
import * as platform from '../shared/platform.js';
import {
  PESOS, FORA_POSICAO, ELENCO_MAX, CONTRATO_MIN, CONTRATO_MAX, TAXA_MERCADO_PCT, PRECO_RC, VAGAS,
  poder, poderEmCampo, preco, salarioDe, taxaDe,
} from '../jogos/tecnico/js/regras.js';
import { escudoSvg, retratoSvg, ESCUDOS } from '../jogos/tecnico/js/art.js';

const ler = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
const sql = ['0085_tecnico_base.sql', '0086_tecnico_mercado_usuarios.sql', '0087_tecnico_campeonatos.sql', '0088_tecnico_consultas.sql', '0089_tecnico_internacionais.sql', '0090_tecnico_campeoes.sql', '0091_tecnico_gameplay.sql', '0092_tecnico_convidados.sql', '0093_tecnico_posicoes.sql', '0094_tecnico_seguranca.sql', '0095_tecnico_estrelas.sql', '0096_tecnico_estrelas_rc.sql', '0097_tecnico_retratos.sql', '0098_tecnico_treino_amistoso_recrutar.sql', '0099_tecnico_legados_estrelas.sql', '0100_tecnico_amistoso_real.sql', '0101_tecnico_inventario.sql', '0102_tecnico_legados_brasil.sql', '0103_tecnico_demissao_previa.sql', '0104_tecnico_baus_creditos.sql', '0105_tecnico_maestria_7.sql', '0106_tecnico_contratos.sql', '0107_tecnico_retratos_unicos.sql', '0108_tecnico_elenco_inicial_15.sql', '0109_tecnico_escolher_elenco.sql', '0110_tecnico_icone_time.sql', '0111_tecnico_vender_legado_contrato.sql', '0112_tecnico_comprar_legado_repetido.sql', '0113_tecnico_potencial_coerente.sql', '0114_tecnico_treino_xp.sql', '0115_tecnico_xp_vitoria_derrota.sql', '0116_tecnico_marketing.sql', '0117_tecnico_mercado_rotacao.sql', '0118_tecnico_admin_na_serie_b.sql', '0119_tecnico_nomes_campeonatos.sql', '0120_tecnico_liga_semanal_md1.sql', '0121_tecnico_campeonato_individual.sql', '0122_tecnico_pontuacao_desempate.sql', '0123_tecnico_adm_jogadores.sql'].map(ler).join('\n');
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
  assert.ok(Math.abs(poderEmCampo(j({ estrelas: 2 }), 'meio') - 66) < 1e-9, 'cada estrela soma 5% de eficiência'); assert.equal(FORA_POSICAO, 0.75);
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
  assert.equal(Number(/set valor = '([0-9.]+)'::jsonb where chave = 'fora_posicao'/.exec(sql)[1]), FORA_POSICAO);
  const el = JSON.parse(/\('elenco', '(\{.*?\})'::jsonb\)/.exec(sql)[1]);
  assert.equal(JSON.parse(/chave = 'elenco';/.test(sql) ? /valor \|\| '(\{"max": \d+[^']*\})'::jsonb where chave = 'elenco'/.exec(sql)[1] : '{}').max, ELENCO_MAX);
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
    assert.ok(blocos.some((b) => /tc_exigir\(|tc_adm_exigir\(|from site_admins where user_id = uid/.test(b)), `${f} não confere o acesso`); // portão do jogo ou checagem de administrador
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
  const nomes = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((f) => /^00(8[5-9]|9[01])_tecnico/.test(f));
  assert.equal(nomes.length, 7);
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

test('menu lateral tem Treinamento, Amistoso e Recrutar; cada tela só chama funções que existem no SQL e as telas montam com dados', async () => {
  const main = readFileSync(new URL('../jogos/tecnico/js/main.js', import.meta.url), 'utf8');
  for (const [id, nome] of [['treino', 'Treinamento'], ['amistoso', 'Amistoso'], ['recrutar', 'Recrutar']]) assert.ok(main.includes(`['${id}', '${nome}'`), `aba ${nome}`);
  const chamadas = ['tc_treino_estado', 'tc_treinar', 'tc_amistoso_oponentes', 'tc_amistosos_historico', 'tc_amistoso', 'tc_recrutar_info', 'tc_recrutar'];
  const plat = readFileSync(new URL('../shared/platform.js', import.meta.url), 'utf8');
  for (const c of chamadas) { assert.ok(plat.includes(`'${c}'`), `${c} no cliente`); assert.match(sql, new RegExp(`function public\\.${c}\\(`), `${c} no SQL`); }
  // as telas montam (sem DOM): estado simulado e os ajudantes mínimos
  const E = await import('../jogos/tecnico/js/extras.js');
  const api = platform.tecnico;
  const jog = (id, o = {}) => ({ id, nome: `J${id}`, pos: 'meio', poder: 70, estrela: false, mec: 70, rotas: 60, macro: 60, tf: 60, mental: 60, exp: 10, limite: 78, poder_inicial: 68, horas: 5, custos: { mec: 1, rotas: 1, macro: 1, tf: 1, mental: 1 }, treino: null, ...o });
  api.treinoEstado = async () => ({ config: { horas: 6, pontos: 3, simultaneos: 3, bonus_comum: 10, bonus_estrela: 15 }, creditos: 100, agora: new Date().toISOString(), jogadores: [jog(1, { exp: 100 }), jog(2, { poder: 78, limite: 78, exp: 100 }), jog(3, { exp: 40 })], em_andamento: 0 });
  api.amistosoOponentes = async () => [{ id: 9, nome: 'Rivais', sigla: 'RIV', escudo: 'escudo-1', cor1: '#112233', cor2: '#aabbcc', divisao: 'acesso', tecnico: false, poder: 66 }];
  api.amistosoHistorico = async () => ({ feitos_hoje: 1, exp_por_dia: 5, exp_ganho: 2, com_exp_restantes: 4, lista: [] });
  api.recrutarInfo = async () => ({ config: { desconto_5: 0.15, pity_a_cada: 10, contrato_semanas: 12, baus: { basico: { nome: 'Baú Básico', rc: 300, odds: { comum: 55, raro: 30, epico: 12, lendario: 2.7, mitico: 0.3 } }, premium: { nome: 'Baú Premium', rc: 900, odds: { comum: 20, raro: 38, epico: 28, lendario: 11, mitico: 3 } } } }, saldo_rc: 5000, elenco: 5, elenco_max: 10, legados: { total: 15, por_raridade: {} }, garantia: {}, meus_legados: [] });
  const S = { aba: 'treino', ocupado: false, meu: { poder: 70, org: { nome: 'Eu' } } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, '');
  E.iniciarExtras({ S, esc, fmt: (n) => String(n), IMG: () => '', agir: async () => null, toast() {}, render() {}, novaChave: () => 'k', escudoHtml: (p) => `<b>${p}</b>`, estrelasHtml: () => '', nomeLiga: () => ({}), dataCurta: (d) => d, nomeVaga: (v) => v, atualizarMeu: async () => {} });
  await E.carregarExtras('treino'); const t = E.viewTreino();
  assert.match(t, /Treinamento/); assert.match(t, /data-act="treinar"/); assert.match(t, /Limite de treino atingido/);
  assert.equal((t.match(/data-act="treinar"/g) || []).length, 15, '5 atributos por jogador');
  assert.equal((t.match(/data-act="treinar"[^>]*disabled/g) || []).length, 10, 'bloqueados: o jogador no limite e o que está com XP 40/100');
  assert.match(t, /XP <b>100\/100<\/b> · pronto para treinar/); assert.match(t, /XP <b>40\/100<\/b>/);
  S.aba = 'amistoso'; await E.carregarExtras('amistoso'); assert.match(E.viewAmistoso(), /Desafiar[\s\S]*Rivais|Rivais[\s\S]*Desafiar/);
  S.aba = 'recrutar'; await E.carregarExtras('recrutar'); const r = E.viewRecrutar();
  assert.match(r, /Baú Básico/); assert.match(r, /Baú Premium/); assert.match(r, /1275/); assert.match(r, /3825/); assert.match(r, /-15%/);
  assert.match(E.modalRecrutar({ contrato: 12, r: { preco_rc: 300, itens: [{ raridade: 'epico', repetida: true, jogador: jog(5, { legado: true, copias: 2, raridade: 'epico' }) }] } }), /Novo jogador Legado[\s\S]*repetido[\s\S]*\+1 cópia/);
  E.limparExtras();
});

test('Central de Marketing: o menu existe, o cliente só chama funções do SQL, as telas montam e a taxa exibida é a do servidor', async () => {
  const main = readFileSync(new URL('../jogos/tecnico/js/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("['marketing', 'Marketing'"), 'aba no menu');
  const plat = readFileSync(new URL('../shared/platform.js', import.meta.url), 'utf8');
  for (const c of ['tc_marketing_estado', 'tc_marketing_historico', 'tc_marketing_melhorar', 'tc_patrocinio_contratar', 'tc_patrocinio_auto', 'tc_campanha_iniciar', 'tc_marketing_resumo_visto']) {
    assert.ok(plat.includes(`'${c}'`), `${c} no cliente`); assert.match(sql, new RegExp(`function public\\.${c}\\(`), `${c} no SQL`);
  }
  for (const k of ['patrocinador_invalido', 'patrocinio_ja_ativo', 'limite_patrocinios', 'requisito_nao_cumprido', 'marketing_no_maximo', 'campanha_ativa', 'campanha_em_recarga', 'campanha_invalida', 'contrato_inexistente']) {
    assert.ok(plat.includes(`${k}:`), `mensagem de ${k}`); assert.ok(sql.includes(`'${k}'`), `${k} existe no SQL`);
  }
  const M = await import('../jogos/tecnico/js/marketing.js');
  const api = platform.tecnico;
  const taxa = { base: 12, base_inicial: 10, base_fama: 2, base_divisao: 0, bonus_marketing: 0.08, bonus_audiencia: 0.05, bonus_campanha: 0.05, patrocinadores: 5 };
  taxa.por_minuto = taxa.base * (1 + taxa.bonus_marketing + taxa.bonus_audiencia + taxa.bonus_campanha) + taxa.patrocinadores;
  const fim = new Date(Date.now() + 3 * 3600e3).toISOString();
  const niveis = [{ min: 0, nome: 'Clube desconhecido', beneficio: 'Patrocinadores locais' }, { min: 100, nome: 'Clube regional', beneficio: 'Patrocinadores regionais' }];
  const estado = {
    creditos: 5000, taxa: { ...taxa, por_hora: taxa.por_minuto * 60, por_dia: taxa.por_minuto * 1440 }, pendente: { segundos: 0, valor: 0, limite_h: 8 },
    fama: { valor: 60, max: 1000, nivel: { nome: 'Clube desconhecido', proximo_min: 100, proximo_nome: 'Clube regional' }, niveis },
    marketing: { nivel: 3, max: 20, nome: 'Produção regular de conteúdo', bonus: 0.08, custo_proximo: 9000, proximo_nome: 'Parcerias locais', proximo_bonus: 0.12, limite_contratos: 2, limites: [{ nivel: 1, max: 1 }, { nivel: 3, max: 2 }] },
    contratos: [{ id: 7, marca: 'rift_cafe', nome: 'Rift Café', categoria: 'local', inicio: fim, fim, receita_min: 5, renovar_auto: true, ativo: true }],
    patrocinadores: [
      { id: 'rift_cafe', nome: 'Rift Café', ramo: 'Cafeteria', categoria: 'local', receita_min: 4, duracao_h: 48, custo: 1800, req: { fama: 0, nivel: 1 }, estado: 'ativo' },
      { id: 'nexus_energy', nome: 'Nexus Energy', ramo: 'Bebidas', categoria: 'local', receita_min: 5, duracao_h: 72, custo: 3000, req: { fama: 0, nivel: 1 }, estado: 'disponivel' },
      { id: 'celestial_air', nome: 'Celestial Air', ramo: 'Aviação', categoria: 'premium', receita_min: 165, duracao_h: 336, custo: 300000, req: { fama: 700, nivel: 15, divisao: 'principal', titulares: 5 }, estado: 'indisponivel', motivo: 'Fama mínima: 700' },
    ],
    campanha_ativa: { id: 'redes_sociais', inicio: fim, fim, bonus: 0.05 },
    campanhas: [{ id: 'redes_sociais', nome: 'Campanha nas redes sociais', custo: 4000, duracao_h: 6, recarga_h: 12, bonus: 0.05, efeito: '+5% por 6h', recarga_ate: null, requisito: null }],
    audiencia: { total: 120, bonus: 0.05, cap: 0.45, peso_reserva: 0.25, jogadores: [{ id: 1, nome: 'Astro', pos: 'meio', titular: true, fama: 90, audiencia: 94.8, conta: true }, { id: 2, nome: 'Reserva', pos: 'top', titular: false, fama: 30, audiencia: 13.7, conta: true }] },
    resumo: { minutos: 480, receita_clube: 3000, bonus_comercial: 500, patrocinadores: 1200, total: 4700, limitado: true },
  };
  api.marketingEstado = async () => estado;
  api.marketingHistorico = async () => [{ id: 1, delta: 800, saldo: 5800, motivo: 'mkt_receita', criado: new Date().toISOString() }];
  const S = { aba: 'marketing', ocupado: false, modal: null, meu: { org: { creditos: 0 } } };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, '');
  M.iniciarMarketing({ S, esc, fmt: (n) => String(Math.round(n)), IMG: () => '', agir: async () => null, render() {}, nomeVaga: (v) => v, atualizarMeu: async () => {} });
  await M.carregarMarketing();
  assert.equal(S.meu.org.creditos, 5000, 'saldo vem do servidor');
  const v = M.viewMarketingCentral();
  assert.match(v, /Central de Marketing/); assert.match(v, /Visão geral/); assert.match(v, /Histórico financeiro/); assert.match(v, /Audiência e jogadores/);
  assert.match(v, new RegExp(String(Math.round(taxa.por_minuto * 10) / 10).replace('.', '[.,]')), 'receita por minuto da tela = a do servidor');
  assert.match(v, /Clube desconhecido/);
  await M.tratarMkt('mkt-aba', { dataset: { aba: 'marketing' } }); const mk = M.viewMarketingCentral();
  assert.match(mk, /data-act="mkt-melhorar"/); assert.match(mk, /Campanha nas redes sociais/); assert.match(mk, /Em andamento/);
  assert.equal((mk.match(/data-act="mkt-campanha"[^>]*disabled/g) || []).length, 1, 'uma campanha por vez');
  await M.tratarMkt('mkt-aba', { dataset: { aba: 'patro' } }); const pt = M.viewMarketingCentral();
  assert.match(pt, /Fama mínima: 700/); assert.match(pt, /data-act="mkt-auto"[^>]*checked/);
  assert.equal((pt.match(/data-act="mkt-contratar"[^>]*disabled/g) || []).length, 2, 'ativo e indisponível travados');
  await M.tratarMkt('mkt-aba', { dataset: { aba: 'aud' } }); assert.match(M.viewMarketingCentral(), /Astro/);
  await M.tratarMkt('mkt-aba', { dataset: { aba: 'fin' } }); assert.match(M.viewMarketingCentral(), /Receita do marketing/);
  const r = M.modalMktResumo({ r: estado.resumo });
  assert.match(r, /continuou trabalhando enquanto você estava fora/); assert.match(r, /\+4700 cr\./); assert.match(r, /Receita dos patrocinadores/); assert.match(r, /Bônus comercial/);
  M.limparMarketing();
});

test('ícone do time: codifica e decodifica, os 30 emblemas e 20 bandeiras têm as imagens e o HTML sai com as camadas certas', async () => {
  const I = await import('../jogos/tecnico/js/icone.js');
  const ic = { e: 12, ec: ['#112233', '#445566', '#778899'], b: 7, bc: ['#aabbcc', '#ddeeff'] };
  assert.equal(I.icCodificar(ic), 'v2:12:112233:445566:778899:7:aabbcc:ddeeff');
  assert.deepEqual(I.icDecodificar(I.icCodificar(ic)), ic);
  assert.equal(I.icDecodificar('escudo-2'), null); assert.equal(I.icDecodificar('v2:31:112233:445566:778899:0:aabbcc:ddeeff'), null);
  assert.equal(I.icCodificar({ ...ic, b: 0 }).split(':')[5], '0');
  const dir = new URL('../jogos/tecnico/img/icones/', import.meta.url);
  for (let n = 1; n <= I.N_EMBLEMAS; n++) for (let p = 1; p <= 3; p++) assert.ok(existsSync(new URL(`emb/e${String(n).padStart(2, '0')}-${p}.webp`, dir)), `emblema ${n} parte ${p}`);
  for (let n = 1; n <= I.N_BANDEIRAS; n++) for (const suf of ['s', '1', '2']) assert.ok(existsSync(new URL(`flag/f${String(n).padStart(2, '0')}-${suf}.webp`, dir)), `bandeira ${n} ${suf}`);
  assert.equal(I.BANDEIRAS.length, I.N_BANDEIRAS);
  for (const f of I.BANDEIRAS) assert.ok(f.cx > 0.2 && f.cx < 0.8 && f.cy > 0.15 && f.cy < 0.85 && f.s > 0.25 && f.s < 0.7, `posição ${f.id}`);
  const com = I.icHtml(ic, 80); const sem = I.icHtml({ ...ic, b: 0 }, 80);
  assert.equal((com.match(/<i /g) || []).length, 5); assert.equal((sem.match(/<i /g) || []).length, 3, 'sem bandeira: só as 3 camadas do emblema');
  assert.match(com, /--c:#aabbcc/); assert.match(com, /e12-3\.webp/); assert.match(com, /f07-2\.webp/);
  const A = await import('../jogos/tecnico/js/art.js');
  assert.match(A.escudoOrg({ escudo: 'v2:12:112233:445566:778899:0:aabbcc:ddeeff', sigla: 'ABC' }, 40), /class="tc-ic"/);
  assert.match(A.escudoOrg({ escudo: 'escudo-2', cor1: '#111111', cor2: '#222222', sigla: 'ABC' }, 40), /<svg/, 'escudo antigo continua');
});

test('mercado oficial com rotação: o cliente chama a função do SQL e conhece o erro de oferta', () => {
  const plat = readFileSync(new URL('../shared/platform.js', import.meta.url), 'utf8');
  assert.ok(plat.includes("'tc_mercado_rotacao'")); assert.match(sql, /function public\.tc_mercado_rotacao\(/);
  assert.ok(plat.includes('fora_da_oferta:')); assert.ok(sql.includes("'fora_da_oferta'"));
  assert.match(sql, /"min": 7, "max": 10, "abaixo": 5, "acima": 8/, 'configuração: 7 a 10 jogadores, de -5 a +8');
});

test('painel ADM: a aba só aparece para administradores, o cliente chama funções do SQL e o OVR dos atributos é o do servidor', async () => {
  const main = readFileSync(new URL('../jogos/tecnico/js/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("['adm', 'ADM'"), 'aba ADM'); assert.ok(!main.includes("['campeoes', 'Campeões'"), 'a aba pública de Campeões saiu do menu');
  assert.match(main, /filter\(\(\[id\]\) => id !== 'adm' \|\| S\.ehAdmin\)/, 'ADM só para administradores');
  const plat = readFileSync(new URL('../shared/platform.js', import.meta.url), 'utf8');
  for (const c of ['tc_adm_jogadores', 'tc_adm_jogador_editar']) { assert.ok(plat.includes(`'${c}'`)); assert.match(sql, new RegExp(`function public\\.${c}\\(`)); }
  for (const k of ['jogador_nome_invalido', 'jogador_nome_em_uso', 'atributo_invalido']) { assert.ok(plat.includes(`${k}:`)); assert.ok(sql.includes(`'${k}'`)); }
  const A = await import('../jogos/tecnico/js/adm.js');
  const w = [0.25, 0.2, 0.2, 0.2, 0.15];
  const a = { mec: 60, rotas: 50, macro: 40, tf: 70, mental: 55 };
  const ovr = A.ovrDe(a, w); assert.ok(Math.abs(ovr - (0.25 * 60 + 0.2 * 50 + 0.2 * 40 + 0.2 * 70 + 0.15 * 55)) < 1e-9);
  for (const alvo of [30, 55, 80, 95, 100, 1]) {
    const n = A.atributosParaOvr(a, w, alvo);
    assert.ok(Math.abs(A.ovrDe(n, w) - alvo) <= 0.51, `OVR ${alvo}: ${A.ovrDe(n, w)}`);
    for (const k of Object.keys(n)) assert.ok(n[k] >= 1 && n[k] <= 100);
  }
  assert.ok(A.atributosParaOvr(a, w, 80).tf > A.atributosParaOvr(a, w, 80).macro, 'mantém as proporções entre os atributos');
});
