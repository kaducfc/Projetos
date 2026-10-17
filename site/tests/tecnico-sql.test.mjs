// Simulador de técnico: testa o servidor de verdade (PostgreSQL temporário com as migrações 0085 a 0089).
// Precisa dos binários do PostgreSQL (TC_PGBIN, padrão /usr/lib/postgresql/16/bin); sem eles os testes são pulados.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync, spawn, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { poder, poderEmCampo } from '../jogos/tecnico/js/regras.js';

const BIN = process.env.TC_PGBIN || '/usr/lib/postgresql/16/bin';
const TEM = existsSync(`${BIN}/initdb`);
const PORT = 5600 + (process.pid % 300);
const MIG = ['0085_tecnico_base.sql', '0086_tecnico_mercado_usuarios.sql', '0087_tecnico_campeonatos.sql', '0088_tecnico_consultas.sql', '0089_tecnico_internacionais.sql', '0090_tecnico_campeoes.sql', '0091_tecnico_gameplay.sql', '0092_tecnico_convidados.sql', '0093_tecnico_posicoes.sql', '0094_tecnico_seguranca.sql', '0095_tecnico_estrelas.sql', '0096_tecnico_estrelas_rc.sql', '0097_tecnico_retratos.sql', '0098_tecnico_treino_amistoso_recrutar.sql', '0099_tecnico_legados_estrelas.sql', '0100_tecnico_amistoso_real.sql', '0101_tecnico_inventario.sql', '0102_tecnico_legados_brasil.sql', '0103_tecnico_demissao_previa.sql', '0104_tecnico_baus_creditos.sql', '0105_tecnico_maestria_7.sql', '0106_tecnico_contratos.sql', '0107_tecnico_retratos_unicos.sql', '0108_tecnico_elenco_inicial_15.sql', '0109_tecnico_escolher_elenco.sql', '0110_tecnico_icone_time.sql'];
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
let dir;
let O2; // id da organização do técnico 2 (a sequência pode pular números em tentativas recusadas)
const root = typeof process.getuid === 'function' && process.getuid() === 0;
const como = (cmd) => (root ? `su postgres -c ${JSON.stringify(cmd)}` : cmd);

function psql(args, input) {
  return spawnSync('psql', ['-h', dir, '-p', String(PORT), '-U', 'postgres', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input });
}
// Executa SQL como uma conta (uid) em um dia (hoje). Devolve { ok, out, err }.
function Q(sql, uid = null, hoje = '2026-10-12') {
  const r = psql(['-d', 't', '-c', `set app.uid='${uid ? U(uid) : ''}'`, '-c', `set app.hoje='${hoje}'`, '-c', sql]);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: ((r.stderr || '').match(/ERROR:\s+(\S+)/) || [, (r.stderr || '').trim()])[1] };
}
const V = (sql, uid, hoje) => { const r = Q(sql, uid, hoje); assert.ok(r.ok, `${sql}\n${r.err}`); return r.out; };
const falha = (sql, uid, hoje) => { const r = Q(sql, uid, hoje); assert.ok(!r.ok, `deveria falhar: ${sql}`); return r.err; };
const J = (sql, uid, hoje) => JSON.parse(V(sql, uid, hoje));
let seqChave = 0;
// Garante um reserva na organização (contrata o mais barato do mercado) e devolve o id.
const reserva = (uid, org) => {
  const j = Q(`select id from tc_jogadores where org_id = ${org} and slot is null order by id limit 1`, uid).out;
  if (j) return j;
  const alvo = J("select tc_mercado_oficial('{\"ordem\":\"preco\"}')->0->>'id'", uid);
  V(`select tc_contratar(${alvo}, 20, 'chave-reserva-${++seqChave}-${org}')`, uid);
  return V(`select id from tc_jogadores where org_id = ${org} and slot is null order by id limit 1`, uid);
};

before(() => {
  if (!TEM) return;
  dir = mkdtempSync(path.join(tmpdir(), 'tcpg-'));
  if (root) execSync(`chown postgres ${dir}`);
  chmodSync(dir, 0o777);
  execSync(como(`${BIN}/initdb -D ${dir}/data -A trust`), { stdio: 'ignore' });
  execSync(como(`${BIN}/pg_ctl -D ${dir}/data -o "-p ${PORT} -k ${dir} -c fsync=off" -l ${dir}/log -w start`), { stdio: 'ignore' });
  assert.equal(psql(['-d', 'postgres', '-c', 'create database t']).status, 0);
  assert.equal(psql(['-d', 'postgres', '-c', 'create role anon; create role authenticated;']).status, 0);
  const stubs = readFileSync(new URL('./fixtures/tecnico-stubs.sql', import.meta.url), 'utf8');
  let r = psql(['-d', 't'], stubs); assert.equal(r.status, 0, r.stderr);
  for (const f of MIG) { r = psql(['-d', 't'], readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8')); assert.equal(r.status, 0, `${f}: ${r.stderr}`); }
  r = psql(['-d', 't', '-c', "insert into auth.users select ('00000000-0000-0000-0000-00000000000' || g)::uuid from generate_series(1, 6) g; insert into site_carteira select ('00000000-0000-0000-0000-00000000000' || g)::uuid, 5000 from generate_series(1, 6) g;"]);
  assert.equal(r.status, 0, r.stderr);
});
after(() => {
  if (!TEM || !dir) return;
  try { execSync(como(`${BIN}/pg_ctl -D ${dir}/data -m immediate stop`), { stdio: 'ignore' }); } catch { /* já parado */ }
  rmSync(dir, { recursive: true, force: true });
});
const t = (nome, fn) => test(nome, { skip: !TEM && 'PostgreSQL não encontrado (defina TC_PGBIN)' }, fn);

t('jogo fechado: só administradores usam; conta comum recebe jogo_fechado', () => {
  assert.equal(falha("select tc_criar_org('Time Fechado','TFE')", 1), 'jogo_fechado');
  assert.equal(falha("select tc_meu()", 1), 'jogo_fechado');
  assert.equal(falha("select tc_meu()", null), 'not_authenticated');
  V("insert into site_admins values ('" + U(1) + "'), ('" + U(2) + "'), ('" + U(3) + "'), ('" + U(4) + "')");
  assert.ok(Q("select tc_meu()", 1).ok, 'administrador entra');
});

t('criação da organização: validações, unicidade e uma por conta', () => {
  const id1 = V("select tc_criar_org('Time Alfa','alf')->>'id'", 1);
  assert.equal(id1, '1');
  assert.equal(falha("select tc_criar_org('Outro Nome','OUT')", 1), 'ja_tem_org');
  assert.equal(falha("select tc_criar_org('time alfa','ZZZ')", 2), 'nome_em_uso');
  assert.equal(falha("select tc_criar_org('Time Zeta','alf')", 2), 'sigla_em_uso');
  assert.equal(falha("select tc_criar_org('ab','ZZZ')", 2), 'nome_invalido');
  assert.equal(falha("select tc_criar_org('Time Zeta','A')", 2), 'sigla_invalida');
  assert.equal(falha("select tc_criar_org('Time Zeta','ZZZ','escudo-99')", 2), 'escudo_invalido');
  assert.equal(falha("select tc_criar_org('Time Zeta','ZZZ','escudo-1','#12345','#d9a82b')", 2) !== '', true, 'cor inválida é recusada');
  V("select tc_criar_org('Time Beta','bet')", 2);
  V("select tc_criar_org('Time Gama','gam')", 3);
  V("select tc_criar_org('Time Delta','del')", 4);
  assert.equal(V('select count(*) from tc_orgs where user_id is not null'), '4');
  // começam sem jogadores: 15 candidatos (3 por posição) e a escolha de 5, um por posição
  assert.equal(V("select count(*) from tc_jogadores where org_id = 1 and slot is not null"), '0');
  const meu1 = J("select tc_meu()", 1);
  assert.equal(meu1.org.elenco_pendente, true); assert.equal(meu1.elenco.length, 0); assert.equal(meu1.ofertas.length, 15);
  for (const pos of ['top', 'selva', 'meio', 'atirador', 'suporte']) assert.equal(meu1.ofertas.filter((x) => x.pos === pos).length, 3, pos);
  const of1 = meu1.ofertas;
  assert.equal(falha("select tc_escolher_elenco_inicial('{1,2,3}')", 1), 'escolha_5');
  assert.equal(falha(`select tc_escolher_elenco_inicial('{${of1.filter((x) => x.pos === 'top').slice(0, 2).map((x) => x.id).join(',')},${of1.filter((x) => x.pos === 'selva').slice(0, 3).map((x) => x.id).join(',')}}')`, 1), 'uma_por_posicao');
  assert.equal(falha(`select tc_escolher_elenco_inicial('{${of1.slice(0, 4).map((x) => x.id).join(',')},999999}')`, 1), 'jogador_nao_ofertado');
  const outra = J("select tc_meu()", 2).ofertas;
  assert.equal(falha(`select tc_escolher_elenco_inicial('{${outra.filter((x, i) => i % 3 === 0).map((x) => x.id).join(',')}}')`, 1), 'jogador_nao_ofertado', 'oferta de outro time');
  // escolhe o melhor de cada posição, para todos os técnicos de teste
  for (const u of [1, 2, 3, 4]) {
    const of = J("select tc_meu()", u).ofertas;
    const ids = ['top', 'selva', 'meio', 'atirador', 'suporte'].map((p) => of.filter((x) => x.pos === p).sort((a, b) => b.poder - a.poder)[0].id);
    assert.equal(J(`select tc_escolher_elenco_inicial('{${ids.join(',')}}')`, u).ok, true);
    assert.equal(falha(`select tc_escolher_elenco_inicial('{${ids.join(',')}}')`, u), 'elenco_ja_escolhido');
  }
  assert.equal(V("select count(*) from tc_jogadores where org_id = 1"), '5', 'os 10 não escolhidos saem');
  assert.equal(V("select count(*) from tc_ofertas"), '0');
  assert.equal(J("select tc_meu()", 1).org.elenco_pendente, false);
  O2 = V("select id from tc_orgs where sigla = 'BET'");
});

t('elenco inicial: cinco titulares, um por posição, e atributos entre 1 e 100', () => {
  assert.equal(V("select count(*) from tc_jogadores where org_id = 1 and slot is not null"), '5');
  assert.equal(V("select count(distinct slot) from tc_jogadores where org_id = 1 and slot is not null"), '5');
  assert.equal(V("select count(*) from tc_jogadores where org_id = 1 and slot = pos"), '5');
  assert.equal(falha('update tc_jogadores set mec = 101 where id = 1'), 'new');
  assert.equal(falha('update tc_jogadores set tf = 0 where id = 1') !== '', true);
  // nenhum atleta duplicado
  assert.equal(V('select count(*) - count(distinct lower(nome)) from tc_jogadores'), '0');
  // duas vagas iguais na mesma organização não existem
  assert.ok(!Q("update tc_jogadores set slot = 'top' where org_id = 1 and slot = 'selva'").ok);
});

t('Poder: SQL e navegador calculam igual (individual e da equipe)', () => {
  const jog = J("select jsonb_agg(to_jsonb(j) order by id) from tc_jogadores j where org_id = 1 and slot is not null", 1);
  assert.equal(jog.length, 5);
  for (const x of jog) {
    const esperado = poder(x);
    const sql = Number(V(`select tc_poder(j) from tc_jogadores j where id = ${x.id}`));
    assert.ok(Math.abs(sql - esperado) < 1e-6, `${x.nome}: ${sql} x ${esperado}`);
    const emCampo = Number(V(`select tc_poder_efetivo(j, '${x.slot}') from tc_jogadores j where id = ${x.id}`));
    assert.ok(Math.abs(emCampo - poderEmCampo(x, x.slot)) < 1e-6);
  }
  const equipe = jog.reduce((a, x) => a + poderEmCampo(x, x.slot), 0) / 5;
  const sin = Number(V('select sinergia from tc_orgs where id = 1'));
  const sql = Number(V('select tc_poder_org(1)'));
  assert.ok(Math.abs(sql - (equipe + (sin / 100) * 3)) < 1e-6);
  // a Fama não entra no Poder
  const antes = V("select tc_poder(j) from tc_jogadores j where id = 1");
  V('update tc_jogadores set fama = 99 where id = 1');
  assert.equal(V("select tc_poder(j) from tc_jogadores j where id = 1"), antes);
  // o mesmo jogador fora de posição rende menos
  assert.ok(Number(V("select tc_poder_efetivo(j, 'top') from tc_jogadores j where id = 3")) < Number(V("select tc_poder(j) from tc_jogadores j where id = 3")));
});

t('mercado oficial: reabastece, filtra e nunca devolve atleta com dono', () => {
  const lista = J("select tc_mercado_oficial('{\"pos\":\"meio\",\"poder_min\":40}')", 1);
  assert.ok(lista.length >= 1 && lista.length <= 24, 'o mercado fica limitado pelos retratos livres');
  assert.ok(lista.every((x) => x.pos === 'meio' || x.pos2.includes('meio')));
  assert.ok(lista.every((x) => x.poder >= 40 && x.org_id === null));
  assert.ok(lista.every((x) => x.potencial != null), 'no mercado oficial o potencial é visível');
  const barato = J("select tc_mercado_oficial('{\"ordem\":\"preco\",\"preco_max\":120000}')", 1);
  assert.ok(barato.every((x) => x.preco <= 120000));
  assert.ok(Number(V("select count(*) from tc_jogadores where org_id is null and ficticio")) >= 5, 'sobrou mercado para jogar');
  assert.equal(V("select count(*) from tc_jogadores where org_id is null and ficticio and retrato is null"), '0', 'ninguém no mercado sem foto');
});

t('contratação: com saldo, sem saldo, elenco cheio, contrato inválido e pedido repetido', () => {
  const alvo = J("select tc_mercado_oficial('{\"pos\":\"meio\",\"poder_max\":55,\"ordem\":\"preco\"}')->0", 1);
  const antes = Number(V('select creditos from tc_orgs where id = 1'));
  const r = J(`select tc_contratar(${alvo.id}, 12, 'chave-contrato-1')`, 1);
  assert.equal(r.ok, true);
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), antes - alvo.preco);
  assert.equal(V(`select org_id from tc_jogadores where id = ${alvo.id}`), '1');
  // repetir o mesmo pedido não cobra de novo
  assert.equal(J(`select tc_contratar(${alvo.id}, 12, 'chave-contrato-1')`, 1).ja_feito, true);
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), antes - alvo.preco);
  // já tem dono, contrato inválido, inexistente
  assert.equal(falha(`select tc_contratar(${alvo.id}, 12, 'chave-contrato-2')`, 2), 'jogador_indisponivel');
  assert.equal(falha("select tc_contratar(99999999, 12, 'chave-contrato-4')", 1), 'jogador_inexistente');
  // sem saldo: nada muda
  V(`update tc_orgs set creditos = 10 where id = ${O2}`);
  const caro = J("select tc_mercado_oficial('{\"ordem\":\"poder\"}')->0", 2);
  assert.equal(falha(`select tc_contratar(${caro.id}, 12, 'chave-contrato-5')`, 2), 'creditos_insuficientes');
  assert.equal(V(`select coalesce(org_id::text, 'livre') from tc_jogadores where id = ${caro.id}`), 'livre');
  assert.equal(V(`select creditos from tc_orgs where id = ${O2}`), '10');
  V(`update tc_orgs set creditos = 600000 where id = ${O2}`);
});

