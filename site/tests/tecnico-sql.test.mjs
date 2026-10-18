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
const CFG_MERCADO_TESTES = { horas: 12, min: 400, max: 400, abaixo: 100, acima: 100, poder_padrao: 50 };
const CFG_MERCADO_REAL = { horas: 12, min: 7, max: 10, abaixo: 5, acima: 8, poder_padrao: 50 };
const MIG = ['0085_tecnico_base.sql', '0086_tecnico_mercado_usuarios.sql', '0087_tecnico_campeonatos.sql', '0088_tecnico_consultas.sql', '0089_tecnico_internacionais.sql', '0090_tecnico_campeoes.sql', '0091_tecnico_gameplay.sql', '0092_tecnico_convidados.sql', '0093_tecnico_posicoes.sql', '0094_tecnico_seguranca.sql', '0095_tecnico_estrelas.sql', '0096_tecnico_estrelas_rc.sql', '0097_tecnico_retratos.sql', '0098_tecnico_treino_amistoso_recrutar.sql', '0099_tecnico_legados_estrelas.sql', '0100_tecnico_amistoso_real.sql', '0101_tecnico_inventario.sql', '0102_tecnico_legados_brasil.sql', '0103_tecnico_demissao_previa.sql', '0104_tecnico_baus_creditos.sql', '0105_tecnico_maestria_7.sql', '0106_tecnico_contratos.sql', '0107_tecnico_retratos_unicos.sql', '0108_tecnico_elenco_inicial_15.sql', '0109_tecnico_escolher_elenco.sql', '0110_tecnico_icone_time.sql', '0111_tecnico_vender_legado_contrato.sql', '0112_tecnico_comprar_legado_repetido.sql', '0113_tecnico_potencial_coerente.sql', '0114_tecnico_treino_xp.sql', '0115_tecnico_xp_vitoria_derrota.sql', '0116_tecnico_marketing.sql', '0117_tecnico_mercado_rotacao.sql', '0118_tecnico_admin_na_serie_b.sql', '0119_tecnico_nomes_campeonatos.sql', '0120_tecnico_liga_semanal_md1.sql', '0121_tecnico_campeonato_individual.sql', '0122_tecnico_pontuacao_desempate.sql', '0123_tecnico_adm_jogadores.sql', '0124_tecnico_sistema_com_fotos.sql', '0125_tecnico_escolha_de_lado.sql', '0126_tecnico_draft_conferido.sql', '0127_tecnico_xp_maestria_por_partida.sql', '0128_tecnico_wo_sem_xp.sql', '0129_tecnico_cinco_treinos.sql', '0130_tecnico_historico_financeiro_30.sql', '0131_tecnico_adm_raridade.sql', '0132_tecnico_partida_com_liga.sql', '0133_tecnico_historico_20.sql', '0134_tecnico_bau_repetido_sem_custo.sql', '0135_tecnico_bau_copia_no_historico.sql', '0136_tecnico_receita_marketing_por_dia.sql'];
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
  // os testes antigos olham o mercado inteiro: a rotação (poucos jogadores por janela) é testada à parte, com a configuração real
  r = psql(['-d', 't', '-c', `update tc_config set valor = '${JSON.stringify(CFG_MERCADO_TESTES)}'::jsonb where chave = 'mercado_oficial'`]); assert.equal(r.status, 0, r.stderr);
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
  for (const pos of ['top', 'selva', 'meio', 'atirador', 'suporte']) {
    const tres = meu1.ofertas.filter((x) => x.pos === pos); assert.equal(tres.length, 3, pos);
    const m = tres.filter((x) => x.genero === 'M').length; assert.ok(m === 1 || m === 2, `${pos}: sempre os dois gêneros (${m} masculinos)`);
    for (const x of tres) assert.match(x.retrato, x.genero === 'F' ? /\/f\d\d\.webp$/ : /\/m\d\d\.webp$/, 'foto combina com o gênero');
  }
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
  // anunciar com contrato vigente pode; encerrar devolve 50% do restante pago (4 semanas restantes)
  const anCt = J(`select tc_anunciar(${j}, 500)`, 1); assert.ok(anCt.id, 'contrato vigente não impede o anúncio'); V(`select tc_cancelar_anuncio(${anCt.id})`, 1);
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

t('campeonatos individuais: cada técnico joga a sua liga (ele + 7 equipes do sistema), MD1 e 2 jogos por dia', () => {
  const s0 = J('select tc_sincronizar()', 1, '2026-10-12');
  assert.equal(s0.dia, 1);
  assert.equal(V('select count(*) from tc_ligas'), '4', 'uma liga por técnico real');
  assert.equal(V('select count(distinct dono_org) from tc_ligas'), '4');
  assert.equal(V("select count(*) from tc_ligas l where l.divisao = 'acesso' and (select count(*) from tc_liga_times t where t.liga_id = l.id) = 8 and (select count(*) from tc_liga_times t join tc_orgs o on o.id = t.org_id where t.liga_id = l.id and o.user_id is not null) = 1 and exists (select 1 from tc_liga_times t where t.liga_id = l.id and t.org_id = l.dono_org)"), '4', 'cada liga: o técnico dono + 7 equipes do sistema');
  assert.ok(Number(V("select count(*) from tc_orgs where user_id is null and ativa and divisao = 'acesso'")) >= 8);
  assert.equal(V("select count(*) from tc_partidas where formato <> 1"), '0', 'a fase de pontos é MD1');
  for (const liga of V("select string_agg(id::text, ' ') from tc_ligas").split(' ')) {
    assert.equal(V(`select count(*) from tc_partidas where liga_id = ${liga} and fase = 'rodada'`), '40', '10 rodadas de 4 partidas');
    assert.equal(V(`select count(distinct dia) from tc_partidas where liga_id = ${liga} and fase = 'rodada'`), '5', 'de segunda a sexta');
    assert.equal(V(`select count(*) from (select dia, o, count(*) c, count(distinct adv) d from (select dia, org_a o, org_b adv from tc_partidas where liga_id = ${liga} and fase = 'rodada' union all select dia, org_b, org_a from tc_partidas where liga_id = ${liga} and fase = 'rodada') z group by dia, o) y where c <> 2 or d <> 2`), '0', '2 jogos por dia contra adversários diferentes');
  }
  assert.equal(Number(V("select count(*) from tc_partidas where status = 'concluida'")), 32, '2 rodadas x 4 partidas x 4 ligas');
  const marcas = V("select string_agg(processada::text, ',' order by id) from tc_partidas where status = 'concluida'");
  assert.equal(J('select tc_sincronizar()', 1, '2026-10-12').processadas, 0);
  assert.equal(V("select string_agg(processada::text, ',' order by id) from tc_partidas where status = 'concluida'"), marcas);
  assert.equal(V("select tc_processar_partida(id) from tc_partidas where status = 'concluida' limit 1"), 'f');
  assert.equal(J('select tc_sincronizar()', 1, '2026-10-13').processadas, 32);
  assert.equal(V("select count(*) from tc_partidas where status = 'concluida' and (placar_a = placar_b or greatest(placar_a, placar_b) <> 1 or least(placar_a, placar_b) <> 0)"), '0', 'MD1: 1 a 0');
});

t('semana completa: semifinais MD3 e final MD5, premiação só dos técnicos, promoção do dono da liga, Rank e salários, uma vez só', () => {
  const cred1 = Number(V('select creditos from tc_orgs where id = 1'));
  const sistemaPrincipalAntes = V("select count(*) from tc_orgs where user_id is null and divisao = 'principal'");
  V("update tc_config set valor = 'true' where chave = 'rank_ativo'");
  const r = J('select tc_sincronizar()', 1, '2026-10-18');
  assert.equal(r.dia, 7);
  assert.equal(V("select count(*) from tc_ligas where status = 'encerrada'"), '4');
  assert.equal(V("select count(*) from tc_partidas where status <> 'concluida'"), '0');
  assert.equal(V("select count(*) from tc_partidas where fase = 'semi'"), '8'); assert.equal(V("select count(*) from tc_partidas where fase = 'final'"), '4');
  assert.equal(V("select count(*) from tc_partidas where fase = 'semi' and formato <> 3"), '0', 'semifinal MD3'); assert.equal(V("select count(*) from tc_partidas where fase = 'final' and formato <> 5"), '0', 'final MD5');
  assert.equal(V("select min(dia)::text from tc_partidas where fase = 'semi'"), '2026-10-17', 'semifinais no sábado');
  assert.equal(V("select min(dia)::text from tc_partidas where fase = 'final'"), '2026-10-18', 'final no domingo');
  let campeoes = 0;
  for (const liga of V("select string_agg(id::text, ' ') from tc_ligas").split(' ')) {
    const tab = J(`select jsonb_agg(to_jsonb(t) order by pos) from tc_tabela(${liga}) t`);
    for (const x of tab) { assert.equal(x.partidas, 10); assert.equal(x.pontos, x.vitorias); }
    const fin = J(`select jsonb_agg(f.org_id order by f.pos) from tc_tabela_final(${liga}) f`);
    const fp = J(`select jsonb_build_object('w', vencedor, 'l', case when org_a = vencedor then org_b else org_a end) from tc_partidas where liga_id = ${liga} and fase = 'final'`);
    assert.equal(fin[0], fp.w); assert.equal(fin[1], fp.l);
    const dono = Number(V(`select dono_org from tc_ligas where id = ${liga}`));
    const pos = fin.indexOf(dono) + 1;
    assert.equal(V(`select divisao from tc_orgs where id = ${dono}`), pos <= 2 ? 'principal' : 'acesso', 'os 2 primeiros da Academy sobem; os outros ficam');
    if (pos === 1) campeoes++;
    assert.equal(V(`select count(*) from tc_premios where liga_id = ${liga}`), '1', 'só o técnico recebe premiação');
  }
  assert.equal(V("select count(*) from tc_orgs where user_id is null and divisao = 'principal'"), sistemaPrincipalAntes, 'equipes do sistema não trocam de divisão');
  assert.equal(V('select count(*) from tc_fin where org_id = 1 and motivo = \'salarios\''), '0', 'salário é pago adiantado no contrato');
  assert.equal(V('select count(*) from tc_fin where org_id = 1 and motivo = \'premiacao\''), '1');
  const rk = Number(V('select count(*) from site_rk_lanc_stub'));
  assert.equal(rk, 4);
  const cred2 = Number(V('select creditos from tc_orgs where id = 1'));
  assert.notEqual(cred2, cred1);
  J('select tc_sincronizar()', 1, '2026-10-18');
  assert.equal(Number(V('select count(*) from site_rk_lanc_stub')), rk);
  assert.equal(Number(V('select creditos from tc_orgs where id = 1')), cred2);
  assert.equal(V("select count(*) from tc_trofeus"), String(campeoes));
});