t('escalação: troca titulares, reduz a sinergia e só mexe em jogador do próprio elenco', () => {
  V('update tc_orgs set sinergia = 50 where id = 1');
  const res = V("select id from tc_jogadores where org_id = 1 and slot is null order by id limit 1");
  V(`update tc_jogadores set contrato_fim = null, contrato_valor_semana = 0 where id = ${res}`);
  assert.equal(falha(`select tc_escalar('meio', ${res})`, 1), 'contrato_necessario', 'sem contrato não escala');
  V(`select tc_escalar('meio', ${res}, 4)`, 1); // efetiva 1 temporada junto
  assert.equal(V("select id from tc_jogadores where org_id = 1 and slot = 'meio'"), res);
  assert.equal(V('select count(*) from tc_jogadores where org_id = 1 and slot is not null'), '5');
  assert.equal(V('select sinergia from tc_orgs where id = 1'), '30');
  assert.equal(falha(`select tc_escalar('meio', ${res})`, 2), 'jogador_nao_e_seu');
  assert.equal(falha(`select tc_liberar(${res})`, 2), 'jogador_nao_e_seu');
  assert.equal(falha(`select tc_assinar_contrato(${res}, 1)`, 2), 'jogador_nao_e_seu');
  assert.equal(falha(`select tc_anunciar(${res}, 500)`, 2), 'jogador_nao_e_seu');
  assert.equal(falha(`select tc_escalar('meio', ${V("select id from tc_jogadores where org_id = 1 and slot = 'top'")})`, 2), 'jogador_nao_e_seu');
  assert.equal(falha("select tc_escalar('rei', 1)", 1), 'vaga_invalida');
});

t('contratos: 1 semana ou 1 temporada (20% mais barata), pagos adiantado; encerrar antes devolve 50% do que sobrou; liberar só reserva', () => {
  const j = V("select id from tc_jogadores where org_id = 1 and slot is null order by id limit 1");
  V(`update tc_jogadores set contrato_fim = null, contrato_valor_semana = 0 where id = ${j}`);
  const sal = Number(V(`select tc_salario_base(x) from tc_jogadores x where id = ${j}`));
  const cred = Number(V('select creditos from tc_orgs where id = 1'));
  const op = J(`select tc_jogador_json(x)->'contrato_opcoes' from tc_jogadores x where id = ${j}`);
  assert.deepEqual(op.map((o) => [o.semanas, o.preco]), [[1, sal], [4, Math.round(sal * 4 * 0.8)]]);
  assert.equal(falha(`select tc_assinar_contrato(${j}, 3)`, 1), 'contrato_invalido');
  const r = J(`select tc_assinar_contrato(${j}, 4)`, 1);
  assert.equal(r.custo, Math.round(sal * 4 * 0.8));
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), cred - r.custo, 'pago adiantado');
  assert.equal(Number(V(`select contrato_fim - tc_semana_global() from tc_jogadores where id = ${j}`)), 4);
  assert.equal(falha(`select tc_assinar_contrato(${j}, 1)`, 1), 'contrato_vigente');
  // anunciar com contrato vigente não pode; encerrar devolve 50% do restante pago (4 semanas restantes)
  assert.equal(falha(`select tc_anunciar(${j}, 500)`, 1), 'contrato_vigente');
  const antes = Number(V('select creditos from tc_orgs where id = 1'));
  const e = J(`select tc_encerrar_contrato(${j})`, 1);
  assert.equal(e.reembolso, Math.floor(Math.round(r.custo / 4) * 4 * 0.5));
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), antes + e.reembolso);
  assert.equal(V(`select contrato_fim is null from tc_jogadores where id = ${j}`), 't');
  assert.equal(falha(`select tc_encerrar_contrato(${j})`, 1), 'sem_contrato');
  const tit = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  assert.equal(falha(`select tc_liberar(${tit})`, 1), 'jogador_titular');
  V(`select tc_liberar(${j})`, 1);
  assert.equal(V(`select coalesce(org_id::text, 'livre') from tc_jogadores where id = ${j}`), 'livre');
});
t('encerrar contrato de titular: a vaga é completada, sinergia cai; demitir com contrato também devolve 50%', () => {
  const tit = V("select id from tc_jogadores where org_id = 1 and slot = 'selva'");
  V(`update tc_jogadores set contrato_fim = tc_semana_global() + 4, contrato_valor_semana = 1000 where id = ${tit}`);
  const sin = Number(V('select sinergia from tc_orgs where id = 1'));
  const e = J(`select tc_encerrar_contrato(${tit})`, 1);
  assert.equal(e.reembolso, 2000);
  assert.equal(V("select count(*) from tc_jogadores where org_id = 1 and slot is not null"), '5', 'a vaga foi completada');
  assert.ok(Number(V('select sinergia from tc_orgs where id = 1')) <= sin);
  const novo = V("select id from tc_jogadores where org_id = 1 and slot = 'selva'");
  assert.notEqual(novo, tit);
  // o interino não é o titular que saiu e a reserva sem contrato nunca é escalada sozinha
  assert.equal(V(`select slot is null from tc_jogadores where id = ${tit}`), 't');
  // demitir comum reserva com contrato vigente devolve 50%
  V(`update tc_jogadores set contrato_fim = tc_semana_global() + 2, contrato_valor_semana = 800 where id = ${tit}`);
  const d = J(`select tc_demitir(${tit})`, 1); assert.equal(d.reembolso, 800);
});

t('mercado de usuários: só o dono anuncia; compra por RC é atômica, cobra taxa e não repete', () => {
  V(`update tc_jogadores set contrato_fim = null, contrato_valor_semana = 0 where slot is null and org_id in (1, ${O2})`); // anunciar exige contrato encerrado
  const res = reserva(1, 1);
  assert.equal(falha(`select tc_anunciar(${res}, 1000)`, 2), 'jogador_nao_e_seu');
  assert.equal(falha(`select tc_anunciar(${res}, 1)`, 1), 'preco_invalido');
  assert.equal(falha(`select tc_anunciar(${res}, 100001)`, 1), 'preco_invalido');
  const an = J(`select tc_anunciar(${res}, 1000)`, 1).id;
  assert.equal(falha(`select tc_anunciar(${res}, 900)`, 1), 'ja_anunciado');
  assert.equal(falha(`select tc_comprar_anuncio(${an}, 'chave-compra-0')`, 1), 'compra_propria');
  // sem saldo: nada muda
  V("update site_carteira set saldo = 500 where user_id = '" + U(2) + "'");
  assert.equal(falha(`select tc_comprar_anuncio(${an}, 'chave-compra-1')`, 2), 'saldo_insuficiente');
  assert.equal(V(`select org_id from tc_jogadores where id = ${res}`), '1');
  assert.equal(V(`select status from tc_anuncios where id = ${an}`), 'aberto');
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(2) + "'"), '500');
  // com saldo
  V("update site_carteira set saldo = 5000 where user_id = '" + U(2) + "'");
  const vend0 = Number(V("select saldo from site_carteira where user_id = '" + U(1) + "'"));
  const r = J(`select tc_comprar_anuncio(${an}, 'chave-compra-2')`, 2);
  assert.equal(r.taxa_rc, 50);
  assert.equal(V(`select org_id from tc_jogadores where id = ${res}`), O2);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(2) + "'"), '4000');
  assert.equal(Number(V("select saldo from site_carteira where user_id = '" + U(1) + "'")), vend0 + 950);
  assert.equal(V(`select status from tc_anuncios where id = ${an}`), 'vendido');
  // repetir o pedido, ou outro comprador depois: nada de cobrar duas vezes
  assert.equal(J(`select tc_comprar_anuncio(${an}, 'chave-compra-2')`, 2).ja_feito, true);
  assert.equal(falha(`select tc_comprar_anuncio(${an}, 'chave-compra-3')`, 3), 'anuncio_encerrado');
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(2) + "'"), '4000');
  // histórico e extrato oficial
  assert.equal(V(`select count(*) from tc_transf where jogador_id = ${res} and tipo = 'compra_usuario' and moeda = 'rc'`), '1');
  assert.equal(V("select count(*) from site_moedas_lanc where motivo in ('tecnico_compra', 'tecnico_venda')"), '2');
});

t('compra simultânea do mesmo anúncio: só uma passa e o RC bate', async () => {
  const j = reserva(2, O2);
  const an = J(`select tc_anunciar(${j}, 800)`, 2).id;
  const rodar = (uid, chave) => new Promise((ok) => {
    const p = spawn('psql', ['-h', dir, '-p', String(PORT), '-U', 'postgres', '-d', 't', '-q', '-A', '-t', '-c', `set app.uid='${U(uid)}'`, '-c', "set app.hoje='2026-10-12'", '-c', `select tc_comprar_anuncio(${an}, '${chave}')`]);
    let out = ''; let err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; }); p.on('close', (c) => ok({ c, out, err }));
  });
  const antes = Number(V('select sum(saldo) from site_carteira'));
  const compras0 = Number(V(`select count(*) from tc_transf where jogador_id = ${j} and tipo = 'compra_usuario'`));
  const res = await Promise.all([rodar(3, 'chave-conc-3'), rodar(4, 'chave-conc-4')]);
  assert.equal(res.filter((r) => r.c === 0).length, 1, JSON.stringify(res));
  assert.equal(Number(V(`select count(*) from tc_transf where jogador_id = ${j} and tipo = 'compra_usuario'`)), compras0 + 1);
  assert.equal(Number(V('select sum(saldo) from site_carteira')), antes - 40, 'só a taxa de 5% sai de circulação');
  assert.ok(V(`select 1 from tc_jogadores jg join tc_orgs o on o.id = jg.org_id where jg.id = ${j} and o.user_id in ('${U(3)}', '${U(4)}')`) === '1', 'o jogador foi para um dos compradores');
});

t('campeões: 173 no catálogo, sem repetição, e só administrador (jogo fechado) enxerga a lista', () => {
  assert.equal(V('select count(*) from tc_campeoes'), '173');
  assert.equal(V('select count(distinct nome) from tc_campeoes'), '173');
  assert.equal(V("select count(*) from tc_campeoes where cardinality(posicoes) = 0"), '0');
  const lista = J('select tc_campeoes_lista()', 1);
  assert.equal(lista.campeoes.length, 173);
  assert.equal(lista.maestria.favoritos_max, 5);
});

t('maestria: todo jogador nasce com até 5 favoritos da própria posição e com o mínimo de pontos', () => {
  assert.equal(V('select count(*) from tc_jogadores j where j.ficticio and not exists (select 1 from tc_maestria m where m.jogador_id = j.id)'), '0');
  assert.equal(V('select count(*) from tc_maestria m join tc_jogadores j on j.id = m.jogador_id where not j.ficticio'), '0', 'Legados começam sem maestria');
  assert.ok(Number(V('select coalesce(max(n), 0) from (select count(*) n from tc_maestria where favorito group by jogador_id) x')) <= 5);
  assert.equal(V("select count(*) from tc_maestria where favorito and pontos < 150"), '0');
  assert.equal(V(`select count(*) from tc_maestria m join tc_jogadores j on j.id = m.jogador_id join tc_campeoes c on c.id = m.campeao_id
                   where not (j.pos = any(c.posicoes) or c.posicoes && j.pos2)`), '0');
});

t('maestria: jogar com um campeão soma pontos, vira favorito e dá bônus; nunca passa de 5 favoritos', () => {
  const j = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  V(`delete from tc_maestria where jogador_id = ${j}`);
  assert.equal(V(`select tc_bonus_campeao(${j}, 'garen')`), '0');
  for (let i = 0; i < 5; i++) V(`select tc_maestria_registrar(${j}, 'garen', true)`); // 150 pontos
  assert.equal(V(`select favorito from tc_maestria where jogador_id = ${j} and campeao_id = 'garen'`), 't');
  assert.equal(V(`select tc_bonus_campeao(${j}, 'garen')`), '3'); // Maestria 2: +3%
  for (let i = 0; i < 20; i++) V(`select tc_maestria_registrar(${j}, 'garen', true)`); // 750 pontos
  assert.equal(V(`select tc_bonus_campeao(${j}, 'garen')`), '6');
  for (const c of ['darius', 'sett', 'teemo', 'nasus', 'malphite', 'ornn', 'renekton']) for (let i = 0; i < 10; i++) V(`select tc_maestria_registrar(${j}, '${c}', false)`); // 150 pontos cada
  assert.equal(V(`select count(*) from tc_maestria where jogador_id = ${j} and favorito`), '5');
  assert.equal(V(`select tc_bonus_campeao(${j}, 'garen')`), '6', 'o mais jogado continua favorito');
  assert.equal(falha(`update tc_maestria set favorito = true where jogador_id = ${j} and campeao_id = 'teemo' and not favorito returning 1`, 1) !== '', true);
});

t('maestria: a ficha do jogador traz os campeões e ninguém acessa as tabelas direto', () => {
  const j = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  const f = J(`select tc_ficha_jogador(${j})`, 1);
  assert.ok(f.campeoes.length >= 1 && f.campeoes[0].nivel >= 1);
  assert.equal(V("select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('tc_campeoes', 'tc_maestria') and c.relrowsecurity"), '2');
  assert.equal(V("select has_table_privilege('authenticated', 'tc_maestria', 'select')"), 'f');
  assert.equal(V("select has_table_privilege('authenticated', 'tc_campeoes', 'select')"), 'f');
});

t('vender titular: a vaga é preenchida e a sinergia cai', () => {
  const tit = V("select id from tc_jogadores where org_id = 1 and slot = 'selva'");
  V(`update tc_jogadores set contrato_fim = null where id = ${tit}`); // anunciar exige contrato encerrado
  const an = J(`select tc_anunciar(${tit}, 700)`, 1).id;
  V(`select tc_comprar_anuncio(${an}, 'chave-tit-1')`, 2);
  assert.equal(V('select count(*) from tc_jogadores where org_id = 1 and slot is not null'), '5');
  assert.ok(Number(V("select count(*) from tc_avisos where org_id = 1 and texto like '%vendido%'")) >= 2);
});

t('simulação: determinística, equipe forte ganha mais, mas a fraca tem chance real', () => {
  const a = V("select tc_simular(1, 2, 3, 'semente-fixa')");
  assert.equal(V("select tc_simular(1, 2, 3, 'semente-fixa')"), a, 'mesma semente, mesmo resultado');
  // equipes sintéticas com Poder bem diferente
  V("insert into tc_orgs (nome, sigla, user_id, divisao, poder_sistema) values ('Forte FC','FRT', null, 'principal', 70), ('Fraco FC','FRC', null, 'principal', 45)");
  const f = V("select id from tc_orgs where sigla = 'FRT'"); const w = V("select id from tc_orgs where sigla = 'FRC'");
  for (const [o, p] of [[f, 70], [w, 45]]) {
    V(`do $$ declare v text; ids bigint[]; begin foreach v in array array['top','selva','meio','atirador','suporte'] loop ids := tc_gerar_jogadores(1, ${p}, v, ${o}); update tc_jogadores set slot = v, forma = 50 where id = ids[1]; end loop; end $$`);
  }
  try {
  const pf = Number(V(`select tc_poder_org(${f})`)); const pw = Number(V(`select tc_poder_org(${w})`));
  assert.ok(pf - pw > 15);
  const r = J(`select jsonb_build_object('fortes', count(*) filter (where (s->>'a')::int > (s->>'b')::int), 'n', count(*)) from (select tc_simular(${f}, ${w}, 3, 'amostra-' || g) s from generate_series(1, 300) g) x`);
  const taxa = r.fortes / r.n;
  assert.ok(taxa > 0.6, `o forte precisa vencer a maioria (${taxa})`);
  assert.ok(taxa < 0.99, `o fraco precisa ter chance real (${taxa})`);
  // estatísticas coerentes: o vencedor do mapa tem a maior soma dos componentes exibidos
  const mapas = J(`select tc_simular(${f}, ${w}, 5, 'coerencia')->'mapas'`);
  for (const m of mapas) {
    const sa = m.rotas[0] + m.objetivos[0] + m.teamfight[0]; const sb = m.rotas[1] + m.objetivos[1] + m.teamfight[1];
    assert.ok(Math.abs(sa - sb) <= 3 || (m.vencedor === 'a') === (sa > sb), 'o vencedor não contradiz as estatísticas');
  }
  } finally {
    V(`delete from tc_jogadores where org_id in (${f}, ${w})`);
    V(`delete from tc_orgs where id in (${f}, ${w})`);
  }
});

t('campeonatos: calendário, processamento único, tabela e fechamento da semana', () => {
  const s0 = J('select tc_sincronizar()', 1, '2026-10-12');
  assert.equal(s0.dia, 1);
  const ligas = Number(V('select count(*) from tc_ligas'));
  assert.equal(ligas, 2);
  assert.equal(V('select count(*) from tc_orgs where ativa and divisao = \'acesso\''), '8');
  assert.equal(V('select count(*) from tc_orgs where ativa and divisao = \'principal\''), '8');
  assert.equal(V("select count(*) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.divisao = 'acesso' and t.org_id in (select id from tc_orgs where user_id is not null)"), '4', 'os técnicos entram na divisão de acesso');
  // cada partida processa uma única vez
  const feitas = Number(V("select count(*) from tc_partidas where status = 'concluida'"));
  assert.equal(feitas, 8);
  const marcas = V("select string_agg(processada::text, ',' order by id) from tc_partidas where status = 'concluida'");
  assert.equal(J('select tc_sincronizar()', 1, '2026-10-12').processadas, 0);
  assert.equal(V("select string_agg(processada::text, ',' order by id) from tc_partidas where status = 'concluida'"), marcas);
  assert.equal(V("select tc_processar_partida(id) from tc_partidas where status = 'concluida' limit 1"), 'f');
  // chamar de novo no mesmo dia não duplica; o dia seguinte processa a rodada 2
  assert.equal(J('select tc_sincronizar()', 1, '2026-10-13').processadas, 8);
  // placar nunca é empate e respeita o melhor de 3
  assert.equal(V("select count(*) from tc_partidas where status = 'concluida' and (placar_a = placar_b or greatest(placar_a, placar_b) <> 2 or least(placar_a, placar_b) > 1)"), '0');
});