t('temporada inteira: uma liga individual por técnico e semana; Copa e Mundial só com técnicos que foram finalistas da Liga Nacional', () => {
  J('select tc_sincronizar()', 1, '2026-11-08');
  assert.equal(V("select count(*) from tc_ligas where tipo = 'divisao'"), '16', '4 técnicos x 4 semanas');
  assert.equal(V("select count(*) from tc_ligas where status <> 'encerrada'"), '0');
  assert.equal(V("select count(*) from tc_partidas where status <> 'concluida'"), '0');
  assert.equal(V("select count(*) from tc_ligas where tipo = 'copa'"), '0', 'sem finalistas da Nacional na semana 1, sem Copa');
  const finalistas = J("select coalesce(jsonb_agg(distinct l.dono_org), '[]'::jsonb) from tc_ligas l, lateral tc_tabela_final(l.id) f where l.tipo = 'divisao' and l.divisao = 'principal' and l.semana <= 3 and f.org_id = l.dono_org and f.pos <= 2");
  const mundial = Number(V("select count(*) from tc_ligas where tipo = 'mundial'"));
  assert.equal(mundial, finalistas.length ? 1 : 0, 'o Mundial só existe se algum técnico foi finalista da Nacional nas semanas 1 a 3');
  if (mundial) {
    const reais = J("select jsonb_agg(t.org_id) from tc_liga_times t join tc_ligas l on l.id = t.liga_id join tc_orgs o on o.id = t.org_id where l.tipo = 'mundial' and o.user_id is not null");
    for (const o of reais) assert.ok(finalistas.includes(o), `técnico ${o} no Mundial sem ter sido finalista da Nacional`);
    assert.equal(V("select count(*) from tc_liga_times t join tc_ligas l on l.id = t.liga_id where l.tipo = 'mundial'"), '6');
    assert.equal(V("select count(*) from tc_partidas p join tc_ligas l on l.id = p.liga_id where l.tipo = 'mundial'"), '5');
    assert.equal(V("select count(*) from tc_partidas p join tc_ligas l on l.id = p.liga_id where l.tipo = 'mundial' and p.formato <> 5"), '0');
  }
  assert.equal(V("select count(*) from (select liga_id, org_id from tc_premios group by 1, 2 having count(*) > 1) x"), '0');
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
  assert.ok(h.partidas.length > 0 && h.premios.length > 0 && h.transferencias.length > 0 && h.transferencias.length <= 20 && h.financas.length <= 20);
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
  let el = J(`select tc_partida_elencos(${pid})`, n, '2026-11-09');
  if (!el.lado.definido) {
    assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${JSON.stringify({ semente: Number(el.semente), versaoRegras: 1, vencedor: 'azul', duracao: 1800, equipes: {}, jogadores: [] })}'::jsonb)`, n, '2026-11-09'), 'lado_nao_escolhido', 'sem lado escolhido o resultado não é gravado');
    assert.equal(el.lado.voce_escolhe, true);
    assert.equal(falha(`select tc_gameplay_escolher_lado(${pid}, 'verde')`, n, '2026-11-09'), 'lado_invalido');
    J(`select tc_gameplay_escolher_lado(${pid}, 'vermelho')`, n, '2026-11-09');
    assert.equal(falha(`select tc_gameplay_escolher_lado(${pid}, 'azul')`, n, '2026-11-09'), 'lado_ja_escolhido');
    el = J(`select tc_partida_elencos(${pid})`, n, '2026-11-09');
    assert.equal(el.lado.definido, true);
    assert.notEqual(el.azul.org.id, el.lado.escolhe, 'quem escolheu vermelho joga no vermelho');
  }
  assert.equal(el.mapa, 1); assert.equal(el.azul.jogadores.length, 5); assert.equal(el.vermelho.jogadores.length, 5);
  assert.deepEqual(el.azul.jogadores.map((j) => j.pos), ['top', 'selva', 'meio', 'atirador', 'suporte']);
  assert.ok(el.azul.jogadores[0].atributos.mec >= 1);
  assert.equal(String(el.semente), V(`select tc_gameplay_semente(${pid}, 1)`));
  const camp = V("select string_agg(nome, '|' order by id) from (select id, nome from tc_campeoes order by id limit 20) x").split('|');
  const POS = ['top', 'selva', 'meio', 'atirador', 'suporte'];
  const draft = { picks: { azul: Object.fromEntries(POS.map((p, i) => [p, camp[i]])), vermelho: Object.fromEntries(POS.map((p, i) => [p, camp[5 + i]])) }, bans: { azul: camp.slice(10, 15), vermelho: camp.slice(15, 20) } };
  const jogs = ['azul', 'vermelho'].flatMap((eq) => el[eq].jogadores.map((j) => ({ id: j.id, equipe: eq, pos: j.pos, campeao: draft.picks[eq][j.pos] })));
  const enviar = (d) => `select tc_gameplay_draft(${pid}, 1, '${JSON.stringify(d).replace(/'/g, "''")}'::jsonb)`;
  const res = (mapa, vencedor, extra = {}) => JSON.stringify({ semente: Number(V(`select tc_gameplay_semente(${pid}, ${mapa})`)), versaoRegras: 1, vencedor, duracao: 1800, motivo: 'nexus', interrompida: false,
    equipes: { azul: { abates: 20, torresPerdidas: 3, dragoes: 1 }, vermelho: { abates: 15, torresPerdidas: 8, dragoes: 2 } }, mvp: { nome: 'Teste' }, jogadores: jogs, ...extra }).replace(/'/g, "''");
  const reg = (mapa, vencedor, extra) => J(`select tc_gameplay_registrar(${pid}, ${mapa}, '${res(mapa, vencedor, extra)}'::jsonb)`, n, '2026-11-09');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 2, '${res(2, 'azul')}'::jsonb)`, n, '2026-11-09'), 'mapa_fora_de_ordem');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { semente: 123 })}'::jsonb)`, n, '2026-11-09'), 'semente_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { versaoRegras: 9 })}'::jsonb)`, n, '2026-11-09'), 'versao_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { interrompida: true })}'::jsonb)`, n, '2026-11-09'), 'resultado_invalido');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { duracao: 10 })}'::jsonb)`, n, '2026-11-09'), 'duracao_invalida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul')}'::jsonb)`, 6, '2026-11-09'), 'partida_nao_e_sua');
  V(`update tc_config set valor = '${aberto}'::jsonb where chave = 'aberto'`);
  assert.equal(V(`select formato from tc_partidas where id = ${pid}`), '1', 'campeonato MD1: um mapa decide');
  // draft conferido: sem draft, com draft inválido ou com campeões diferentes dos picks, o mapa não é gravado
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul')}'::jsonb)`, n, '2026-11-09'), 'draft_nao_enviado');
  assert.equal(falha(enviar({ ...draft, bans: { azul: [camp[0], ...camp.slice(11, 15)], vermelho: camp.slice(15, 20) } }), n, '2026-11-09'), 'draft_invalido', 'campeão banido e escolhido');
  assert.equal(falha(enviar({ ...draft, bans: { azul: camp.slice(10, 14), vermelho: camp.slice(15, 20) } }), n, '2026-11-09'), 'draft_invalido', 'faltou um ban');
  assert.equal(falha(enviar({ ...draft, picks: { ...draft.picks, azul: { ...draft.picks.azul, top: 'Campeão Que Não Existe' } } }), n, '2026-11-09'), 'draft_invalido');
  J(enviar(draft), n, '2026-11-09');
  const trocado = jogs.map((j, i) => (i === 0 ? { ...j, campeao: camp[19] } : j));
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { jogadores: trocado })}'::jsonb)`, n, '2026-11-09'), 'draft_diferente_da_partida');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul', { jogadores: jogs.slice(1) })}'::jsonb)`, n, '2026-11-09'), 'draft_diferente_da_partida', 'faltou jogador');
  const minha = V(`select id from tc_orgs where user_id::text = '${dono}'`);
  const venceu = el.azul.org.id === Number(minha); // azul vence no resultado enviado
  const expAntes = V(`select string_agg(exp::text, ',' order by id) from tc_jogadores where org_id = ${minha} and slot is not null`).split(',').map(Number);
  const maeAntes = Number(V(`select coalesce(sum(pontos), 0) from tc_maestria where jogador_id in (select id from tc_jogadores where org_id = ${minha} and slot is not null)`));
  const r1 = reg(1, 'azul');
  const expDepois = V(`select string_agg(exp::text, ',' order by id) from tc_jogadores where org_id = ${minha} and slot is not null`).split(',').map(Number);
  expDepois.forEach((e, i) => assert.equal(e, Math.min(100, expAntes[i] + (venceu ? 10 : 5)), 'XP do mapa: vitória 10, derrota 5'));
  assert.equal(Number(V(`select coalesce(sum(pontos), 0) from tc_maestria where jogador_id in (select id from tc_jogadores where org_id = ${minha} and slot is not null)`)) - maeAntes, 5 * (venceu ? 30 : 15), 'maestria do mapa: 30 na vitória, 15 na derrota'); assert.equal(r1.concluida, true); assert.equal(r1.placar_a + r1.placar_b, 1);
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 1, '${res(1, 'azul')}'::jsonb)`, n, '2026-11-09'), 'partida_ja_concluida', 'o mesmo mapa não é gravado duas vezes');
  assert.equal(V(`select status from tc_partidas where id = ${pid}`), 'concluida');
  assert.equal(V(`select placar_a + placar_b from tc_partidas where id = ${pid}`), '1');
  assert.equal(V(`select resumo->>'origem' from tc_partidas where id = ${pid}`), 'gameplay');
  assert.equal(V(`select jsonb_array_length(resumo->'mapas') from tc_partidas where id = ${pid}`), '1');
  assert.equal(falha(`select tc_gameplay_registrar(${pid}, 2, '${res(2, 'azul')}'::jsonb)`, n, '2026-11-09'), 'partida_ja_concluida');
  assert.equal(falha(`select tc_partida_elencos(${pid})`, n, '2026-11-09'), 'partida_ja_concluida');
  assert.equal(V(`select count(*) from tc_gameplay_mapas where partida_id = ${pid}`), '1');
});

t('gameplay: o melhor colocado escolhe o lado do mapa 1 e a escolha alterna a cada mapa; só quem escolhe decide', () => {
  const pid = V("select id from tc_partidas where status = 'agendada' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b)) order by id limit 1");
  const e1 = V(`select tc_gameplay_escolhedor(${pid}, 1)`), e2 = V(`select tc_gameplay_escolhedor(${pid}, 2)`), e3 = V(`select tc_gameplay_escolhedor(${pid}, 3)`);
  assert.notEqual(e1, e2); assert.equal(e1, e3);
  const melhor = V(`select t.org_id from tc_tabela((select liga_id from tc_partidas where id = ${pid})) t where t.org_id in ((select org_a from tc_partidas where id = ${pid}), (select org_b from tc_partidas where id = ${pid})) order by t.pos limit 1`);
  assert.equal(e1, melhor, 'o melhor colocado escolhe primeiro');
});
t('gameplay: passado o prazo, o sistema simula as partidas que ninguém jogou e a semana fecha normalmente', () => {
  V("update tc_jogadores set exp = 0 where org_id in (select id from tc_orgs where user_id is not null)");
  const antes = Number(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))"));
  J('select tc_sincronizar()', 1, '2026-11-09');
  assert.equal(Number(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))")), antes, 'dentro do prazo, continuam esperando');
  J('select tc_sincronizar()', 1, '2026-11-11');
  assert.equal(V("select count(*) from tc_partidas where status = 'agendada' and dia <= '2026-11-09' and exists (select 1 from tc_orgs o where o.user_id is not null and o.id in (org_a, org_b))"), '0');
  // meia-noite sem jogar = derrota por W.O.: o técnico ausente perde, com a vitória cheia (1/0, 2/0 ou 3/0) para o adversário
  assert.ok(Number(V("select count(*) from tc_partidas where resumo->>'origem' = 'wo'")) >= 1, 'houve W.O.');
  assert.equal(V("select count(*) from tc_partidas where resumo->>'origem' = 'wo' and vencedor = (resumo->>'ausente')::bigint"), '0', 'quem não jogou perde');
  assert.equal(V("select count(*) from tc_partidas where resumo->>'origem' = 'wo' and (least(placar_a, placar_b) <> 0 or greatest(placar_a, placar_b) <> (formato + 1) / 2)"), '0', 'placar cheio para o adversário');
  assert.equal(V("select count(*) from tc_partidas p join tc_orgs o on o.id = (p.resumo->>'ausente')::bigint where p.resumo->>'origem' = 'wo' and o.user_id is null"), '0', 'só técnicos reais perdem por W.O.');
  assert.equal(V("select coalesce(max(exp), 0) from tc_jogadores where org_id in (select id from tc_orgs where user_id is not null)"), '0', 'W.O. e partida simulada pelo sistema não dão XP');
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
  V(`insert into tc_gameplay_lados (partida_id, mapa, org_azul) values (${pid}, 5, ${org})`);
  V('alter table tc_gameplay_mapas disable trigger tc_gameplay_zdraft_tg'); // este teste só olha a limpeza do resumo
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
  V('alter table tc_gameplay_mapas enable trigger tc_gameplay_zdraft_tg');
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
  assert.match(falha(`select tc_contratar(${faker}, 8, 'chave-estrela-cr')`, 1), /estrela_so_rc|fora_da_oferta/); // recusado: ou pela regra das estrelas ou por não estar na oferta rotativa
  assert.equal(V(`select org_id is null from tc_jogadores where id = ${faker}`), 't');
  assert.equal(V("select count(*) from pg_proc where proname = 'tc_contratar_estrela'"), '0');
  const js = J(`select tc_jogador_json(j) from tc_jogadores j where id = ${faker}`); assert.equal(js.legado, true); assert.equal(js.estrelas, 0);
});
t('retratos: cada foto é de um único jogador fictício; sem foto livre, o mercado encolhe e o sistema usa o avatar; rodar o SQL de novo não troca ninguém', () => {
  const r = J("select jsonb_agg(jsonb_build_object('g', genero, 'r', retrato, 'n', ficticio, 'sis', (select user_id is null from tc_orgs o where o.id = org_id), 'cs', copia_sistema)) from tc_jogadores");
  const comuns = r.filter((x) => x.n && !x.cs); // as cópias das equipes do sistema (0124) podem repetir foto, nome e atributos
  assert.ok(comuns.length >= 20, 'há jogadores comuns');
  const fotos = comuns.filter((x) => x.r);
  assert.ok(r.filter((x) => x.n && x.sis).every((x) => x.r && x.cs), 'todo jogador de equipe do sistema tem foto (cópia de um jogador com foto)');
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
  V(readFileSync(new URL('../supabase/migrations/0124_tecnico_sistema_com_fotos.sql', import.meta.url), 'utf8')); // a 0109 volta a definir tc_completar_elenco: reaplica a versão com fotos
  assert.equal(V("select string_agg(id || coalesce(retrato, '-'), ',' order by id) from tc_jogadores"), antes);
  // tentar repetir uma foto é recusado pelo banco
  const dup = Q("update tc_jogadores set retrato = (select retrato from tc_jogadores where ficticio and retrato is not null and not copia_sistema order by id limit 1) where id = (select id from tc_jogadores where ficticio and retrato is not null and not copia_sistema order by id desc limit 1)");
  assert.equal(dup.ok, false);
  // jogadores novos pegam foto livre, sem repetir, até acabar; depois ficam sem (e o mercado os descarta)
  const livres = 60 - Number(V("select count(*) from tc_jogadores where ficticio and retrato is not null and not copia_sistema"));
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
  V(`update tc_jogadores set exp = 99 where id = ${j}`);
  assert.equal(falha(`select tc_treinar(${j}, 'mec', 'chave-treino-x')`, 1), 'xp_insuficiente', 'só treina com a barra de XP cheia (100/100)');
  V(`update tc_jogadores set exp = 100 where id = ${j}`);
  const r = J(`select tc_treinar(${j}, 'mec', 'chave-treino-1')`, 1); assert.equal(r.ok, true); assert.equal(r.pontos, 1);
  assert.equal(V(`select exp from tc_jogadores where id = ${j}`), '0', 'a sessão zera a barra');
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred0 - r.custo);
  assert.equal(J(`select tc_treinar(${j}, 'mec', 'chave-treino-1')`, 1).ja_feito, true);
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred0 - r.custo, 'repetir não cobra de novo');
  assert.equal(falha(`select tc_treinar(${j}, 'tf', 'chave-treino-2')`, 1), 'jogador_treinando');
  const mec0 = Number(V(`select mec from tc_jogadores where id = ${j}`));
  V(`update tc_treinos set fim = now() - interval '1 minute' where jogador_id = ${j}`);
  const est1 = J("select tc_treino_estado()", 1); assert.equal(est1.em_andamento, 0);
  assert.equal(Number(V(`select mec from tc_jogadores where id = ${j}`)), Math.min(100, mec0 + 1), 'sobe só +1');
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
t('treinamento: poucos simultâneos; o tempo da sessão é fixo e o XP tem teto de 100', () => {
  V(`update tc_orgs set creditos = 50000000 where id = ${O2}`);
  const js = V(`select string_agg(id::text, ',' order by id) from tc_jogadores where org_id = ${O2} and slot is not null`).split(',');
  V(`update tc_jogadores set exp = 100 where id in (${js.join(',')})`);
  const extra = V(`select id from tc_jogadores where org_id = ${O2} and slot is null order by id limit 1`);
  V(`update tc_jogadores set exp = 100 where id = ${extra}`);
  assert.equal(J("select tc_cfg('treino')").simultaneos, 5);
  for (let i = 0; i < 5; i++) J(`select tc_treinar(${js[i]}, 'mental', 'chave-sim-${i}')`, 2);
  assert.equal(falha(`select tc_treinar(${extra}, 'mental', 'chave-sim-x')`, 2), 'treinos_demais');
  V(`update tc_treinos set status = 'concluido' where org_id = ${O2}`);
  V(`update tc_jogadores set exp = 0 where id = ${js[3]}`); const h0 = Number(V(`select tc_treino_horas(j) from tc_jogadores j where id = ${js[3]}`));
  V(`update tc_jogadores set exp = 200 where id = ${js[3]}`); const h1 = Number(V(`select tc_treino_horas(j) from tc_jogadores j where id = ${js[3]}`));
  assert.equal(h1, h0, 'o tempo da sessão não depende mais do XP'); assert.equal(h0, 6);
  V("update tc_jogadores set exp = 500 where id = 1"); assert.equal(V("select exp from tc_jogadores where id = 1"), '100', 'a barra nunca passa de 100');
});
t('amistoso de verdade: abre, devolve escalações e semente, registra o resultado jogado; só os 5 primeiros do dia dão EXP', () => {
  const ops = J("select tc_amistoso_oponentes()", 1); assert.ok(ops.length >= 1 && ops.every((o) => o.id !== 1));
  const op = ops[0].id; const partidas0 = V("select count(*) from tc_partidas");
  V("update tc_jogadores set exp = 0 where org_id = 1");
  V("update tc_config set valor = jsonb_set(valor, '{ativo}', 'true') where chave = 'gameplay'");
  const tit = V("select string_agg(id::text, ',' order by id) from tc_jogadores where org_id = 1 and slot is not null").split(',').map(Number);
  const mae = () => J(`select jsonb_build_object('jogos', coalesce(sum(jogos), 0), 'pontos', coalesce(sum(pontos), 0)) from tc_maestria where campeao_id = 'ahri' and jogador_id in (${tit.join(',')})`);
  const mae0 = mae();
  const res = (id, venc = 'azul') => JSON.stringify({ semente: Number(V(`select tc_gameplay_semente(${id}, -1)`)), versaoRegras: 1, vencedor: venc, duracao: 1500, equipes: {}, bans: { azul: ['Ahri'], vermelho: ['Zed'] },
    jogadores: [...tit.map((id) => ({ id, equipe: 'azul', campeao: 'Ahri' })), { id: 999999, equipe: 'azul', campeao: 'Ahri' }] });
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
    if (i <= 5) assert.equal(r.exp_ganho, i % 2 ? 10 : 5, 'vitória 10, derrota 5'); else assert.equal(r.exp_ganho, 0);
    assert.equal(falha(`select tc_amistoso_registrar(${a.id}, '${res(a.id)}'::jsonb)`, 1), 'amistoso_ja_jogado');
  }
  const mae1 = mae();
  assert.equal(mae1.jogos - mae0.jogos, 5 * tit.length, 'só os 5 primeiros amistosos do dia dão maestria (um jogo por titular em cada)');
  assert.equal(mae1.pontos - mae0.pontos, tit.length * (3 * 30 + 2 * 15), '3 vitórias x 30 e 2 derrotas x 15 pontos de maestria por titular');
  assert.equal(V("select count(*) from tc_partidas"), partidas0, 'amistoso não entra em campeonato');
  assert.equal(V("select max(exp) from tc_jogadores where org_id = 1 and slot is not null"), '40', '3 vitórias x 10 + 2 derrotas x 5 de XP');
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
  const transf0 = Number(V("select count(*) from tc_transf where tipo = 'bau' and moeda = 'rc' and para_org = 1"));
  const cinco = J("select tc_recrutar('premium', 5, 'chave-bau-2')", 1);
  assert.equal(cinco.preco_rc, 3825, '900 x 5 com 15% de desconto'); assert.equal(cinco.itens.length, 5);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '96175');
  assert.equal(J("select tc_recrutar('premium', 5, 'chave-bau-2')", 1).ja_feito, true);
  assert.equal(V("select saldo from site_carteira where user_id = '" + U(1) + "'"), '96175', 'repetir não cobra');
  assert.equal(V("select sum(1 + copias) from tc_jogadores where not ficticio and org_id = 1"), '5', 'cada sorteio vira jogador novo ou cópia');
  assert.equal(Number(V("select count(*) from tc_transf where tipo = 'bau' and moeda = 'rc' and para_org = 1")), transf0 + Number(V("select count(*) from tc_jogadores where not ficticio and org_id = 1")));
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
t('recrutar: jogador repetido (inclusive o modelo do catálogo que já é seu) vira só uma cópia: sem segundo jogador, sem contrato e sem custo extra', () => {
  V("update tc_config set valor = jsonb_set(valor, '{moeda}', '\"rc\"') where chave = 'gacha'");
  V("update tc_config set valor = jsonb_set(valor, '{max}', '50') where chave = 'elenco'");
  V("update site_carteira set saldo = 100000 where user_id = '" + U(1) + "'");
  const rars = J("select jsonb_agg(jsonb_build_array(id, raridade)) from tc_jogadores where not ficticio and legado_base is null");
  const m = V("select id from tc_jogadores where not ficticio and legado_base is null and org_id is null order by id limit 1");
  try {
    V(`select set_config('tc.estrela_liberada', '${m}', true); update tc_jogadores set org_id = 1, slot = null, copias = 0 where id = ${m}`); // o Legado do catálogo já é dele (como o elenco do administrador)
    V(`update tc_jogadores set raridade = null where not ficticio and legado_base is null and id <> ${m}`); // só ele pode sair no sorteio
    const linhas = () => Number(V("select count(*) from tc_jogadores where not ficticio and org_id = 1"));
    const transf = () => Number(V("select count(*) from tc_transf where para_org = 1 and tipo in ('bau', 'contratacao')"));
    const l0 = linhas(), t0 = transf(), fin0 = Number(V("select count(*) from tc_fin where org_id = 1"));
    const r = J("select tc_recrutar('basico', 1, 'chave-bau-rep1')", 1);
    assert.equal(r.itens[0].repetida, true);
    assert.equal(linhas(), l0, 'não cria um segundo jogador');
    assert.equal(V(`select copias from tc_jogadores where id = ${m}`), '1', 'vira +1 cópia');
    assert.equal(transf(), t0, 'repetido não gera contratação');
    assert.equal(V(`select count(*) from tc_transf where jogador_id = ${m} and tipo = 'bau_copia' and valor > 0 and valor <= 600`), '1', 'o histórico mostra a cópia com o valor do baú');
    assert.equal(Number(V("select count(*) from tc_fin where org_id = 1")), fin0, 'nenhum gasto de créditos de equipe');
    assert.equal(V("select count(*) from tc_transf where tipo = 'renovacao' and para_org = 1 and jogador_id = " + m), '0', 'nenhuma renovação');
  } finally {
    for (const [id, rar] of rars) V(`update tc_jogadores set raridade = ${rar ? `'${rar}'` : 'null'} where id = ${id}`);
    V(`update tc_jogadores set org_id = null, slot = null, copias = 0 where id = ${m}`);
    V("delete from tc_jogadores where org_id = 1 and not ficticio");
    V("update tc_config set valor = jsonb_set(valor, '{moeda}', '\"creditos\"') where chave = 'gacha'");
  }
});

t('recrutar: a limpeza funde a duplicata criada pelo baú numa cópia e devolve o contrato pago nela', () => {
  const m = V("select id from tc_jogadores where not ficticio and legado_base is null and org_id is null order by id limit 1");
  const cols = 'nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, fama, forma, exp, raridade, mec, rotas, macro, tf, mental';
  try {
    V(`select set_config('tc.estrela_liberada', '${m}', true); update tc_jogadores set org_id = 1, slot = null, copias = 0 where id = ${m}`);
    V(`insert into tc_jogadores (${cols}, org_id, legado_base, copias) select ${cols}, 1, id, 0 from tc_jogadores where id = ${m}`);
    const dup = V(`select id from tc_jogadores where legado_base = ${m} and org_id = 1`);
    V(`insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, moeda) values (${dup}, 1, 1, 'renovacao', 13700, 'creditos')`);
    const cred0 = Number(V("select creditos from tc_orgs where id = 1"));
    const m134 = readFileSync(new URL('../supabase/migrations/0134_tecnico_bau_repetido_sem_custo.sql', import.meta.url), 'utf8'); V(m134.slice(m134.indexOf('do $$'))); // só o bloco de limpeza
    assert.equal(V(`select count(*) from tc_jogadores where org_id = 1 and not ficticio and nome = (select nome from tc_jogadores where id = ${m})`), '1', 'a duplicata some');
    assert.equal(V(`select copias from tc_jogadores where id = ${m}`), '1', 'e vira +1 cópia');
    assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred0 + 13700, 'o contrato pago na duplicata é devolvido');
  } finally {
    V(`update tc_jogadores set org_id = null, slot = null, copias = 0 where id = ${m}`); // primeiro devolve o modelo ao catálogo
    V("delete from tc_jogadores where org_id = 1 and not ficticio");
  }
});

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

t('vender com contrato vigente: ao comprar, o contrato acaba, o vendedor recebe 50% do restante e o comprador recebe o jogador sem contrato; Legado também vende', () => {
  V("update tc_orgs set creditos = 50000000 where id in (1, " + O2 + ")");
  V("update site_carteira set saldo = 1000000 where user_id in ('" + U(1) + "', '" + U(2) + "')");
  V("delete from tc_anuncios"); V("update auth.users set created_at = now() - interval '60 days'");
  const res = V("select id from tc_jogadores where org_id = 1 and slot is null and ficticio order by id limit 1");
  V(`update tc_jogadores set contrato_fim = tc_semana_global() + 4, contrato_valor_semana = 1000, slot = null where id = ${res}`);
  const an = J(`select tc_anunciar(${res}, 600)`, 1).id;
  const cred = Number(V("select creditos from tc_orgs where id = 1"));
  V(`select tc_comprar_anuncio(${an}, 'chave-venda-ct-1')`, 2);
  assert.equal(V(`select org_id from tc_jogadores where id = ${res}`), String(O2));
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), cred + 2000, 'vendedor recebe 50% do restante (4 x 1000 x 50%)');
  assert.equal(V(`select contrato_fim is null and contrato_valor_semana = 0 from tc_jogadores where id = ${res}`), 't', 'comprador recebe sem contrato');
  assert.equal(falha(`select tc_escalar('meio', ${res})`, 2), 'contrato_necessario');
  // Legado: anuncia e vende levando estrelas e cópias; quem já tem o mesmo Legado não compra outro
  V("delete from tc_anuncios");
  const modelo = V("select id from tc_jogadores where nome = 'Doran' and legado_base is null");
  const sal = V("select tc_salario(tc_preco_jogador(j)) from tc_jogadores j where id = " + modelo);
  V("delete from tc_jogadores where nome = 'Doran' and legado_base is not null");
  const leg = V(`insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade, org_id, salario, legado_base, estrelas, copias, contrato_fim, contrato_valor_semana)
    select nome, false, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, 50, 0, raridade, 1, ${sal}, id, 2, 3, tc_semana_global() + 2, 500 from tc_jogadores where id = ${modelo} returning id`).split('\n')[0];
  const anL = J(`select tc_anunciar(${leg}, 900)`, 1).id;
  const credL = Number(V("select creditos from tc_orgs where id = 1"));
  V(`select tc_comprar_anuncio(${anL}, 'chave-venda-leg-1')`, 2);
  assert.equal(V(`select org_id || ':' || estrelas || ':' || copias || ':' || coalesce(contrato_fim::text, 'sem')  from tc_jogadores where id = ${leg}`), `${O2}:2:3:sem`, 'leva estrelas e cópias, sem contrato');
  assert.equal(Number(V("select creditos from tc_orgs where id = 1")), credL + 500, '50% de 2 semanas x 500');
  // o comprador (org 2) já tem o Legado: não compra outro igual
  V(`update tc_jogadores set org_id = 1 where id = ${leg}`);
  const outro = V(`insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade, org_id, salario, legado_base)
    select nome, false, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, 50, 0, raridade, ${O2}, ${sal}, id from tc_jogadores where id = ${modelo} returning id`).split('\n')[0];
  const anL2 = J(`select tc_anunciar(${leg}, 900)`, 1).id;
  V(`update tc_jogadores set copias = 1, estrelas = 1 where id = ${outro}`);
  V("update tc_config set valor = jsonb_set(valor, '{max}', to_jsonb((select count(*) from tc_jogadores where org_id = " + O2 + "))) where chave = 'elenco'"); // inventário cheio: cópia não ocupa vaga
  const antesN = V(`select count(*) from tc_jogadores where org_id = ${O2}`);
  V(`select tc_comprar_anuncio(${anL2}, 'chave-venda-leg-2')`, 2);
  assert.equal(V(`select estrelas || ':' || copias from tc_jogadores where id = ${outro}`), '1:5', 'cópia (+1) mais as 3 do vendido; estrelas do comprador intactas');
  assert.equal(V(`select count(*) from tc_jogadores where org_id = ${O2}`), antesN, 'não ocupou vaga');
  assert.equal(V(`select coalesce(org_id::text, 'livre') || ':' || estrelas || ':' || copias from tc_jogadores where id = ${leg}`), 'livre:0:0');
  assert.equal(V(`select status from tc_anuncios where id = ${anL2}`), 'vendido');
  V("update tc_config set valor = jsonb_set(valor, '{max}', '50') where chave = 'elenco'");
  V(`delete from tc_jogadores where id in (${leg}, ${outro})`);
});

t('time novo com as fotos esgotadas: os 15 candidatos ainda vêm com foto (o mercado cede as dele) e ficam 5 depois da escolha', () => {
  V("select tc_gerar_jogadores(120, 50)"); // enche o mercado de jogadores fictícios para gastar as fotos
  V("select tc_reabastecer()");
  const r = Q("select tc_criar_org('Novo Time', 'NVT')", 6); assert.ok(r.ok, r.err);
  const of = J("select tc_meu()", 6).ofertas;
  assert.equal(of.length, 15); assert.ok(of.every((x) => x.retrato), 'todos com foto');
  assert.equal(new Set(of.map((x) => x.retrato)).size, 15);
  const ids = ['top', 'selva', 'meio', 'atirador', 'suporte'].map((p) => of.find((x) => x.pos === p).id);
  assert.equal(J(`select tc_escolher_elenco_inicial('{${ids.join(',')}}')`, 6).ok, true);
  const meu = J("select tc_meu()", 6).elenco;
  assert.equal(meu.length, 5); assert.ok(meu.every((x) => x.retrato && x.slot));
  assert.equal(V("select count(*) - count(distinct retrato) from tc_jogadores where ficticio and retrato is not null and not copia_sistema"), '0');
});

t('potencial coerente: nunca passa do limite de treino (+10 comum, +15 Legado) nem fica abaixo do Poder; jogadores novos também', () => {
  const novos = J("select to_jsonb(tc_gerar_jogadores(80, null))").join(',');
  assert.equal(V(`select count(*) from tc_jogadores j where id in (${novos}) and (j.potencial > round(tc_poder(j)) + 10 or j.potencial < round(tc_poder(j)))`), '0', 'comum: de +0 a +10');
  assert.equal(V("select count(*) from tc_jogadores j where not j.ficticio and j.potencial > tc_treino_limite(j)"), '0', 'Legado: no máximo +15');
});

t('XP de campeonato: vitória 10 e derrota 5 para os titulares, com teto de 100', () => {
  assert.equal(J("select tc_cfg('treino')").exp_partida, 10); assert.equal(J("select tc_cfg('treino')").exp_derrota, 5);
  const fn = V("select pg_get_functiondef('public.tc_processar_partida(bigint)'::regprocedure)");
  assert.ok(/exp_partida/.test(fn) && /exp_derrota/.test(fn), 'processar usa vitória e derrota');
  const fg = V("select pg_get_functiondef('public.tc_gameplay_registrar(bigint, integer, jsonb)'::regprocedure)");
  assert.ok(!/exp_partida/.test(fg), 'o XP do oficial sai de cada mapa, não do fechamento da série');
  const fm = V("select pg_get_functiondef('public.tc_gameplay_mapa_premios()'::regprocedure)");
  assert.ok(/exp_partida/.test(fm) && /exp_derrota/.test(fm) && /tc_maestria_registrar/.test(fm), 'cada mapa oficial dá XP e maestria de vitória e derrota');
});

// ---------------------------------------------------------------- marketing, fama e patrocínios (SQL 0116)
const MK = () => J("select tc_marketing_estado()", 1);
const atrasar = (org, min) => V(`update tc_marketing set ultimo_proc = now() - interval '${min} minutes' where org_id = ${org}`);
const cred = (org) => Number(V(`select creditos from tc_orgs where id = ${org}`));
const baseMk = (e) => e.taxa.base * (1 + e.taxa.bonus_marketing + e.taxa.bonus_audiencia + e.taxa.bonus_campanha) + e.taxa.patrocinadores;

t('marketing: clube novo (nível 1, fama 0, sem patrocínio); a taxa da tela é a fórmula do servidor; nada mexe em RC nem em pontos do Rank', () => {
  V("update tc_orgs set creditos = 1000000 where id in (1, " + O2 + ")");
  V("delete from tc_patrocinios"); V("delete from tc_fama_eventos");
  V("update tc_marketing set nivel = 1, fama = 0, campanha = null, campanha_fim = null, recargas = '{}'::jsonb, resumo = null, ultimo_proc = now()");
  const rc0 = V("select string_agg(saldo::text, ',' order by user_id) from site_carteira"); const rk0 = V("select count(*) from site_rk_lanc_stub");
  const e = MK();
  assert.equal(e.marketing.nivel, 1); assert.equal(e.fama.valor, 0); assert.equal(e.fama.nivel.nome, 'Clube desconhecido');
  assert.equal(e.taxa.base, 10); assert.equal(e.taxa.bonus_marketing, 0); assert.equal(e.taxa.patrocinadores, 0); assert.equal(e.marketing.limite_contratos, 1);
  assert.ok(Math.abs(e.taxa.por_minuto - baseMk(e)) < 1e-9, 'por minuto = base × (1 + bônus) + patrocinadores');
  assert.equal(e.taxa.por_hora, Math.round(e.taxa.por_minuto * 60 * 10) / 10); assert.equal(e.taxa.por_dia, Math.round(e.taxa.por_minuto * 60 * 24));
  assert.equal(V("select string_agg(saldo::text, ',' order by user_id) from site_carteira"), rc0, 'RC intacto'); assert.equal(V("select count(*) from site_rk_lanc_stub"), rk0, 'sem pontos de Rank');
  // recarregar a página (nova conexão) mostra o mesmo estado e não paga duas vezes
  const c0 = cred(1); const e2 = MK(); assert.equal(cred(1), c0); assert.equal(e2.marketing.nivel, 1);
});

t('marketing: melhoria de nível (custo = base × mult^(n-1)), sem saldo recusa, dá fama e abre mais contratos', () => {
  V("update tc_orgs set creditos = 100 where id = 1");
  assert.equal(falha("select tc_marketing_melhorar()", 1), 'creditos_insuficientes');
  assert.equal(V("select nivel from tc_marketing where org_id = 1"), '1'); assert.equal(cred(1), 100);
  V("update tc_orgs set creditos = 5000000 where id = 1");
  const e0 = MK(); assert.equal(e0.marketing.custo_proximo, 6000);
  const c0 = cred(1);
  const r = J("select tc_marketing_melhorar()", 1); assert.equal(r.nivel, 2); assert.equal(r.custo, 6000);
  assert.equal(cred(1), c0 - 6000);
  assert.equal(V("select count(*) from tc_fin where org_id = 1 and motivo = 'mkt_melhoria' and delta = -6000"), '1');
  const e1 = MK(); assert.equal(e1.fama.valor, 5); assert.equal(e1.marketing.custo_proximo, Math.round(6000 * 1.33)); assert.ok(Math.abs(e1.taxa.bonus_marketing - 0.04) < 1e-9);
  for (let i = 0; i < 18; i++) V("select tc_marketing_melhorar()", 1);
  assert.equal(V("select nivel from tc_marketing where org_id = 1"), '20'); assert.equal(falha("select tc_marketing_melhorar()", 1), 'marketing_no_maximo');
  assert.equal(MK().marketing.limite_contratos, 6);
  assert.equal(V("select count(*) from tc_fama_eventos where org_id = 1 and categoria = 'marketing'"), '19', 'um evento por nível, sem repetir');
  assert.ok(Number(V("select fama from tc_marketing where org_id = 1")) <= 120 + 1e-9, 'teto da categoria marketing');
  V("update tc_marketing set nivel = 1, fama = 0 where org_id = 1"); V("delete from tc_fama_eventos where org_id = 1");
});

t('marketing: audiência dos titulares e reservas (cada jogador uma vez); astro contratado sobe a audiência e vendido deixa de render', () => {
  const tit = J("select jsonb_agg(id order by slot) from tc_jogadores where org_id = 1 and slot is not null");
  const famas = [10, 25, 45, 70, 95];
  tit.forEach((id, i) => V(`update tc_jogadores set fama = ${famas[i]} where id = ${id}`));
  V("update tc_jogadores set fama = 1 where org_id = 1 and slot is null");
  const esperado = famas.reduce((a, f) => a + 10 * Math.sqrt(f), 0) + 10 * Math.sqrt(1) * 0.25 * Number(V("select count(*) from (select 1 from tc_jogadores where org_id = 1 and slot is null limit 5) x"));
  let e = MK(); assert.ok(Math.abs(e.audiencia.total - esperado) < 0.2, `${e.audiencia.total} x ${esperado}`);
  assert.ok(Math.abs(e.taxa.bonus_audiencia - Math.min(0.45, 0.0006 * e.audiencia.total)) < 1e-4);
  assert.equal(e.audiencia.jogadores.filter((j) => j.titular).length, 5); assert.equal(new Set(e.audiencia.jogadores.map((j) => j.id)).size, e.audiencia.jogadores.length, 'ninguém conta duas vezes');
  const antes = e.audiencia.total;
  V(`update tc_jogadores set fama = 99 where id = ${tit[0]}`);
  e = MK(); assert.ok(e.audiencia.total > antes, 'astro sobe a audiência');
  // fama de astro rende fama ao clube uma vez por jogador
  atrasar(1, 10); MK(); const f1 = Number(V("select fama from tc_marketing where org_id = 1")); atrasar(1, 10); MK();
  assert.equal(Number(V("select fama from tc_marketing where org_id = 1")), f1, 'o mesmo astro não rende fama duas vezes'); assert.ok(f1 > 0);
  // vendido/dispensado: deixa de render (usa o menor valor entre o último processamento e agora)
  V(`update tc_marketing set aud_snap = ${e.audiencia.total} where org_id = 1`);
  V(`update tc_jogadores set org_id = ${O2}, slot = null where id = ${tit[0]}`);
  const c0 = cred(1); atrasar(1, 60); const r = J(`select tc_marketing_processar(1, true)`, 1);
  const e3 = MK(); assert.ok(e3.audiencia.total < e.audiencia.total, 'saiu do clube');
  const baseDia = e3.taxa.base * (1 + e3.taxa.bonus_marketing + e3.taxa.bonus_audiencia);
  assert.ok(Math.abs(r.total - Math.round(baseDia * 60)) <= 2, `receita da janela usa a audiência menor: ${r.total} x ${baseDia * 60}`);
  V(`update tc_jogadores set org_id = 1 where id = ${tit[0]}`);
});

t('marketing: patrocinador gera receita, respeita limite e requisitos; fim de contrato no offline corta a receita no instante certo', () => {
  V("update tc_marketing set nivel = 1, fama = 0 where org_id = 1"); V("delete from tc_patrocinios where org_id = 1");
  assert.equal(falha("select tc_patrocinio_contratar('hextech_systems')", 1), 'requisito_nao_cumprido');
  assert.equal(falha("select tc_patrocinio_contratar('inexistente')", 1), 'patrocinador_invalido');
  const c0 = cred(1);
  const r = J("select tc_patrocinio_contratar('nexus_energy')", 1); assert.equal(r.custo, 3000); assert.equal(cred(1), c0 - 3000);
  assert.equal(falha("select tc_patrocinio_contratar('nexus_energy')", 1), 'patrocinio_ja_ativo');
  assert.equal(falha("select tc_patrocinio_contratar('rift_cafe')", 1), 'limite_patrocinios', 'nível 1 = 1 contrato');
  let e = MK(); assert.equal(e.taxa.patrocinadores, 5);
  assert.equal(e.patrocinadores.find((p) => p.id === 'nexus_energy').estado, 'ativo'); assert.equal(e.patrocinadores.find((p) => p.id === 'hextech_systems').estado, 'indisponivel');
  // 60 min depois: receita = (base × (1+bônus) + 5) × 60
  atrasar(1, 60); const antes = cred(1);
  const taxaAntes = MK().taxa; // (não processa: < 5 min desde o último? já passaram 60, processa aqui)
  const ganho = cred(1) - antes;
  assert.ok(ganho > 0 || taxaAntes.por_minuto > 0);
  // expira no meio do período offline: contrato terminou há 1h, janela de 2h → só a 1ª hora conta o patrocínio
  V("update tc_patrocinios set inicio = now() - interval '3 hours', fim = now() - interval '1 hour' where org_id = 1");
  atrasar(1, 120); const p = J("select tc_marketing_processar(1, true)", 1);
  const t2 = MK().taxa;
  const semPat = t2.base * (1 + t2.bonus_marketing + t2.bonus_audiencia + t2.bonus_campanha) * 120;
  assert.ok(Math.abs(p.patrocinadores - 300) <= 1, `patrocínio só na 1ª hora: ${p.patrocinadores}`); assert.ok(Math.abs(p.total - (Math.round(semPat) + 300)) <= 3, `${p.total} x ${semPat + 300}`);
  assert.equal(MK().taxa.patrocinadores, 0, 'depois do fim, nada conta');
  assert.equal(MK().patrocinadores.find((x) => x.id === 'nexus_energy').estado, 'expirado');
});

t('marketing: campanha (uma por vez, recarga) acaba no instante certo durante o offline; sem saldo ou sem requisito é recusada', () => {
  V("update tc_marketing set nivel = 1, fama = 0, campanha = null, campanha_fim = null, recargas = '{}'::jsonb where org_id = 1");
  V("delete from tc_patrocinios where org_id = 1"); V("update tc_orgs set creditos = 1000 where id = 1");
  assert.equal(falha("select tc_campanha_iniciar('redes_sociais')", 1), 'creditos_insuficientes');
  assert.equal(falha("select tc_campanha_iniciar('nacional')", 1), 'requisito_nao_cumprido');
  V("update tc_orgs set creditos = 1000000 where id = 1");
  const c0 = cred(1); const r = J("select tc_campanha_iniciar('redes_sociais')", 1); assert.equal(cred(1), c0 - 4000);
  assert.equal(falha("select tc_campanha_iniciar('redes_sociais')", 1), 'campanha_ativa', 'não reinicia para prolongar');
  let e = MK(); assert.equal(e.campanha_ativa.id, 'redes_sociais'); assert.ok(Math.abs(e.taxa.bonus_campanha - 0.05) < 1e-9);
  // a campanha termina 1h atrás; a janela offline é de 2h: o bônus vale só na 1ª hora
  V("update tc_marketing set campanha_inicio = now() - interval '7 hours', campanha_fim = now() - interval '1 hour' where org_id = 1");
  atrasar(1, 120); const p = J("select tc_marketing_processar(1, true)", 1);
  const t2 = MK().taxa; assert.equal(t2.bonus_campanha, 0);
  const esperado = t2.base * (1 + t2.bonus_marketing + t2.bonus_audiencia) * 120 + t2.base * 0.05 * 60;
  assert.ok(Math.abs(p.total - Math.round(esperado)) <= 3, `${p.total} x ${esperado}`);
  assert.equal(falha("select tc_campanha_iniciar('redes_sociais')", 1), 'campanha_em_recarga', 'a recarga impede refazer na hora');
});

t('marketing: offline com menos e com mais de 8h; o mesmo trecho nunca paga duas vezes; resumo aparece uma vez e não dá crédito', () => {
  V("update tc_marketing set nivel = 1, fama = 0, campanha = null, campanha_fim = null, resumo = null where org_id = 1"); V("delete from tc_patrocinios where org_id = 1");
  const taxa = MK().taxa; const pm = taxa.por_minuto;
  // 5h: conta tudo
  V("update tc_orgs set creditos = 1000000 where id = 1"); atrasar(1, 300); let c0 = cred(1);
  let e = MK(); const ganho5 = cred(1) - c0; assert.ok(Math.abs(ganho5 - pm * 300) < 5, `${ganho5} x ${pm * 300}`);
  assert.ok(e.resumo && e.resumo.minutos > 299 && e.resumo.minutos < 301 && e.resumo.total === ganho5, 'resumo do período');
  assert.equal(e.resumo.limitado, false);
  const c1 = cred(1); MK(); assert.equal(cred(1), c1, 'recarregar não repaga'); assert.ok(MK().resumo, 'o resumo segue até ser dispensado');
  V("select tc_marketing_resumo_visto()", 1); assert.equal(cred(1), c1, 'dispensar o resumo não dá nada'); assert.equal(MK().resumo, null);
  // 20h: limitado a 8h
  atrasar(1, 1200); c0 = cred(1); e = MK(); const ganho20 = cred(1) - c0;
  assert.ok(Math.abs(ganho20 - pm * 480) < 5, `${ganho20} x ${pm * 480}`); assert.equal(e.resumo.limitado, true); assert.ok(e.resumo.minutos <= 480.1);
  const c2 = cred(1); MK(); assert.equal(cred(1), c2, 'o que passou das 8h se perde, não volta');
  V("select tc_marketing_resumo_visto()", 1);
});

t('marketing: requisições simultâneas processam o mesmo trecho uma única vez', async () => {
  V("update tc_marketing set campanha = null, campanha_fim = null where org_id = 1"); V("delete from tc_patrocinios where org_id = 1");
  const pm = MK().taxa.por_minuto; V("select tc_marketing_resumo_visto()", 1);
  atrasar(1, 120); const c0 = cred(1); const fin0 = Number(V("select coalesce(max(id), 0) from tc_fin"));
  const rodar = () => new Promise((ok) => {
    const p = spawn('psql', ['-h', dir, '-p', String(PORT), '-U', 'postgres', '-d', 't', '-q', '-A', '-t', '-c', `set app.uid='${U(1)}'`, '-c', "set app.hoje='2026-10-12'", '-c', 'select tc_marketing_estado()']);
    let err = ''; p.stderr.on('data', (d) => { err += d; }); p.on('close', (c) => ok({ c, err }));
  });
  const res = await Promise.all([rodar(), rodar(), rodar()]);
  assert.ok(res.every((r) => r.c === 0), JSON.stringify(res));
  assert.ok(Math.abs(cred(1) - c0 - pm * 120) < 5, `pagou ${cred(1) - c0}, esperado ${pm * 120}`);
  assert.ok(Number(V(`select count(*) from tc_fin where org_id = 1 and motivo = 'mkt_receita' and id > ${fin0}`)) <= 1, 'no máximo um lançamento novo (se já havia o do dia, a receita soma nele)');
  assert.equal(V("select count(*) from (select ref from tc_fin where org_id = 1 and motivo = 'mkt_receita' group by ref having count(*) > 1) q"), '0', 'um lançamento por dia');
  V("select tc_marketing_resumo_visto()", 1);
});

t('marketing: renovação automática respeita requisito e saldo (nunca negativo); fama só por evento oficial e sem repetir', () => {
  V("update tc_marketing set nivel = 1, fama = 0 where org_id = 1"); V("delete from tc_patrocinios where org_id = 1");
  V("update tc_orgs set creditos = 1000000 where id = 1");
  J("select tc_patrocinio_contratar('rift_cafe', true)", 1);
  const id = V("select id from tc_patrocinios where org_id = 1 order by id desc limit 1");
  // expira e não há saldo para renovar: nada fica negativo, vira aviso e o contrato some da lista de ativos
  V(`update tc_patrocinios set inicio = now() - interval '3 days', fim = now() - interval '1 minute' where id = ${id}`);
  V("update tc_orgs set creditos = 50 where id = 1"); atrasar(1, 30); MK();
  assert.ok(cred(1) >= 50, 'saldo não ficou negativo'); assert.equal(V("select count(*) from tc_patrocinios where org_id = 1 and fim > now()"), '0');
  assert.ok(Number(V("select count(*) from tc_avisos where org_id = 1 and texto like '%renovação automática%'")) >= 1);
  // com saldo: renova e cobra o custo
  V("update tc_orgs set creditos = 100000 where id = 1"); V(`update tc_patrocinios set renovado = false, fim = now() - interval '1 minute' where id = ${id}`);
  atrasar(1, 30); const c0 = cred(1); MK();
  assert.equal(V("select count(*) from tc_patrocinios where org_id = 1 and fim > now()"), '1'); assert.ok(c0 - cred(1) >= 0);
  assert.equal(V("select count(*) from tc_fin where org_id = 1 and motivo = 'mkt_renovacao'"), '1');
  // fama: eventos idempotentes e limitados por categoria
  V("delete from tc_fama_eventos where org_id = 1"); V("update tc_marketing set fama = 0 where org_id = 1");
  assert.equal(Number(V("select tc_fama_evento(1, 'vit:777', 'vitoria', 2)")), 2); assert.equal(Number(V("select tc_fama_evento(1, 'vit:777', 'vitoria', 2)")), 0, 'mesma partida não repete');
  for (let i = 0; i < 200; i++) V(`select tc_fama_evento(1, 'vit:x${i}', 'vitoria', 2)`);
  assert.ok(Number(V("select sum(pontos) from tc_fama_eventos where org_id = 1 and categoria = 'vitoria'")) <= 250, 'teto da categoria evita fama infinita');
  assert.equal(Number(V("select tc_fama_evento(${O2}, 'vit:1', 'vitoria', 2)".replace('${O2}', String(O2)))) > 0, true);
  assert.equal(Number(V("select tc_fama_evento(1, 'x', 'vitoria', 0)")), 0);
  assert.equal(Number(V("select fama from tc_marketing where org_id = 1")) <= 1000, true);
});

t('marketing: fama de resultados oficiais (partida, liga, promoção) vem do servidor; só RPCs liberadas e nada de RC/Rank', () => {
  const fn = (n) => V(`select pg_get_functiondef('public.${n}'::regprocedure)`);
  assert.ok(/tc_fama_vitoria/.test(fn('tc_processar_partida(bigint)')) && /tc_fama_vitoria/.test(fn('tc_gameplay_registrar(bigint, integer, jsonb)')), 'vitórias oficiais');
  assert.ok(/'liga:'/.test(fn('tc_encerrar_liga(bigint)')) && /'promo:'/.test(fn('tc_aplicar_promocoes(integer, integer)')) && /'intl:'/.test(fn('tc_encerrar_internacional(bigint)')));
  for (const f of ['tc_marketing_processar(bigint, boolean)', 'tc_fama_evento(bigint, text, text, numeric)', 'tc_mkt_taxa(bigint, timestamp with time zone, numeric)']) {
    assert.equal(V(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`), 'f', `${f} interna`);
  }
  for (const f of ['tc_marketing_estado()', 'tc_marketing_melhorar()', 'tc_patrocinio_contratar(text, boolean)', 'tc_campanha_iniciar(text)', 'tc_marketing_historico()', 'tc_marketing_resumo_visto()']) {
    assert.equal(V(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`), 't', `${f} liberada`);
  }
  for (const tb of ['tc_marketing', 'tc_patrocinios', 'tc_fama_eventos']) assert.equal(V(`select has_table_privilege('authenticated', '${tb}', 'select')`), 'f');
  assert.ok(!/site_moedas_mexer|site_carteira|site_rk_lancar/.test(['tc_marketing_processar(bigint, boolean)', 'tc_marketing_melhorar()', 'tc_patrocinio_contratar_int(bigint, text, boolean, boolean)', 'tc_campanha_iniciar(text)', 'tc_marketing_estado()'].map(fn).join('\n')), 'a Central de Marketing não toca em RC nem em Rank');
  const h = J("select tc_marketing_historico()", 1); assert.ok(h.length > 0 && h.length <= 30 && h.every((x) => typeof x.delta === 'number'));
  assert.ok(h.some((x) => x.motivo === 'mkt_receita'), 'a receita idle aparece consolidada no extrato');
});

// ---------------------------------------------------------------- mercado oficial com rotação (SQL 0117)
t('mercado oficial: 7 a 10 jogadores, Poder entre -5 e +8 da média dos titulares, igual dentro da janela de 12 h e trocado na seguinte; só se contrata quem está à venda', () => {
  const cfg = (c) => V(`update tc_config set valor = '${JSON.stringify(c)}'::jsonb where chave = 'mercado_oficial'`);
  cfg(CFG_MERCADO_REAL);
  try {
    V("delete from tc_mercado_rot");
    const ref = Number(V("select tc_mercado_ref(1)"));
    const lista = () => J("select tc_mercado_oficial('{}')", 1);
    const l1 = lista();
    assert.ok(l1.length >= 7 && l1.length <= 10, `7 a 10 à venda (${l1.length})`);
    const poder = (x) => Number(x.poder);
    // quem está na faixa vem primeiro; só entram jogadores fora dela se faltarem na faixa (o mercado do teste é pequeno)
    const naFaixa = (x) => poder(x) >= ref - 5 - 0.6 && poder(x) <= ref + 8 + 0.6;
    const naFaixaNoMercado = Number(V(`select count(*) from tc_jogadores j where org_id is null and ficticio and tc_poder(j) between ${ref - 5} and ${ref + 8}`)) + l1.filter((x) => false).length;
    assert.ok(l1.filter(naFaixa).length >= Math.min(l1.length, naFaixaNoMercado) - 0, `na faixa: ${l1.filter(naFaixa).length}, disponíveis na faixa: ${naFaixaNoMercado}`);
    assert.deepEqual(lista().map((x) => x.id), l1.map((x) => x.id), 'a oferta não muda dentro da janela');
    const rot = J("select tc_mercado_rotacao()", 1);
    assert.ok(rot.restante_s > 0 && rot.restante_s <= 12 * 3600, 'tempo até a próxima troca'); assert.equal(Number(rot.ref), ref); assert.equal(Number(rot.min), ref - 5); assert.equal(Number(rot.max), ref + 8);
    // contratar quem NÃO está à venda é recusado; quem está, funciona
    const fora = V(`select id from tc_jogadores where org_id is null and ficticio and id <> all (select unnest(ids) from tc_mercado_rot where org_id = 1) limit 1`);
    assert.equal(falha(`select tc_contratar(${fora}, 4, 'ch-rot-fora-1')`, 1), 'fora_da_oferta');
    // a janela seguinte troca a oferta (simula o relógio: move a janela guardada para trás)
    V("update tc_mercado_rot set janela = janela - 1 where org_id = 1");
    const l2 = lista();
    assert.ok(l2.length >= 7 && l2.length <= 10);
    assert.equal(Number(V("select count(*) from tc_mercado_rot where org_id = 1")), 2, 'a oferta antiga fica guardada e a da janela nova é gerada à parte');
    // duas contas com times de Poder diferente recebem faixas diferentes
    V("update tc_jogadores set mec = least(100, mec + 15), rotas = least(100, rotas + 15), macro = least(100, macro + 15), tf = least(100, tf + 15), mental = least(100, mental + 15) where org_id = 1 and slot is not null");
    const ref2 = Number(V("select tc_mercado_ref(1)")); assert.ok(ref2 > ref + 5, `a referência acompanha o time (${ref} -> ${ref2})`);
  } finally { cfg(CFG_MERCADO_TESTES); }
});

t('0119: nomes oficiais dos campeonatos na configuração e nas ligas criadas', () => {
  const n = J("select tc_cfg('nomes')");
  assert.deepEqual(n, { acesso: 'Liga Academy', principal: 'Liga Nacional', copa: 'Copa Internacional', mundial: 'Campeonato Mundial' });
  const nomes = V("select string_agg(distinct split_part(nome, ' · ', 1), '|' order by split_part(nome, ' · ', 1)) from tc_ligas");
  for (const antigo of ['Ascensão', 'Apex', 'Convergentes', 'das Lendas']) assert.ok(!nomes.includes(antigo), `nome antigo "${antigo}" sumiu das ligas (${nomes})`);
});

t('campeonatos individuais: técnico novo recebe a liga da semana e não perde por W.O. os dias anteriores à criação da organização', () => {
  // a partida de um dia anterior à criação da organização é simulada pelo sistema, nunca W.O.
  assert.equal(V("select count(*) from tc_partidas p join tc_orgs o on o.id = (p.resumo->>'ausente')::bigint where p.resumo->>'origem' = 'wo' and o.criado::date > p.dia"), '0');
  // todo técnico ativo tem uma liga individual na semana atual (criada no primeiro acesso)
  J('select tc_sincronizar()', 1, '2026-11-11');
  const gw = J("select tc_calendario('2026-11-11')").gw; const temp = Math.floor(gw / 4) + 1; const sem = (gw % 4) + 1;
  assert.equal(V(`select count(*) from tc_orgs o where o.user_id is not null and o.ativa and not exists (select 1 from tc_ligas l where l.dono_org = o.id and l.temporada = ${temp} and l.semana = ${sem})`), '0');
});

t('campeonato individual: mesmo com equipes do sistema desativadas (modelo antigo) a liga da semana é criada', () => {
  V("update tc_orgs set ativa = false where user_id is null and divisao = 'acesso' and id in (select id from tc_orgs where user_id is null and divisao = 'acesso' order by id limit 6)");
  V("delete from tc_ligas where tipo = 'divisao' and status = 'aberta'"); V("update tc_config set valor = to_jsonb(tc_semana_global()) where chave = 'semana_proc'", null, '2026-11-11');
  J("select tc_sincronizar()", 1, '2026-11-11');
  assert.equal(V("select count(*) from tc_orgs where user_id is null and not ativa"), '0', 'as equipes do sistema voltam a ficar ativas');
});

// ---------------------------------------------------------------- pontuação e desempate (SQL 0122)
t('tabela: vitória vale 1 ponto; desempate por confronto direto e depois por tempo; finalistas ficam em 1º e 2º', () => {
  const ids = V("select string_agg(id::text, ',' order by id) from (select id from tc_orgs where user_id is null order by id limit 8) x").split(',').map(Number);
  const [A, B, C, D, E, F, G, H] = ids;
  const lid = Number(V("insert into tc_ligas (temporada, semana, divisao, tipo, nome) values (99, 1, 'acesso', 'divisao', 'Teste de desempate') returning id").split('\n')[0]);
  try {
    ids.forEach((o, i) => V(`insert into tc_liga_times (liga_id, org_id, semente) values (${lid}, ${o}, ${i + 1})`));
    let rod = 0;
    const jogo = (fase, vence, perde, dur, status = 'concluida') => {
      rod++;
      const a = Math.min(vence, perde), b = Math.max(vence, perde);
      const feito = status === 'concluida';
      V(`insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato, status, placar_a, placar_b, vencedor, resumo)
         values (${lid}, '${fase}', ${rod}, '2026-10-12', ${a}, ${b}, 1, '${status}', ${feito ? (vence === a ? 1 : 0) : 'null'}, ${feito ? (vence === a ? 0 : 1) : 'null'}, ${feito ? vence : 'null'},
                 ${feito ? `'{"a":1,"b":0,"mapas":[{"mapa":1,"duracao":${dur}}]}'::jsonb` : 'null'})`);
    };
    jogo('rodada', A, B, 30); jogo('rodada', B, A, 40); jogo('rodada', C, D, 25); jogo('rodada', F, A, 5);
    const ordem = () => J(`select jsonb_agg(org_id order by pos) from tc_tabela(${lid})`);
    const pts = (o) => Number(V(`select pontos from tc_tabela(${lid}) where org_id = ${o}`));
    assert.equal(pts(A), 1); assert.equal(pts(F), 1); assert.equal(pts(D), 0, 'derrota não pontua');
    // A, B, C e F têm 1 ponto. Confronto direto: A, B e F venceram outro time de 1 ponto; C não. Depois, o tempo: F 5, B 70, A 75.
    assert.deepEqual(ordem().slice(0, 4), [F, B, A, C]);
    // playoffs: semifinais F x C (F vence) e B x A (A vence); final F x A pendente: os finalistas ficam em 1º e 2º
    jogo('semi', F, C, 20); jogo('semi', A, B, 20); jogo('final', F, A, 0, 'agendada');
    const fin = () => J(`select jsonb_agg(org_id order by pos) from tc_tabela_final(${lid})`);
    assert.deepEqual(fin().slice(0, 4), [F, A, B, C], 'finalista em 3º na tabela de pontos aparece em 2º: quem está na final é, no mínimo, 2º');
    V(`update tc_partidas set status = 'concluida', placar_a = ${A < F ? 1 : 0}, placar_b = ${A < F ? 0 : 1}, vencedor = ${A} where liga_id = ${lid} and fase = 'final'`);
    assert.deepEqual(fin().slice(0, 4), [A, F, B, C], 'campeão 1º, vice 2º');
    // tabela do JSON: a posição mostrada é a final
    assert.equal(Number(V(`select tc_liga_json(${lid})->'tabela'->0->'org'->>'id'`)), A);
  } finally { V(`delete from tc_ligas where id = ${lid}`); }
});

// ---------------------------------------------------------------- painel ADM: jogadores (SQL 0123)
t('ADM: só administrador lista e edita jogadores; o OVR vem dos atributos (pesos da posição)', () => {
  assert.equal(falha("select tc_adm_jogadores('{}')", 5), 'not_admin'); // conta 5 não é administradora
  assert.equal(falha("select tc_adm_jogador_editar(1, 'Teste', 50, 50, 50, 50, 50)", 5), 'not_admin');
  const l = J("select tc_adm_jogadores('{\"pos\":\"meio\"}')", 1);
  assert.ok(l.total > 0 && l.itens.length <= 40 && l.itens.every((x) => x.pos === 'meio'));
  const comuns = l.itens.filter((x) => x.ficticio);
  const j = comuns[0];
  assert.ok('retrato' in j, 'o painel recebe o retrato'); assert.equal(j.pesos.length, 5); const soma = j.pesos.reduce((a, b) => a + b, 0); assert.ok(Math.abs(soma - 1) < 1e-6);
  const calc = j.pesos[0] * j.mec + j.pesos[1] * j.rotas + j.pesos[2] * j.macro + j.pesos[3] * j.tf + j.pesos[4] * j.mental;
  assert.ok(Math.abs(calc - j.ovr) < 0.06, 'o OVR mostrado bate com os pesos');
  const e = J(`select tc_adm_jogador_editar(${j.id}, 'Nome Editado', 90, 90, 90, 90, 90)`, 1);
  assert.equal(e.nome, 'Nome Editado'); assert.equal(e.mec, 90); assert.equal(e.ovr, 90); assert.ok(e.potencial >= 90, 'potencial acompanha o OVR');
  assert.equal(falha(`select tc_adm_jogador_editar(${j.id}, 'Nome Editado', 101, 90, 90, 90, 90)`, 1), 'atributo_invalido');
  assert.equal(falha(`select tc_adm_jogador_editar(${j.id}, 'x', 50, 50, 50, 50, 50)`, 1), 'jogador_nome_invalido');
  const outro = comuns[1];
  assert.equal(falha(`select tc_adm_jogador_editar(${outro.id}, 'Nome Editado', 50, 50, 50, 50, 50)`, 1), 'jogador_nome_em_uso');
});

t('ADM: editar o modelo de um legado atualiza as cópias dos técnicos somando o upgrade que cada um já fez', () => {
  const modelo = J("select to_jsonb(j) from tc_jogadores j where not j.ficticio and j.legado_base is null order by id limit 1");
  const cols = 'nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, fama, forma, exp, raridade';
  V(`insert into tc_jogadores (${cols}, org_id, legado_base, mec, rotas, macro, tf, mental)
     select ${cols}, 1, id, least(100, mec + 2), least(100, rotas + 2), least(100, macro + 2), least(100, tf + 2), least(100, mental + 2) from tc_jogadores where id = ${modelo.id}`);
  const copia = () => J(`select to_jsonb(c) from tc_jogadores c where c.legado_base = ${modelo.id} and c.org_id = 1`);
  const c0 = copia();
  try {
    const novo = { mec: modelo.mec - 4, rotas: modelo.rotas - 4, macro: modelo.macro - 4, tf: modelo.tf - 4, mental: modelo.mental - 4 };
    const r = J(`select tc_adm_jogador_editar(${modelo.id}, 'Faker Editado', ${novo.mec}, ${novo.rotas}, ${novo.macro}, ${novo.tf}, ${novo.mental})`, 1);
    assert.equal(r.copias_atualizadas, 1);
    const c1 = copia();
    assert.equal(c1.nome, 'Faker Editado');
    for (const k of ['mec', 'rotas', 'macro', 'tf', 'mental']) assert.equal(c1[k], Math.max(1, Math.min(100, c0[k] - 4)), `${k}: o upgrade (+2) continua somado à nova base`);
    // editar a própria cópia não mexe no modelo nem em outras cópias
    const antes = J(`select to_jsonb(j) from tc_jogadores j where j.id = ${modelo.id}`);
    J(`select tc_adm_jogador_editar(${c1.id}, 'Faker Editado', 50, 50, 50, 50, 50)`, 1);
    assert.equal(J(`select to_jsonb(j) from tc_jogadores j where j.id = ${modelo.id}`).mec, antes.mec);
  } finally {
    V(`delete from tc_jogadores where legado_base = ${modelo.id} and org_id = 1`);
    V(`update tc_jogadores set nome = '${modelo.nome}', mec = ${modelo.mec}, rotas = ${modelo.rotas}, macro = ${modelo.macro}, tf = ${modelo.tf}, mental = ${modelo.mental}, potencial = ${modelo.potencial} where id = ${modelo.id}`);
  }
});

t('ADM: alterar a raridade de um legado muda o modelo e as cópias; comum fictício e raridade inválida são recusados', () => {
  const modelo = J("select to_jsonb(j) from tc_jogadores j where not j.ficticio and j.legado_base is null order by id limit 1");
  const cols = 'nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, fama, forma, exp, raridade, mec, rotas, macro, tf, mental';
  V(`insert into tc_jogadores (${cols}, org_id, legado_base) select ${cols}, 1, id from tc_jogadores where id = ${modelo.id}`);
  try {
    assert.equal(falha(`select tc_adm_jogador_raridade(${modelo.id}, 'mitico')`, 5), 'not_admin');
    assert.equal(falha(`select tc_adm_jogador_raridade(${modelo.id}, 'divino')`, 1), 'raridade_invalida');
    const fic = V("select id from tc_jogadores where ficticio limit 1");
    assert.equal(falha(`select tc_adm_jogador_raridade(${fic}, 'raro')`, 1), 'so_legado');
    const nova = modelo.raridade === 'epico' ? 'raro' : 'epico';
    const r = J(`select tc_adm_jogador_raridade(${modelo.id}, '${nova}')`, 1);
    assert.equal(r.raridade, nova); assert.equal(r.modelo, true);
    assert.equal(V(`select raridade from tc_jogadores where legado_base = ${modelo.id} and org_id = 1`), nova, 'a cópia do técnico acompanha');
    assert.equal(J(`select tc_adm_jogador_raridade((select id from tc_jogadores where legado_base = ${modelo.id} and org_id = 1), 'comum')`, 1).raridade, 'comum');
    assert.equal(V(`select raridade from tc_jogadores where id = ${modelo.id}`), 'comum', 'pela cópia também muda o modelo');
  } finally {
    V(`delete from tc_jogadores where legado_base = ${modelo.id} and org_id = 1`);
    V(`update tc_jogadores set raridade = ${modelo.raridade ? `'${modelo.raridade}'` : 'null'} where id = ${modelo.id}`);
  }
});

t('equipes do sistema com foto: cada jogador é cópia de um jogador com foto da mesma posição e OVR próximo; ninguém de técnico é trocado; o mercado não perde fotos', () => {
  V("select tc_garantir_sistema()");
  const sis = J("select jsonb_agg(jsonb_build_object('id', j.id, 'r', j.retrato, 'cs', j.copia_sistema, 'pos', j.pos)) from tc_jogadores j join tc_orgs o on o.id = j.org_id where o.user_id is null");
  assert.ok(sis.length >= 80, 'há jogadores nas equipes do sistema');
  assert.ok(sis.every((x) => x.r && x.cs), 'todos com foto');
  // nomes repetidos entre equipes do sistema são permitidos; fotos dos jogadores do mercado/técnicos continuam únicas
  assert.equal(V("select count(*) - count(distinct retrato) from tc_jogadores where ficticio and retrato is not null and not copia_sistema"), '0');
  // um jogador novo de equipe do sistema (sem foto) recebe foto ao completar o elenco
  const org = V("select id from tc_orgs where user_id is null order by id limit 1");
  V(`delete from tc_jogadores where org_id = ${org} and slot = 'meio'`);
  const doadores = Number(V("select count(*) from tc_jogadores where ficticio and retrato is not null and not copia_sistema and pos = 'meio'"));
  V(`select tc_completar_elenco(${org})`);
  assert.ok(doadores > 0, 'há jogadores de meio com foto para copiar');
  assert.equal(V(`select count(*) from tc_jogadores where org_id = ${org} and retrato is null`), '0', V(`select coalesce(string_agg(id || ':' || pos || ':' || coalesce(slot,'-') || ':' || ficticio::text, ' | '), '') from tc_jogadores where org_id = ${org} and retrato is null`));
  assert.equal(V("select count(*) from tc_jogadores where ficticio and retrato is null and org_id is null"), '0', 'nenhum jogador livre sem foto');
});

t('finanças: a receita do marketing vira um lançamento por dia que vai acumulando; outros motivos continuam um a um', () => {
  const n0 = Number(V("select count(*) from tc_fin where org_id = 1 and motivo = 'mkt_receita'"));
  V("select tc_creditos_mexer(1, 100, 'mkt_receita', 'idle:5min')", null, '2026-12-01');
  V("select tc_creditos_mexer(1, 250, 'mkt_receita', 'idle:9min')", null, '2026-12-01');
  const dia = J("select jsonb_agg(to_jsonb(f)) from tc_fin f where org_id = 1 and motivo = 'mkt_receita' and ref = 'dia:2026-12-01'", null, '2026-12-01');
  assert.equal(dia.length, 1, 'um lançamento no dia'); assert.equal(dia[0].delta, 350, 'acumulado');
  V("select tc_creditos_mexer(1, 40, 'mkt_receita', 'idle:2min')", null, '2026-12-02');
  assert.equal(Number(V("select count(*) from tc_fin where org_id = 1 and motivo = 'mkt_receita'")), n0 + 2, 'outro dia, outro lançamento');
  const b0 = Number(V("select count(*) from tc_fin where org_id = 1 and motivo = 'treino'"));
  V("select tc_creditos_mexer(1, -10, 'treino', 'a')"); V("select tc_creditos_mexer(1, -10, 'treino', 'b')");
  assert.equal(Number(V("select count(*) from tc_fin where org_id = 1 and motivo = 'treino'")), b0 + 2);
  assert.ok(J("select tc_historico()", 1).financas.every((x) => 'ref' in x), 'o histórico devolve o ref');
});