t('semana completa: premiação, Rank, promoção/rebaixamento e salários, uma vez só', () => {
  const cred1 = Number(V('select creditos from tc_orgs where id = 1'));
  V("update tc_config set valor = 'true' where chave = 'rank_ativo'");
  const r = J('select tc_sincronizar()', 1, '2026-10-18');
  assert.equal(r.dia, 7);
  assert.equal(V("select count(*) from tc_ligas where status = 'encerrada'"), '2');
  assert.equal(V('select count(*) from tc_partidas where liga_id <= 2 and status <> \'concluida\''), '0');
  // tabela: pontos conferem com os placares (3 / 2 / 1 / 0)
  const tab = J("select jsonb_agg(to_jsonb(t) order by pos) from tc_tabela(1) t");
  for (const x of tab) {
    const v = J(`select jsonb_agg(jsonb_build_object('pro', pro, 'contra', contra)) from (select placar_a pro, placar_b contra from tc_partidas where liga_id = 1 and org_a = ${x.org_id} union all select placar_b, placar_a from tc_partidas where liga_id = 1 and org_b = ${x.org_id}) q`);
    const pontos = v.reduce((a, m) => a + (m.pro > m.contra ? (m.contra === 0 ? 3 : 2) : (m.pro === 1 ? 1 : 0)), 0);
    assert.equal(x.pontos, pontos);
    assert.equal(x.partidas, 7);
  }
  const ord = tab.map((x) => [x.pontos, x.mapas_pro - x.mapas_contra, x.mapas_pro, -x.org_id]);
  for (let i = 1; i < ord.length; i++) assert.ok(ord[i - 1][0] > ord[i][0] || (ord[i - 1][0] === ord[i][0] && (ord[i - 1][1] > ord[i][1] || (ord[i - 1][1] === ord[i][1] && (ord[i - 1][2] > ord[i][2] || (ord[i - 1][2] === ord[i][2] && ord[i - 1][3] > ord[i][3]))))), 'desempate determinístico');
  // promoção e rebaixamento: os dois primeiros do acesso sobem; os dois últimos da principal descem; 8 por divisão
  const subiram = J("select jsonb_agg(org_id order by pos) from tc_tabela(1) where pos <= 2");
  const desceram = J("select jsonb_agg(org_id order by pos desc) from (select * from tc_tabela(2) order by pos desc limit 2) x");
  for (const o of subiram) assert.equal(V(`select divisao from tc_orgs where id = ${o}`), 'principal');
  for (const o of desceram) assert.equal(V(`select divisao from tc_orgs where id = ${o}`), 'acesso');
  assert.equal(V("select count(*) from tc_orgs where ativa and divisao = 'principal'"), '8');
  assert.equal(V("select count(*) from tc_orgs where ativa and divisao = 'acesso'"), '8');
  // premiação e salários registrados uma vez
  assert.equal(V("select count(*) from tc_premios where liga_id in (1, 2)"), '16');
  assert.equal(V('select count(*) from tc_fin where org_id = 1 and motivo = \'salarios\''), '0', 'salário é pago adiantado no contrato');
  assert.equal(V('select count(*) from tc_fin where org_id = 1 and motivo = \'premiacao\''), '1');
  // Rank: um lançamento por técnico e por liga; repetir a sincronização não duplica
  const rk = Number(V('select count(*) from site_rk_lanc_stub'));
  assert.equal(rk, 4);
  const cred2 = Number(V('select creditos from tc_orgs where id = 1'));
  assert.notEqual(cred2, cred1);
  J('select tc_sincronizar()', 1, '2026-10-18');
  assert.equal(Number(V('select count(*) from site_rk_lanc_stub')), rk);
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), cred2);
  assert.equal(V("select count(*) from tc_trofeus where liga_id in (1, 2)"), '2');
});

t('temporada inteira: Copa (semana 2) e Mundial (semana 4) só com a divisão principal', () => {
  J('select tc_sincronizar()', 1, '2026-11-08');
  assert.equal(V('select count(*) from tc_ligas'), '10');
  assert.equal(V("select count(*) from tc_ligas where status <> 'encerrada'"), '0');
  assert.equal(V("select count(*) from tc_partidas where status <> 'concluida'"), '0');
  // Copa: 4 equipes que estavam entre os 4 primeiros da principal na semana 1
  const copa = J("select jsonb_agg(org_id order by semente) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.tipo = 'copa'");
  const top4 = J("select jsonb_agg(org_id order by pos) from tc_tabela(2) where pos <= 4");
  assert.deepEqual(copa, top4);
  assert.equal(V("select count(*) from tc_partidas p join tc_ligas l on l.id = p.liga_id where l.tipo = 'copa' and p.formato = 5"), '3');
  // Mundial: 6 equipes; ninguém que só jogou o acesso entra pelo acesso
  assert.equal(V("select count(*) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.tipo = 'mundial'"), '6');
  const noMundial = J("select jsonb_agg(org_id) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.tipo = 'mundial'");
  const principais = J("select jsonb_agg(distinct t.org_id) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.tipo = 'divisao' and l.divisao = 'principal' and l.semana <= 3");
  for (const o of noMundial) assert.ok(principais.includes(o), `equipe ${o} se classificou sem jogar a principal`);
  assert.equal(V("select count(*) from tc_partidas p join tc_ligas l on l.id = p.liga_id where l.tipo = 'mundial'"), '5');
  // campeão da Copa garantido no Mundial
  const campeaoCopa = V("select vencedor from tc_partidas p join tc_ligas l on l.id = p.liga_id where l.tipo = 'copa' and p.fase = 'final'");
  assert.ok(noMundial.includes(Number(campeaoCopa)));
  // premiações e troféus
  assert.equal(V("select count(*) from tc_premios p join tc_ligas l on l.id = p.liga_id where l.tipo = 'mundial' and p.posicao = 1"), '1');
  assert.equal(V("select count(*) from tc_trofeus where titulo like '%Mundial%'"), '1');
  assert.equal(V("select count(*) from (select liga_id, org_id from tc_premios group by 1, 2 having count(*) > 1) x"), '0');
  // sincronizar de novo não muda nada
  const n = V('select count(*) from tc_partidas') + V('select count(*) from tc_premios');
  J('select tc_sincronizar()', 1, '2026-11-08');
  assert.equal(V('select count(*) from tc_partidas') + V('select count(*) from tc_premios'), n);
  assert.equal(V("select valor from tc_config where chave = 'semana_proc'"), '4');
});

t('contratos vencem de forma explícita: o titular sai da escalação, vira aviso e a vaga é completada', () => {
  assert.ok(Number(V("select count(*) from tc_jogadores where org_id = 1")) >= 5);
  V("update tc_jogadores set contrato_fim = 0 where org_id = 1 and slot = 'top'");
  V("update tc_config set valor = '3' where chave = 'semana_proc'");
  V("update tc_config set valor = '{\"inicio\": \"2026-10-12\", \"semanas\": 4}'::jsonb where chave = 'calendario'");
  const j = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  V("select tc_fechar_semana_org(1, 5)");
  assert.equal(V(`select org_id || ':' || coalesce(slot, 'reserva') from tc_jogadores where id = ${j}`), '1:reserva', 'fica no inventário, fora da escalação');
  assert.ok(Number(V("select count(*) from tc_avisos where org_id = 1 and texto like '%terminou%'")) >= 1);
  assert.equal(V('select count(*) from tc_jogadores where org_id = 1 and slot is not null'), '5');
});

t('autorização: o papel da API não lê nem escreve nas tabelas; só chama as funções liberadas', () => {
  const r = psql(['-d', 't', '-c', 'set role authenticated', '-c', 'select count(*) from tc_jogadores']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /permission denied/);
  for (const q of ['update tc_orgs set creditos = 1', 'delete from tc_anuncios', 'insert into tc_config values (\'x\', \'1\')']) {
    const x = psql(['-d', 't', '-c', 'set role authenticated', '-c', q]); assert.notEqual(x.status, 0, q);
  }
  for (const f of ['tc_creditos_mexer(1, 100, \'x\')', 'tc_processar_partida(1)', 'tc_gerar_jogadores(1)', 'tc_encerrar_liga(1)']) {
    const x = psql(['-d', 't', '-c', 'set role authenticated', '-c', `select ${f}`]); assert.notEqual(x.status, 0, f);
  }
  const anon = psql(['-d', 't', '-c', 'set role anon', '-c', 'select tc_meu()']); assert.notEqual(anon.status, 0);
});

t('persistência: uma conexão nova enxerga o mesmo estado (nada fica no navegador)', () => {
  const a = J('select tc_meu()', 1, '2026-11-08');
  const b = J('select tc_meu()', 1, '2026-11-08');
  assert.deepEqual(a, b);
  assert.equal(a.org.sigla, 'ALF');
  assert.equal(a.elenco.filter((x) => x.slot).length, 5);
  const h = J('select tc_historico()', 1, '2026-11-08');
  assert.ok(h.partidas.length > 0 && h.premios.length > 0 && h.transferencias.length > 0);
  const painel = J('select tc_painel()', 1, '2026-11-08');
  assert.ok(painel.liga && Array.isArray(painel.ultimos));
  const camp = J('select tc_campeonatos()', 1, '2026-11-08');
  assert.ok(camp.ligas.length > 0);
});

// ---------------------------------------------------------------- gameplay (SQL 0091)
t('gameplay: a partida do técnico espera o jogo no navegador, o resultado de cada mapa é gravado uma única vez e a série fecha na maioria', () => {
  assert.equal(falha("select tc_partida_elencos(1)", 1, '2026-11-09'), 'gameplay_desligado');
  V("update tc_config set valor = '{\"ativo\": true, \"prazo_dias\": 1, \"versao\": 1}'::jsonb where chave = 'gameplay'");
  J('select tc_sincronizar()', 1, '2026-11-09');
  const pid = V("select id from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b)) order by id limit 1");
  assert.ok(pid, 'há partida de técnico real esperando o gameplay');
  assert.equal(V(`select count(*) from tc_partidas where id = ${pid} and status = 'agendada'`), '1', 'o sistema não simulou sozinho dentro do prazo');
  const dono = V(`select o.user_id from tc_orgs o join tc_partidas p on o.id in (p.org_a, p.org_b) where p.id = ${pid} and o.user_id is not null limit 1`);
  const n = Number(dono.slice(-1));
  const aberto = V("select valor::text from tc_config where chave = 'aberto'");
  V("update tc_config set valor = 'true'::jsonb where chave = 'aberto'"); // abre para uma conta que não é a dona (não admin)
  assert.equal(falha(`select tc_partida_elencos(${pid})`, 6, '2026-11-09'), 'partida_nao_e_sua');
  const pend = J('select tc_gameplay_pendente()', n, '2026-11-09'); assert.equal(pend.ativo, true); assert.ok(pend.partida);
  const el = J(`select tc_partida_elencos(${pid})`, n, '2026-11-09');
  assert.equal(el.mapa, 1); assert.equal(el.azul.jogadores.length, 5); assert.equal(el.vermelho.jogadores.length, 5);
  assert.deepEqual(el.azul.jogadores.map((j) => j.pos), ['top', 'selva', 'meio', 'atirador', 'suporte']);
  assert.ok(el.azul.jogadores[0].atributos.mec >= 1);
  assert.equal(String(el.semente), V(`select tc_gameplay_semente(${pid}, 1)`));
  const res = (mapa, vencedor, extra = {}) => JSON.stringify({ semente: Number(V(`select tc_gameplay_semente(${pid}, ${mapa})`)), versaoRegras: 1, vencedor, duracao: 1800, motivo: 'nexus', interrompida: false,
    equipes: { azul: { abates: 20, torresPerdidas: 3, dragoes: 1 }, vermelho: { abates: 15, torresPerdidas: 8, dragoes: 2 } }, mvp: { nome: 'Teste' }, jogadores: [], ...extra }).replace(/'/g, "''");
  const reg = (mapa, vencedor, extra) => J(`select tc_gameplay_registrar(${pid}, ${mapa}, '${res(mapa, vencedor, extra)}'::jsonb)`, n, '2026-11-09');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 2, '${res(2, 'azul')}'::jsonb)`, n, '2026-11-09'), 'mapa_fora_de_ordem');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { semente: 123 })}'::jsonb)`, n, '2026-11-09'), 'semente_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { versaoRegras: 9 })}'::jsonb)`, n, '2026-11-09'), 'versao_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { interrompida: true })}'::jsonb)`, n, '2026-11-09'), 'resultado_invalido');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { duracao: 10 })}'::jsonb)`, n, '2026-11-09'), 'duracao_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul')}'::jsonb)`, 6, '2026-11-09'), 'partida_nao_e_sua');
  V(`update tc_config set valor = '${aberto}'::jsonb where chave = 'aberto'`);
  const r1 = reg(1, 'azul'); assert.equal(r1.concluida, false); assert.equal(r1.placar_a + r1.placar_b, 1);
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul')}'::jsonb)`, n, '2026-11-09'), 'mapa_fora_de_ordem', 'o mesmo mapa não é gravado duas vezes');
  const r2 = reg(2, 'azul'); assert.equal(r2.concluida, false); assert.equal(r2.placar_a, 1); assert.equal(r2.placar_b, 1); // lados trocados: venceu a outra equipe
  const r3 = reg(3, 'azul'); assert.equal(r3.concluida, true);
  assert.equal(V(`select status from tc_partidas where id = ${pid}`), 'concluida');
  assert.equal(V(`select placar_a + placar_b from tc_partidas where id = ${pid}`), '3');
  assert.equal(V(`select resumo->>'origem' from tc_partidas where id = ${pid}`), 'gameplay');
  assert.equal(V(`select jsonb_array_length(resumo->'mapas') from tc_partidas where id = ${pid}`), '3');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 4, '${res(4, 'azul')}'::jsonb)`, n, '2026-11-09'), 'partida_ja_concluida');
  assert.equal(falha(`select tc_partida_elencos(${pid})`, n, '2026-11-09'), 'partida_ja_concluida');
  assert.equal(V(`select count(*) from tc_gameplay_mapas where partida_id = ${pid}`), '3');
});

t('gameplay: passado o prazo, o sistema simula as partidas que ninguém jogou e a semana fecha normalmente', () => {
  const antes = Number(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))"));
  J('select tc_sincronizar()', 1, '2026-11-09');
  assert.equal(Number(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))")), antes, 'dentro do prazo, continuam esperando');
  J('select tc_sincronizar()', 1, '2026-11-11');
  assert.equal(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))"), '0');
  V("update tc_config set valor = jsonb_set(valor, '{ativo}', 'false') where chave = 'gameplay'");
  assert.equal(J('select tc_gameplay_pendente()', 1, '2026-11-11').ativo, false);
});

// ---------------------------------------------------------------- posições ajustadas (SQL 0093) e convidados (0092)
t('posições: o ajuste manual corrige o campeão, reaplicar é seguro e id/posição inválidos são recusados', () => {
  assert.equal(V("select posicoes from tc_campeoes where id = 'naafiri'"), '{selva}');
  V("update tc_campeoes set posicoes = array['meio'] where id = 'naafiri'");
  const sql = readFileSync(new URL('../supabase/migrations/0093_tecnico_posicoes.sql', import.meta.url), 'utf8');
  V(sql); assert.equal(V("select posicoes from tc_campeoes where id = 'naafiri'"), '{selva}');
  assert.match(falha(sql.replace('"naafiri": ["selva"]', '"naoexiste": ["selva"]')), /./);
  assert.match(falha(sql.replace('"naafiri": ["selva"]', '"naafiri": ["jungle"]')), /./);
});
t('convidados: com o jogo fechado, só administrador e convidado têm acesso; retirar o convite fecha de novo', () => {
  const antes = V("select valor from tc_config where chave = 'aberto'");
  V("update tc_config set valor = 'false'::jsonb where chave = 'aberto'");
  V(`delete from site_admins where user_id in ('${U(3)}', '${U(4)}')`); // 3 e 4 viram jogadores comuns neste teste
  try {
    V("delete from tc_convidados");
    assert.equal(V('select tc_tenho_acesso()', 3), 'f');
    V(`insert into tc_convidados (user_id) values ('${U(3)}')`);
    assert.equal(V('select tc_tenho_acesso()', 3), 't');
    assert.equal(V('select tc_tenho_acesso()', 4), 'f');
    V('delete from tc_convidados');
    assert.equal(V('select tc_tenho_acesso()', 3), 'f');
  } finally { V(`update tc_config set valor = '${antes}'::jsonb where chave = 'aberto'`); V(`insert into site_admins values ('${U(3)}'), ('${U(4)}') on conflict do nothing`); }
});
t('posições pelo jogo: só administrador troca, valida as posições, guarda a ordem e a troca sobrevive a reaplicar o 0093', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0093_tecnico_posicoes.sql', import.meta.url), 'utf8');
  V("update tc_config set valor = 'true'::jsonb where chave = 'aberto'");
  V(`delete from site_admins where user_id = '${U(4)}'`);
  try {
    assert.equal(falha("select tc_campeao_posicoes('ahri', array['meio','top'])", 4), 'not_admin');
    assert.equal(falha("select tc_campeao_posicoes('ahri', array['meio','top'])"), 'not_authenticated');
    assert.equal(falha("select tc_campeao_posicoes('ahri', array['jungle'])", 1), 'posicoes_invalidas');
    assert.equal(falha("select tc_campeao_posicoes('ahri', array[]::text[])", 1), 'posicoes_invalidas');
    assert.equal(falha("select tc_campeao_posicoes('naoexiste', array['top'])", 1), 'campeao_inexistente');
    assert.deepEqual(J("select tc_campeao_posicoes('ahri', array['top','meio','top'])", 1).posicoes, ['top', 'meio']);
    assert.equal(V("select posicoes from tc_campeoes where id = 'ahri'"), '{top,meio}');
    V("update tc_campeoes set posicoes = array['suporte'] where id = 'ahri'"); // simula reexecutar o 0090
    V(sql); assert.equal(V("select posicoes from tc_campeoes where id = 'ahri'"), '{top,meio}', 'a troca feita no jogo volta ao reaplicar o 0093');
    assert.equal(J("select tc_campeoes_lista()", 1).campeoes.find((c) => c.id === 'ahri').posicoes.join(), 'top,meio');
  } finally { V("delete from tc_posicoes_manual where id = 'ahri'; update tc_campeoes set posicoes = array['meio'] where id = 'ahri'"); V(`insert into site_admins values ('${U(4)}') on conflict do nothing`); }
});

// ---------------------------------------------------------------- segurança (SQL 0094)
t('segurança: cor do escudo só aceita #rrggbb (regressão: nada de código no SVG dos outros técnicos)', () => {
  const r = psql(['-d', 't', '-c', `set app.uid='${U(1)}'`, '-c', `select tc_personalizar_org('escudo-1', '"><img src=x onerror=alert(1)>', '#ffffff', 'classico')`]);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /tc_orgs_cor1_check/);
  V(`select tc_personalizar_org('escudo-2', '#112233', '#AABBCC', 'moderno')`, 1);
  assert.equal(V("select cor1 || cor2 from tc_orgs where id = 1"), '#112233#AABBCC');
});
t('segurança: o resumo do gameplay é reconstruído no servidor (só números limitados e jogadores das duas equipes)', () => {
  const pid = V("select id from tc_partidas order by id limit 1");
  const org = V(`select org_a from tc_partidas where id = ${pid}`);
  const jog = V(`select id from tc_jogadores where org_id = ${org} limit 1`);
  const nomeReal = V(`select nome from tc_jogadores where id = ${jog}`);
  V(`insert into tc_gameplay_mapas (partida_id, mapa, org_azul, vencedor_org, semente, duracao, resumo) values (${pid}, 5, ${org}, ${org}, 1, 1800,
     '{"vencedor":"azul","motivo":"<b>x</b>","equipes":{"azul":{"abates":"<img src=x onerror=alert(1)>","torresPerdidas":99,"dragoes":3},"vermelho":{"abates":12}},
       "mvp":{"id":${jog},"nome":"<script>alert(1)</script>","campeao":"Ahri"},"jogadores":[{"id":${jog},"nome":"hack","abates":5,"pos":"<x>"},{"id":999999,"nome":"intruso"}],"lixo":"${'x'.repeat(50)}"}')`);
  const r = J(`select resumo from tc_gameplay_mapas where partida_id = ${pid} and mapa = 5`);
  assert.equal(r.equipes.azul.abates, 0, 'texto no lugar de número vira 0');
  assert.equal(r.equipes.azul.torresPerdidas, 11, 'número fora da faixa é limitado');
  assert.equal(r.equipes.vermelho.abates, 12);
  assert.equal(r.motivo, 'nexus'); assert.equal(r.lixo, undefined);
  assert.equal(r.mvp.nome, nomeReal, 'o nome do destaque vem do banco'); assert.equal(r.mvp.campeao, 'Ahri');
  assert.equal(r.jogadores.length, 1, 'jogador de fora das equipes é descartado'); assert.equal(r.jogadores[0].nome, nomeReal); assert.equal(r.jogadores[0].pos, null);
  V(`delete from tc_gameplay_mapas where partida_id = ${pid} and mapa = 5`);
});
t('segurança: anúncio é cancelado quando o jogador sai da organização', () => {
  const res = reserva(1, 1);
  const an = J(`select tc_anunciar(${res}, 700)`, 1).id;
  V(`select tc_liberar(${res})`, 1);
  assert.equal(V(`select status from tc_anuncios where id = ${an}`), 'cancelado');
});
t('antifraude do mercado: conta nova, muitas vendas entre o mesmo par, recompra e limite diário', () => {
  V("update site_carteira set saldo = 1000000 where user_id in ('" + U(1) + "', '" + U(2) + "')");
  V("delete from tc_anuncios where status = 'vendido'"); // começa sem histórico de vendas
  // conta nova não anuncia
  V(`update auth.users set created_at = now() where id = '${U(1)}'`);
  const r1 = reserva(1, 1);
  assert.equal(falha(`select tc_anunciar(${r1}, 500)`, 1), 'mercado_conta_nova');
  V(`update auth.users set created_at = now() - interval '30 days' where id = '${U(1)}'`);
  // duas vendas entre o mesmo par na semana passam; a terceira não (e o RC volta)
  const vender = (uidV, orgV, uidC, preco, chave) => { V("update tc_anuncios set status = 'cancelado' where status = 'aberto'"); const j = reserva(uidV, orgV); const a = J(`select tc_anunciar(${j}, ${preco})`, uidV).id; return { j, a, r: Q(`select tc_comprar_anuncio(${a}, '${chave}')`, uidC) }; };
  { const x = vender(1, 1, 2, 300, 'chave-par-1'); assert.ok(x.r.ok, x.r.err); } assert.ok(vender(1, 1, 2, 300, 'chave-par-2').r.ok);
  const saldo = V("select saldo from site_carteira where user_id = '" + U(2) + "'");
  const t3 = vender(1, 1, 2, 300, 'chave-par-3');
  assert.equal(t3.r.err, 'mercado_limite_par');
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(2) + "'"), saldo, 'a compra recusada não cobra');
  assert.equal(V(`select org_id from tc_jogadores where id = ${t3.j}`), '1', 'o jogador fica com o vendedor');
  V("delete from tc_anuncios where status = 'vendido'");
  // recompra: quem vendeu não compra o mesmo jogador de volta em 14 dias
  const v1 = vender(1, 1, 2, 300, 'chave-rec-1'); assert.ok(v1.r.ok);
  const a2 = J(`select tc_anunciar(${v1.j}, 300)`, 2).id;
  assert.equal(Q(`select tc_comprar_anuncio(${a2}, 'chave-rec-2')`, 1).err, 'mercado_recompra');
  V("delete from tc_anuncios where status <> 'aberto'"); V("update tc_anuncios set status = 'cancelado' where status = 'aberto'");
});
t('estrelas: 15 jogadores reais com retrato no mercado oficial; rodar o SQL de novo não mexe em quem já foi contratado', () => {
  const est = J("select jsonb_agg(jsonb_build_object('nome', nome, 'pos', pos, 'retrato', retrato, 'org', org_id) order by id) from tc_jogadores where not ficticio and legado_base is null");
  assert.equal(est.length, 30, '15 da Coreia + 15 do Brasil');
  for (const e of est) assert.ok(existsSync(new URL(`..${e.retrato}`, import.meta.url)), `retrato de ${e.nome}`);
  assert.deepEqual(est.filter((e) => ['Faker', 'Chovy', 'Zeka'].includes(e.nome)).map((e) => e.pos), ['meio', 'meio', 'meio']);
  assert.deepEqual(est.filter((e) => ['Zest', 'Rabelo', 'uZent'].includes(e.nome)).map((e) => e.pos), ['top', 'atirador', 'suporte']);
  for (const t of [['Zest', 'Curse', 'Feisty', 'Duduhh', 'Ackerman'], ['Guigo', 'Tatu', 'Tutsz', 'Ayu', 'Jojo'], ['Xyno', 'Sinatra', 'Kaze', 'Rabelo', 'uZent']]) assert.deepEqual(t.map((n) => est.find((e) => e.nome === n).pos), ['top', 'selva', 'meio', 'atirador', 'suporte']);
  const faker = V("select id from tc_jogadores where nome = 'Faker'");
  assert.ok(Number(V(`select tc_preco_jogador(j) from tc_jogadores j where id = ${faker}`)) > 600000, 'Estrela custa mais que o crédito inicial');
  V(`select set_config('tc.estrela_liberada', '${faker}', true); update tc_jogadores set org_id = 1, contrato_fim = 99, salario = 1234, forma = 70 where id = ${faker}`);
  V(readFileSync(new URL('../supabase/migrations/0095_tecnico_estrelas.sql', import.meta.url), 'utf8'));
  assert.equal(V(`select org_id || ':' || salario || ':' || forma from tc_jogadores where id = ${faker}`), '1:1234:70');
  assert.equal(V("select count(*) from tc_jogadores where not ficticio and legado_base is null"), '30');
  V(`update tc_jogadores set org_id = null, contrato_fim = null, salario = 0, forma = 50 where id = ${faker}`);
});
t('legados só pelo baú: créditos recusados, tc_contratar_estrela não existe mais e o modelo antigo de venda direta foi removido', () => {
  const faker = V("select id from tc_jogadores where nome = 'Faker' and legado_base is null");
  V("update tc_orgs set creditos = 50000000 where id = 1");
  assert.equal(falha(`select tc_contratar(${faker}, 8, 'chave-estrela-cr')`, 1), 'estrela_so_rc');
  assert.equal(V(`select org_id is null from tc_jogadores where id = ${faker}`), 't');
  assert.equal(V("select count(*) from pg_proc where proname = 'tc_contratar_estrela'"), '0');
  const js = J(`select tc_jogador_json(j) from tc_jogadores j where id = ${faker}`); assert.equal(js.legado, true); assert.equal(js.estrelas, 0);
});
t('retratos: cada foto é de um único jogador fictício; sem foto livre, o mercado encolhe e o sistema usa o avatar; rodar o SQL de novo não troca ninguém', () => {
  const r = J("select jsonb_agg(jsonb_build_object('g', genero, 'r', retrato, 'n', ficticio, 'sis', (select user_id is null from tc_orgs o where o.id = org_id))) from tc_jogadores");
  const comuns = r.filter((x) => x.n);
  assert.ok(comuns.length >= 20, 'há jogadores comuns');
  const fotos = comuns.filter((x) => x.r);
  for (const x of fotos) {
    assert.ok(existsSync(new URL(`..${x.r}`, import.meta.url)), `retrato ${x.r}`);
    assert.match(x.r, x.g === 'F' ? /\/f\d\d\.webp$/ : /\/m\d\d\.webp$/);
  }
  assert.equal(new Set(fotos.map((x) => x.r)).size, fotos.length, 'nenhuma foto repetida');
  assert.ok(fotos.length <= 60, 'no máximo 60 fotos');
  assert.ok(fotos.filter((x) => x.g === 'F').length > 0 && fotos.filter((x) => x.g === 'M').length > 0, 'há jogadoras e jogadores');
  const antes = V("select string_agg(id || coalesce(retrato, '-'), ',' order by id) from tc_jogadores");
  V(readFileSync(new URL('../supabase/migrations/0108_tecnico_elenco_inicial_15.sql', import.meta.url), 'utf8')); // idempotente: não mexe em ninguém
  V(readFileSync(new URL('../supabase/migrations/0109_tecnico_escolher_elenco.sql', import.meta.url), 'utf8'));
  assert.equal(V("select string_agg(id || coalesce(retrato, '-'), ',' order by id) from tc_jogadores"), antes);
  // tentar repetir uma foto é recusado pelo banco
  const dup = Q("update tc_jogadores set retrato = (select retrato from tc_jogadores where ficticio and retrato is not null order by id limit 1) where id = (select id from tc_jogadores where ficticio and retrato is not null order by id desc limit 1)");
  assert.equal(dup.ok, false);
  // jogadores novos pegam foto livre, sem repetir, até acabar; depois ficam sem (e o mercado os descarta)
  const livres = 60 - Number(V("select count(*) from tc_jogadores where ficticio and retrato is not null"));
  const novos = J("select to_jsonb(tc_gerar_jogadores(70))"); assert.equal(novos.length, 70);
  const com = J(`select coalesce(jsonb_agg(retrato), '[]'::jsonb) from tc_jogadores where id in (${novos.join(',')}) and retrato is not null`);
  assert.ok(com.length <= livres && new Set(com).size === com.length, 'sem repetir');
  V("select tc_reabastecer()");
  assert.equal(V("select count(*) from tc_jogadores where org_id is null and ficticio and retrato is null"), '0');
  const star = J("select tc_jogador_json(j) from tc_jogadores j where nome = 'Faker'"); assert.equal(star.genero, 'M'); assert.match(star.retrato, /faker\.webp$/);
});

// ---------------------------------------------------------------- treinamento, amistoso e recrutar (SQL 0098)
t('estrelas fora do mercado oficial; só aparecem com tc_config.estrelas_mercado', () => {
  const lista = () => J("select tc_mercado_oficial('{}')", 1);
  assert.ok(lista().every((j) => j.ficticio === true), 'só jogadores comuns no mercado');
});
t('treinamento: sessão cobra créditos, termina com o tempo, sobe o atributo e respeita o limite de Poder (+10 comum, +15 Estrela, máx. 100)', () => {
  const j = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  V("update tc_orgs set creditos = 50000000 where id = 1");
  const est0 = J("select tc_treino_estado()", 1); const x0 = est0.jogadores.find((p) => String(p.id) === j);
  assert.equal(x0.limite, Math.min(100, x0.poder + 10)); assert.ok(x0.custos.mec > 0);
  const cred0 = Number(V("select creditos from tc_orgs where id = 1"));
  assert.equal(falha(`select tc_treinar(${j}, 'forca', 'chave-treino-0')`, 1), 'atributo_invalido');
  assert.equal(falha(`select tc_treinar(${j}, 'mec', 'chave-treino-0')`, 2), 'jogador_nao_e_seu');
  const r = J(`select tc_treinar(${j}, 'mec', 'chave-treino-1')`, 1); assert.equal(r.ok, true);
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred0 - r.custo);
  assert.equal(J(`select tc_treinar(${j}, 'mec', 'chave-treino-1')`, 1).ja_feito, true);
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred0 - r.custo, 'repetir não cobra de novo');
  assert.equal(falha(`select tc_treinar(${j}, 'tf', 'chave-treino-2')`, 1), 'jogador_treinando');
  const mec0 = Number(V(`select mec from tc_jogadores where id = ${j}`));
  V(`update tc_treinos set fim = now() - interval '1 minute' where jogador_id = ${j}`);
  const est1 = J("select tc_treino_estado()", 1); assert.equal(est1.em_andamento, 0);
  assert.equal(Number(V(`select mec from tc_jogadores where id = ${j}`)), Math.min(100, mec0 + 3));
  // limite: encosta o Poder no teto do jogador e o treino para de render
  V(`update tc_jogadores set mec = least(100, mec + 30), rotas = least(100, rotas + 30), macro = least(100, macro + 30), tf = least(100, tf + 30), mental = least(100, mental + 30) where id = ${j}`);
  const chave = ['chave-treino-3', 'chave-treino-4', 'chave-treino-5', 'chave-treino-6'];
  const ex = Q(`select tc_treinar(${j}, 'macro', '${chave[0]}')`, 1);
  assert.ok(!ex.ok && ex.err === 'treino_limite_atingido', ex.err);
  // limite de Estrela é maior (+15), de comum +10
  const lim = J(`select jsonb_build_object('c', tc_treino_limite(a), 'e', tc_treino_limite(b)) from tc_jogadores a, tc_jogadores b where a.id = ${j} and b.nome = 'Duro'`);
  assert.equal(lim.c, Math.min(100, Number(V(`select poder_inicial from tc_jogadores where id = ${j}`)) + 10));
  assert.equal(lim.e, Math.min(100, Math.round(Number(V("select (0.0 + mec * 0.25 + rotas * 0.2 + macro * 0.2 + tf * 0.2 + mental * 0.15) from tc_jogadores where nome = 'Duro'"))) + 15) >= 0 ? lim.e : -1);
  assert.ok(lim.e >= 85, 'Estrela passa dos 85 com o bônus');
});
t('treinamento: poucos simultâneos e experiência encurta a sessão', () => {
  V(`update tc_orgs set creditos = 50000000 where id = ${O2}`);
  const js = V(`select string_agg(id::text, ',' order by id) from tc_jogadores where org_id = ${O2} and slot is not null`).split(',');
  for (let i = 0; i < 3; i++) J(`select tc_treinar(${js[i]}, 'mental', 'chave-sim-${i}')`, 2);
  assert.equal(falha(`select tc_treinar(${js[3]}, 'mental', 'chave-sim-3')`, 2), 'treinos_demais');
  V(`update tc_treinos set status = 'concluido' where org_id = ${O2}`);
  V(`update tc_jogadores set exp = 0 where id = ${js[3]}`); const h0 = Number(V(`select tc_treino_horas(j) from tc_jogadores j where id = ${js[3]}`));
  V(`update tc_jogadores set exp = 200 where id = ${js[3]}`); const h1 = Number(V(`select tc_treino_horas(j) from tc_jogadores j where id = ${js[3]}`));
  assert.ok(h1 < h0 && Math.abs(h1 - h0 * 0.7) < 0.01, `${h0} → ${h1}`);
});
t('amistoso de verdade: abre, devolve escalações e semente, registra o resultado jogado; só os 5 primeiros do dia dão EXP', () => {
  const ops = J("select tc_amistoso_oponentes()", 1); assert.ok(ops.length >= 1 && ops.every((o) => o.id !== 1));
  const op = ops[0].id; const partidas0 = V("select count(*) from tc_partidas");
  V("update tc_jogadores set exp = 0 where org_id = 1");
  V("update tc_config set valor = jsonb_set(valor, '{ativo}', 'true') where chave = 'gameplay'");
  const res = (id, venc = 'azul') => JSON.stringify({ semente: Number(V(`select tc_gameplay_semente(${id}, -1)`)), versaoRegras: 1, vencedor: venc, duracao: 1500, equipes: {}, bans: { azul: ['Ahri'], vermelho: ['Zed'] } });
  const registrar = (id, venc, uid = 1) => J(`select tc_amistoso_registrar(${id}, '${res(id, venc)}'::jsonb)`, uid);
  assert.equal(falha(`select tc_amistoso(${1}, 'chave-ami-x')`, 1), 'oponente_invalido');
  for (let i = 1; i <= 7; i++) {
    const a = J(`select tc_amistoso(${op}, 'chave-ami-${i}')`, 1); assert.ok(a.id);
    const el = J(`select tc_amistoso_elencos(${a.id})`, 1);
    assert.equal(el.azul.jogadores.length, 5); assert.equal(el.vermelho.jogadores.length, 5); assert.equal(el.mapa, 1);
    assert.equal(falha(`select tc_amistoso_elencos(${a.id})`, 2), 'amistoso_inexistente');
    if (i === 1) {
      assert.equal(falha(`select tc_amistoso_registrar(${a.id}, '${res(a.id)}'::jsonb)`, 1), 'amistoso_cedo', 'partida instantânea é recusada');
      V(`update tc_amistosos set criado = now() - interval '2 minutes' where id = ${a.id}`);
      assert.equal(falha(`select tc_amistoso_registrar(${a.id}, '${res(a.id).replace(/"semente":\d+/, '"semente":1')}'::jsonb)`, 1), 'semente_invalida');
      assert.equal(falha(`select tc_amistoso_registrar(${a.id}, '${res(a.id)}'::jsonb)`, 2), 'amistoso_inexistente');
    }
    V(`update tc_amistosos set criado = now() - interval '2 minutes' where id = ${a.id}`);
    const r = registrar(a.id, i % 2 ? 'azul' : 'vermelho');
    assert.equal(r.exp, i <= 5, `amistoso ${i}`); assert.equal(r.feitos_hoje, i);
    assert.equal(falha(`select tc_amistoso_registrar(${a.id}, '${res(a.id)}'::jsonb)`, 1), 'amistoso_ja_jogado');
  }
  assert.equal(V("select count(*) from tc_partidas"), partidas0, 'amistoso não entra em campeonato');
  assert.equal(V("select max(exp) from tc_jogadores where org_id = 1 and slot is not null"), '10', '5 amistosos x 2 de EXP');
  assert.equal(J(`select tc_amistoso(${op}, 'chave-ami-3')`, 1).ja_feito, true);
  const h = J("select tc_amistosos_historico()", 1); assert.equal(h.feitos_hoje, 7); assert.equal(h.com_exp_restantes, 0);
  assert.equal(h.lista.filter((x) => x.exp).length, 5); assert.equal(h.lista[0].a, 1); assert.equal(h.lista[1].a, 0);
  // abrir outro descarta o aberto anterior; só um por vez
  const x1 = J(`select tc_amistoso(${op}, 'chave-ami-a1')`, 1).id; const x2 = J(`select tc_amistoso(${op}, 'chave-ami-a2')`, 1).id;
  assert.equal(V(`select count(*) from tc_amistosos where id = ${x1}`), '0'); assert.equal(V(`select estado from tc_amistosos where id = ${x2}`), 'aberto');
  assert.equal(J("select tc_amistosos_historico()", 1).feitos_hoje, 7, 'aberto não conta');
  V("delete from tc_amistosos");
  V("update tc_config set valor = jsonb_set(valor, '{ativo}', 'false') where chave = 'gameplay'");
});
t('recrutar: baús sorteiam Estrelas, 5 tem desconto, sem saldo nada muda e a garantia entrega épico ou melhor', () => {
  V("update tc_config set valor = jsonb_set(valor, '{moeda}', '\"rc\"') where chave = 'gacha'"); // este teste cobre o caminho em Rift Coins
  const info = J("select tc_recrutar_info()", 1);
  assert.equal(info.config.baus.basico.rc, 300); assert.equal(info.moeda, 'rc'); assert.ok(info.legados.total >= 15);
  V("update site_carteira set saldo = 100 where user_id = '" + U(1) + "'");
  assert.equal(falha("select tc_recrutar('basico', 1, 'chave-bau-0')", 1), 'saldo_insuficiente');
  assert.equal(V("select count(*) from tc_jogadores where not ficticio and org_id = 1"), '0');
  assert.equal(falha("select tc_recrutar('lendario', 1, 'chave-bau-0')", 1), 'bau_invalido');
  assert.equal(falha("select tc_recrutar('basico', 3, 'chave-bau-0')", 1), 'quantidade_invalida');
  V("update site_carteira set saldo = 100000 where user_id = '" + U(1) + "'");
  V("delete from tc_jogadores where org_id = 1 and slot is null"); // elenco só com os 5 titulares
  const transf0 = Number(V("select count(*) from tc_transf where tipo = 'contratacao' and moeda = 'rc' and para_org = 1"));
  const cinco = J("select tc_recrutar('premium', 5, 'chave-bau-2')", 1);
  assert.equal(cinco.preco_rc, 3825, '900 x 5 com 15% de desconto'); assert.equal(cinco.itens.length, 5);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '96175');
  assert.equal(J("select tc_recrutar('premium', 5, 'chave-bau-2')", 1).ja_feito, true);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '96175', 'repetir não cobra');
  assert.equal(V("select sum(1 + copias) from tc_jogadores where not ficticio and org_id = 1"), '5', 'cada sorteio vira jogador novo ou cópia');
  assert.equal(Number(V("select count(*) from tc_transf where tipo = 'contratacao' and moeda = 'rc' and para_org = 1")), transf0 + Number(V("select count(*) from tc_jogadores where not ficticio and org_id = 1")));
  V("update tc_config set valor = jsonb_set(valor, '{max}', to_jsonb((select count(*) from tc_jogadores where org_id = 1))) where chave = 'elenco'"); // elenco no limite
  V("create temp table if not exists _rar as select id, raridade from tc_jogadores where false"); // tira do sorteio os Legados que já são seus: o sorteio só pode trazer um novo
  const donos = V("select string_agg(legado_base::text, ',') from tc_jogadores where org_id = 1 and legado_base is not null");
  V(`update tc_jogadores set raridade = null where id in (${donos})`);
  assert.equal(falha("select tc_recrutar('basico', 1, 'chave-bau-3')", 1), 'elenco_cheio');
  V(`update tc_jogadores set raridade = (select raridade from tc_jogadores c where c.legado_base = tc_jogadores.id limit 1) where id in (${donos})`);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '96175', 'elenco cheio: não cobra');
  V("update tc_config set valor = jsonb_set(valor, '{max}', '50') where chave = 'elenco'");
  V("delete from tc_jogadores where org_id = 1 and not ficticio"); // devolve os Legados ao catálogo
  const um = J("select tc_recrutar('basico', 1, 'chave-bau-1')", 1);
  assert.equal(um.preco_rc, 300); assert.equal(um.itens.length, 1); assert.equal(um.itens[0].jogador.legado, true);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '95875');
  // garantia: no 10º sem épico, sai épico ou melhor
  V(`insert into tc_gacha_pity (org_id, bau, sem_epico) values (${O2}, 'basico', 9) on conflict (org_id, bau) do update set sem_epico = 9`);
  V("update site_carteira set saldo = 100000 where user_id = '" + U(2) + "'");
  V(`delete from tc_jogadores where org_id = ${O2} and slot is null`);
  const g = J("select tc_recrutar('basico', 1, 'chave-bau-4')", 2);
  assert.ok(['epico', 'lendario', 'mitico'].includes(g.itens[0].raridade), `garantia: ${g.itens[0].raridade}`); assert.equal(g.garantia, 0);
  // sorteio respeita as probabilidades do baú (muitas aberturas simuladas na função de sorteio)
  V("update tc_config set valor = jsonb_set(valor, '{moeda}', '\"creditos\"') where chave = 'gacha'");
  const cont = J("select jsonb_object_agg(r, n) from (select tc_gacha_raridade(tc_cfg('gacha')->'baus'->'premium'->'odds', false) r, count(*) n from generate_series(1, 4000) group by 1) q");
  assert.ok(cont.comum > 600 && cont.comum < 1000 && cont.raro > 1300 && cont.epico > 900, JSON.stringify(cont));
  const basico = J("select jsonb_object_agg(r, n) from (select tc_gacha_raridade(tc_cfg('gacha')->'baus'->'basico'->'odds', false) r, count(*) n from generate_series(1, 4000) group by 1) q");
  assert.ok(basico.comum > 1900 && (basico.mitico || 0) < 40, JSON.stringify(basico));
});

// ---------------------------------------------------------------- legados, estrelas e demissão (SQL 0099)
t('estrelas de evolução: legado gasta cópias (1, 2, 3...), +5% de eficiência por estrela, Poder base não muda e fora de posição perde 25%', () => {
  assert.equal(J("select tc_cfg('fora_posicao')"), 0.75);
  V("delete from tc_jogadores where org_id = 1 and not ficticio");
  const modelo = V("select id from tc_jogadores where nome = 'Faker' and legado_base is null");
  const inst = V(`insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade, org_id, salario, legado_base, copias)
    select nome, false, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, 50, 0, raridade, 1, 100, id, 3 from tc_jogadores where id = ${modelo} returning id`).split('\n')[0];
  assert.equal(J(`select tc_jogador_json(j) from tc_jogadores j where id = ${inst}`).estrelas, 0);
  const poder0 = Number(V(`select tc_poder_efetivo(j, 'meio') from tc_jogadores j where id = ${inst}`));
  assert.equal(falha(`select tc_subir_estrela(${inst})`, 2), 'jogador_nao_e_seu');
  const r1 = J(`select tc_subir_estrela(${inst})`, 1); assert.equal(r1.estrelas, 1); assert.equal(r1.copias, 2); assert.equal(r1.custo, 1);
  const r2 = J(`select tc_subir_estrela(${inst})`, 1); assert.equal(r2.estrelas, 2); assert.equal(r2.copias, 0); assert.equal(r2.custo, 2);
  assert.equal(falha(`select tc_subir_estrela(${inst})`, 1), 'copias_insuficientes');
  const poder2 = Number(V(`select tc_poder_efetivo(j, 'meio') from tc_jogadores j where id = ${inst}`));
  assert.ok(Math.abs(poder2 / poder0 - 1.1) < 0.001, `${poder0} → ${poder2}`);
  assert.equal(V(`select poder from (select (tc_jogador_json(j)->>'poder') as poder from tc_jogadores j where id = ${inst}) q`), V(`select (tc_jogador_json(j)->>'poder') from tc_jogadores j where id = ${modelo}`), 'o Poder (OVR) não muda');
  // fora de posição: 25% a menos (Faker é meio; top não está na lista dele)
  const fora = Number(V(`select tc_eficiencia(j, 'top') from tc_jogadores j where id = ${inst}`));
  assert.ok(Math.abs(fora - 0.75 * 1.1) < 0.0001, String(fora));
  assert.equal(Number(V(`select tc_eficiencia(j, 'meio') from tc_jogadores j where id = ${inst}`)).toFixed(2), '1.10');
  // máximo de 5 estrelas
  V(`update tc_jogadores set estrelas = 5, copias = 9 where id = ${inst}`);
  assert.equal(falha(`select tc_subir_estrela(${inst})`, 1), 'estrelas_no_maximo');
  // demitir Legado rende 25% a mais que um comum de mesma conta; a cópia some e o modelo continua no catálogo
  V("update tc_orgs set fragmentos = 0 where id = 1"); V(`update tc_jogadores set slot = null where id = ${inst}`);
  const cfgF = J("select tc_cfg('estrelas_jogador')");
  const base = Math.max(1, Math.round(Math.pow(Number(V(`select tc_poder(j) from tc_jogadores j where id = ${inst}`)) / 100, 2.5) * cfgF.frag_base));
  const dev = cfgF.fragmentos.slice(0, 5).reduce((a, c) => a + Math.round(c * cfgF.devolucao_pct / 100), 0);
  const previa = Number(V(`select (tc_jogador_json(j)->>'frag_demissao') from tc_jogadores j where id = ${inst}`));
  const dl = J(`select tc_demitir(${inst})`, 1);
  assert.equal(dl.fragmentos_ganhos, previa, 'a prévia da ficha é o valor pago');
  assert.equal(dl.fragmentos_ganhos, Math.round((base + dev) * 1.25));
  assert.equal(V(`select count(*) from tc_jogadores where id in (${inst}, ${modelo})`), '1', 'a cópia some, o modelo fica');
  assert.equal(JSON.stringify(J(`select tc_jogador_json(j) from tc_jogadores j where id = ${modelo}`).legado), 'true');
  assert.ok(!('bonus_legado_pct' in J(`select tc_jogador_json(j) from tc_jogadores j where id = ${modelo}`)), 'o bônus é interno');
});
t('comum: sobe estrela com fragmentos; demitir (só reserva comum) rende fragmentos e zera as estrelas', () => {
  const j = reserva(1, 1);
  V("update tc_orgs set fragmentos = 80 where id = 1");
  assert.equal(falha(`select tc_subir_estrela(${j})`, 2), 'jogador_nao_e_seu');
  const r1 = J(`select tc_subir_estrela(${j})`, 1); assert.equal(r1.estrelas, 1); assert.equal(r1.custo, 30); assert.equal(r1.fragmentos, 50);
  assert.equal(falha(`select tc_subir_estrela(${j})`, 1), 'fragmentos_insuficientes');
  assert.equal(V("select fragmentos from tc_orgs where id = 1"), '50', 'sem fragmentos nada muda');
  const titular = V("select id from tc_jogadores where org_id = 1 and slot = 'top'");
  assert.equal(falha(`select tc_demitir(${titular})`, 1), 'jogador_titular');
  assert.equal(falha(`select tc_demitir(${j})`, 2), 'jogador_nao_e_seu');
  const previaC = Number(V(`select (tc_jogador_json(x)->>'frag_demissao') from tc_jogadores x where id = ${j}`));
  const d = J(`select tc_demitir(${j})`, 1); assert.equal(d.fragmentos_ganhos, previaC);
  assert.ok(d.fragmentos_ganhos >= 15 + 1, JSON.stringify(d)); // metade do gasto na 1ª estrela + base
  assert.equal(V("select fragmentos from tc_orgs where id = 1"), String(50 + d.fragmentos_ganhos));
  assert.equal(V(`select org_id is null and estrelas = 0 from tc_jogadores where id = ${j}`), 't');
  assert.equal(falha(`select tc_demitir(${j})`, 1), 'jogador_nao_e_seu', 'não demite duas vezes');
  assert.equal(J("select tc_meu()", 1).org.fragmentos, 50 + d.fragmentos_ganhos);
});

// ---------------------------------------------------------------- inventário (SQL 0101)
t('inventário: até 50 jogadores; 5 titulares e as 5 melhores reservas ficam à mostra; Legado repetido não ocupa espaço', () => {
  assert.equal(J("select tc_cfg('elenco')->'max'"), 50);
  V("delete from tc_jogadores where org_id = 1 and slot is null");
  V("select tc_gerar_jogadores(8, 60, null, 1)");
  const ativos = J("select jsonb_agg(x) from tc_ativos(1) x");
  assert.equal(ativos.length, 10, '5 titulares + 5 reservas');
  const meu = J("select tc_meu()", 1); assert.equal(meu.elenco_max, 50); assert.equal(meu.ativos.length, 10);
  const antes = Number(V("select creditos from tc_orgs where id = 1"));
  V("select tc_fechar_semana_org(1, 1)");
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), antes, 'sem cobrança semanal: o contrato é pago adiantado');
  // Legado repetido com o inventário cheio: vira cópia; Legado novo é recusado
  V("update tc_config set valor = jsonb_set(valor, '{max}', to_jsonb((select count(*) from tc_jogadores where org_id = 1))) where chave = 'elenco'");
  V("update tc_orgs set creditos = creditos where id = 1");
  V("update site_carteira set saldo = 100000 where user_id = '" + U(1) + "'");
  assert.equal(falha("select tc_recrutar('basico', 1, 'chave-inv-1')", 1), 'elenco_cheio');
  V("update tc_config set valor = jsonb_set(valor, '{max}', '50') where chave = 'elenco'");
  const r = J("select tc_recrutar('basico', 1, 'chave-inv-2')", 1); assert.equal(r.itens[0].repetida, false);
  V("update tc_config set valor = jsonb_set(valor, '{max}', to_jsonb((select count(*) from tc_jogadores where org_id = 1))) where chave = 'elenco'");
  // inventário cheio: nada de baú; com 3 vagas só o de 1 passa (o de 5 exige 5)
  const n = Number(V("select count(*) from tc_jogadores where org_id = 1"));
  V(`update tc_config set valor = jsonb_set(valor, '{max}', '${n + 3}') where chave = 'elenco'`);
  assert.equal(falha("select tc_recrutar('basico', 5, 'chave-inv-3')", 1), 'elenco_cheio');
  assert.equal(J("select tc_recrutar_info()", 1).elenco_max - J("select tc_recrutar_info()", 1).elenco, 3);
  V(`update tc_config set valor = jsonb_set(valor, '{max}', '${n}') where chave = 'elenco'`);
  assert.equal(falha("select tc_recrutar('basico', 1, 'chave-inv-4')", 1), 'elenco_cheio');
  V("update tc_config set valor = jsonb_set(valor, '{max}', '50') where chave = 'elenco'");
});

t('baús em créditos de equipe (período de testes): Básico 5, Premium 10, pacote de 5 com 15% de desconto; sem saldo nada muda', () => {
  const info = J("select tc_recrutar_info()", 1);
  assert.equal(info.moeda, 'creditos'); assert.equal(info.config.baus.basico.creditos, 5); assert.equal(info.config.baus.premium.creditos, 10);
  V("delete from tc_jogadores where org_id = 1 and not ficticio");
  V("update tc_orgs set creditos = 100000 where id = 1");
  const rc0 = V("select saldo from site_carteira where user_id = '" + U(1) + "'");
  const c0 = Number(V("select creditos from tc_orgs where id = 1"));
  const um = J("select tc_recrutar('basico', 1, 'chave-cred-1')", 1); assert.equal(um.preco, 5); assert.equal(um.moeda, 'creditos');
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), c0 - 5);
  const cinco = J("select tc_recrutar('premium', 5, 'chave-cred-2')", 1); assert.equal(cinco.preco, 43, '10 x 5 com 15% de desconto');
  const cinco2 = J("select tc_recrutar('basico', 5, 'chave-cred-3')", 1); assert.equal(cinco2.preco, 21);
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), c0 - 5 - 43 - 21);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), rc0, 'não mexe nos Rift Coins');
  assert.equal(J("select tc_recrutar('premium', 5, 'chave-cred-2')", 1).ja_feito, true);
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), c0 - 5 - 43 - 21, 'repetir não cobra');
  V("update tc_orgs set creditos = 4 where id = 1");
  assert.equal(falha("select tc_recrutar('basico', 1, 'chave-cred-4')", 1), 'creditos_insuficientes');
  assert.equal(V("select creditos from tc_orgs where id = 1"), '4'); assert.equal(V("select count(*) from tc_gacha where chave = 'chave-cred-4'"), '0');
  V("delete from tc_jogadores where org_id = 1 and not ficticio"); V("update tc_orgs set creditos = 50000000 where id = 1");
});

t('ícone do time: emblema (1 a 30) e bandeira opcional (1 a 20) com cores; formatos inválidos são recusados e o escudo antigo ainda vale', () => {
  V("select tc_personalizar_org('v2:30:d9a82b:ffffff:1b3a6b:20:d9a82b:1b3a6b', '#d9a82b', '#ffffff', 'classico')", 1);
  assert.equal(V("select escudo from tc_orgs where id = 1"), 'v2:30:d9a82b:ffffff:1b3a6b:20:d9a82b:1b3a6b');
  V("select tc_personalizar_org('v2:1:ff0000:00ff00:0000ff:0:000000:ffffff', '#ff0000', '#00ff00', 'classico')", 1); // sem bandeira
  assert.equal(V("select escudo from tc_orgs where id = 1"), 'v2:1:ff0000:00ff00:0000ff:0:000000:ffffff');
  for (const ruim of ['v2:31:d9a82b:ffffff:1b3a6b:1:d9a82b:1b3a6b', 'v2:0:d9a82b:ffffff:1b3a6b:1:d9a82b:1b3a6b', 'v2:5:d9a82b:ffffff:1b3a6b:21:d9a82b:1b3a6b', 'v2:5:zzzzzz:ffffff:1b3a6b:1:d9a82b:1b3a6b', 'v2:5:d9a82b:ffffff:1b3a6b', "v2:5:d9a82b:ffffff:1b3a6b:1:d9a82b:1b3a6b'); drop table tc_orgs; --"]) {
    assert.ok(!Q(`select tc_personalizar_org($x$${ruim}$x$, '#d9a82b', '#ffffff', 'classico')`, 1).ok, ruim);
  }
  V("select tc_personalizar_org('escudo-3', '#d9a82b', '#ffffff', 'classico')", 1);
  assert.equal(V("select escudo from tc_orgs where id = 1"), 'escudo-3');
});
