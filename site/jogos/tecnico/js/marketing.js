// Central de Marketing e Patrocínios: renda passiva em créditos. Tudo que vale (receita, fama, contratos, offline) é calculado no servidor
// (SQL 0116); aqui só se mostra o estado e se chamam as ações. O contador da tela é só visual: o saldo real vem do servidor.
import * as platform from '../../../shared/platform.js';

const api = platform.tecnico;
let C = null; // contexto de main.js
export const iniciarMarketing = (ctx) => { C = ctx; };

const ABAS_MKT = [['visao', 'Visão geral'], ['marketing', 'Marketing'], ['patro', 'Patrocinadores'], ['aud', 'Audiência e jogadores'], ['fin', 'Histórico financeiro']];
const X = { e: null, aba: 'visao', fin: null, timer: null, t0: 0 };
const CAT = { local: 'Local', regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional', premium: 'Premium' };
const MOTIVOS = {
  mkt_receita: 'Receita do marketing', mkt_melhoria: 'Melhoria de marketing', mkt_contrato: 'Contrato de patrocínio', mkt_renovacao: 'Renovação automática',
  mkt_campanha: 'Campanha de marketing',
};

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num1 = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
};
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ------------------------------------------------------------------ carga
export async function carregarMarketing() {
  X.e = await api.marketingEstado(); X.t0 = Date.now();
  if (C.S.meu?.org) C.S.meu.org.creditos = X.e.creditos;
  if (X.aba === 'fin') X.fin = await api.marketingHistorico();
  ligarRelogio();
}
export const limparMarketing = () => { clearInterval(X.timer); X.e = null; X.fin = null; };
// Ao abrir o jogo: credita o que foi acumulado enquanto o jogador estava fora e mostra o resumo uma única vez.
export async function abrirComResumo() {
  try {
    await carregarMarketing();
    const r = X.e.resumo;
    if (r && r.total > 0) { C.S.modal = { t: 'mkt_resumo', r }; api.marketingResumoVisto().catch(() => {}); }
  } catch { /* sem marketing instalado ainda: o resto do jogo segue normal */ }
}
function ligarRelogio() {
  clearInterval(X.timer);
  X.timer = setInterval(() => {
    if (!X.e || C.S.aba !== 'marketing') { clearInterval(X.timer); return; }
    const s = (Date.now() - X.t0) / 1000;
    const el = document.querySelector('[data-mkt-acum]'); if (el) el.textContent = C.fmt(Math.floor(X.e.taxa.por_minuto * s / 60));
    if (s >= 60) { carregarMarketing().then(() => C.render()).catch(() => {}); }
  }, 1000);
}

// ------------------------------------------------------------------ telas
function barraFama(f) {
  const marcos = f.niveis.map((n) => `<i style="left:${n.min / f.max * 100}%" title="${C.esc(n.nome)} (${n.min})"></i>`).join('');
  return `<div class="mkt-fama"><div class="tc-barra"><i style="width:${Math.min(100, f.valor / f.max * 100)}%"></i></div><div class="marcos">${marcos}</div>
    <div class="mkt-fama-l"><b>${C.esc(f.nivel.nome)}</b>${f.nivel.proximo_nome ? `<small class="tc-mudo">próximo: ${C.esc(f.nivel.proximo_nome)} (${f.nivel.proximo_min})</small>` : ''}<span>${num1(f.valor)} / ${f.max}</span></div></div>`;
}
function topoCentral(e) {
  const t = e.taxa; const ativos = e.contratos.filter((c) => c.ativo).length;
  return `<section class="tc-card"><h3>${C.IMG('i-financas')}Central de Marketing<span class="dir">${ativos} patrocinador(es) ativo(s)</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0 0 10px">Seu clube gera créditos mesmo quando você está fora (até ${e.pendente.limite_h}h acumuladas). Fama, marketing, patrocinadores e jogadores famosos aumentam a renda.</p>
    <div class="mkt-grade">
      <div><small>Saldo</small><b>${C.fmt(e.creditos)} cr.</b></div>
      <div><small>Receita por minuto</small><b>${num1(t.por_minuto)} cr.</b></div>
      <div><small>Por hora</small><b>${C.fmt(t.por_hora)} cr.</b></div>
      <div><small>Em 24 horas</small><b>${C.fmt(t.por_dia)} cr.</b></div>
      <div><small>Fama</small><b>${num1(e.fama.valor)}</b></div>
      <div><small>Nível de marketing</small><b>${e.marketing.nivel} / ${e.marketing.max}</b></div>
      <div><small>Acumulando agora</small><b data-mkt-acum>0</b></div>
    </div></section>`;
}
function viewVisao(e) {
  const t = e.taxa; const pm = t.por_minuto;
  const linhas = [
    ['Receita base do clube', t.base * 1, `base ${num1(t.base_inicial)} + fama ${num1(t.base_fama)}${t.base_divisao ? ` + divisão principal ${num1(t.base_divisao)}` : ''}`],
    ['Bônus de marketing', t.base * t.bonus_marketing, `+${pct(t.bonus_marketing)} sobre a base`],
    ['Bônus de audiência', t.base * t.bonus_audiencia, `+${pct(t.bonus_audiencia)} (${num1(e.audiencia.total)} de audiência)`],
    ['Bônus de campanha', t.base * t.bonus_campanha, e.campanha_ativa ? `+${pct(t.bonus_campanha)} até ${quando(e.campanha_ativa.fim)}` : 'nenhuma campanha ativa'],
    ['Patrocinadores', t.patrocinadores, 'valor fixo dos contratos ativos'],
  ];
  const tab = linhas.map(([n, v, d]) => `<tr><td>${n}<br><small class="tc-mudo">${d}</small></td><td class="n">${num1(v)} /min</td></tr>`).join('');
  return `${barraFama(e.fama)}
    <section class="tc-card"><h3>De onde vem a receita<span class="dir">total ${num1(pm)} cr./min</span></h3><table class="tc-tabela"><tbody>${tab}</tbody></table></section>
    <section class="tc-card"><h3>Níveis de fama</h3><div class="mkt-niveis">${e.fama.niveis.map((n) => `<div class="${e.fama.valor >= n.min ? 'on' : ''}"><b>${C.esc(n.nome)}</b><small>${n.min}+ · ${C.esc(n.beneficio)}</small></div>`).join('')}</div>
    <p class="tc-mudo tc-peq" style="margin:8px 0 0">A fama sobe com vitórias oficiais, promoção, boa colocação nas ligas, torneios internacionais, nível de marketing, astros no elenco e alguns patrocínios. Derrotas quase não tiram fama.</p></section>`;
}
function viewMarketing(e) {
  const m = e.marketing; const max = m.nivel >= m.max;
  const prox = max ? '' : `<div class="mkt-prox"><div><small>Próximo nível</small><b>${m.nivel + 1} · ${C.esc(m.proximo_nome || '')}</b><small>bônus de marketing ${pct(m.bonus)} → ${pct(m.proximo_bonus)}</small></div>
    <button type="button" class="tc-btn ouro" data-act="mkt-melhorar" ${e.creditos < m.custo_proximo || C.S.ocupado ? 'disabled' : ''}>Melhorar · ${C.fmt(m.custo_proximo)} cr.</button></div>`;
  const lim = m.limites.map((l) => `<tr class="${m.nivel >= l.nivel ? 'eu' : ''}"><td>Nível ${l.nivel}+</td><td class="n">${l.max} contrato(s)</td></tr>`).join('');
  const camps = e.campanhas.map((c) => {
    const rec = c.recarga_ate ? `em recarga até ${quando(c.recarga_ate)}` : '';
    const bloq = e.campanha_ativa || c.requisito || c.recarga_ate || e.creditos < c.custo || C.S.ocupado;
    const ativa = e.campanha_ativa?.id === c.id;
    return `<div class="mkt-camp ${ativa ? 'on' : ''}"><div><b>${C.esc(c.nome)}</b><small>${C.esc(c.efeito)} · recarga ${c.recarga_h}h</small>
      <small class="tc-mudo">${ativa ? `Em andamento · termina em ${dur(new Date(e.campanha_ativa.fim) - Date.now())}` : c.requisito ? C.esc(c.requisito) : rec}</small></div>
      <button type="button" class="tc-btn ciano" data-act="mkt-campanha" data-id="${c.id}" ${bloq ? 'disabled' : ''}>${C.fmt(c.custo)} cr.</button></div>`;
  }).join('');
  return `<section class="tc-card"><h3>Nível de marketing<span class="dir">${m.nivel} / ${m.max}</span></h3>
    <p style="margin:0 0 6px"><b>${C.esc(m.nome || '')}</b> · bônus de ${pct(m.bonus)} na receita base · ${m.limite_contratos} contrato(s) de patrocínio simultâneo(s)</p>
    <div class="tc-barra"><i style="width:${m.nivel / m.max * 100}%"></i></div>${prox || '<p class="tc-mudo tc-peq">Marketing no nível máximo.</p>'}
    <table class="tc-tabela" style="margin-top:10px"><thead><tr><th>Nível</th><th class="n">Limite</th></tr></thead><tbody>${lim}</tbody></table></section>
    <section class="tc-card"><h3>Campanhas<span class="dir">uma por vez</span></h3><p class="tc-mudo tc-peq" style="margin:0 0 8px">Uma campanha dá um bônus temporário na receita base. Depois que termina, ela fica em recarga.</p>${camps}</section>`;
}
function viewPatro(e) {
  const ativos = e.contratos.filter((c) => c.ativo);
  const cont = ativos.map((c) => `<div class="mkt-pat on"><div><b>${C.esc(c.nome)}</b><small>${CAT[c.categoria] || ''} · +${num1(c.receita_min)} cr./min · termina em ${dur(new Date(c.fim) - Date.now())}</small></div>
    <label class="mkt-auto"><input type="checkbox" data-act="mkt-auto" data-id="${c.id}" ${c.renovar_auto ? 'checked' : ''}> renovar automaticamente</label></div>`).join('');
  const lista = e.patrocinadores.map((p) => {
    const livre = e.marketing.limite_contratos - ativos.length;
    const pode = p.estado !== 'ativo' && p.estado !== 'indisponivel' && livre > 0 && e.creditos >= p.custo && !C.S.ocupado;
    const rot = { disponivel: 'Disponível', ativo: 'Ativo', expirado: 'Expirado', indisponivel: 'Indisponível' }[p.estado];
    const motivo = p.estado === 'indisponivel' ? C.esc(p.motivo || '') : p.estado !== 'ativo' && livre <= 0 ? 'Sem contratos livres: melhore o marketing.' : '';
    return `<div class="mkt-pat ${p.estado}"><div><b>${C.esc(p.nome)}</b> <i class="mkt-tag">${CAT[p.categoria] || ''}</i><small>${C.esc(p.ramo)} · +${num1(p.receita_min)} cr./min · ${p.duracao_h}h${p.bonus_aud ? ` · audiência +${pct(p.bonus_aud)}` : ''}${p.bonus_fama ? ` · fama +${p.bonus_fama}` : ''}</small>
      <small class="tc-mudo">Exige: fama ${p.req.fama ?? 0}, marketing ${p.req.nivel ?? 1}${p.req.divisao ? ', divisão principal' : ''}${p.req.titulares ? `, ${p.req.titulares} titulares` : ''}. ${motivo}</small></div>
      <div class="mkt-acoes"><span class="mkt-estado">${rot}</span><button type="button" class="tc-btn ouro" data-act="mkt-contratar" data-id="${p.id}" ${pode ? '' : 'disabled'}>${C.fmt(p.custo)} cr.</button></div></div>`;
  }).join('');
  return `<section class="tc-card"><h3>Contratos ativos<span class="dir">${ativos.length} / ${e.marketing.limite_contratos}</span></h3>${cont || '<p class="tc-mudo" style="margin:0">Nenhum patrocinador ativo. Contrate um abaixo para ganhar créditos fixos por minuto.</p>'}
    <p class="tc-mudo tc-peq" style="margin:8px 0 0">O custo é pago na assinatura. A renovação automática só acontece se houver saldo e o clube ainda cumprir os requisitos; nunca deixa o saldo negativo.</p></section>
    <section class="tc-card"><h3>Marcas</h3>${lista}</section>`;
}
function viewAud(e) {
  const a = e.audiencia;
  const lin = a.jogadores.map((j) => `<tr class="${j.conta ? '' : 'mkt-fora'}"><td>${C.esc(j.nome)}<br><small class="tc-mudo">${j.titular ? 'Titular' : 'Reserva'} · ${C.esc(C.nomeVaga(j.pos))}</small></td><td class="n">${j.fama}</td><td class="n">${j.conta ? num1(j.audiencia) : '—'}</td></tr>`).join('');
  return `<section class="tc-card"><h3>Audiência<span class="dir">${num1(a.total)}</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0">A audiência vem da <b>fama dos jogadores</b>: os cinco titulares contam inteiros e os melhores reservas contam ${pct(a.peso_reserva)}. Cada jogador conta uma vez, e a conta é comprimida para que ter muitos astros não exploda a renda. Bônus atual: <b>+${pct(a.bonus)}</b> na receita base (limite ${pct(a.cap)} sem patrocínios). Contratar um astro aumenta a audiência; vendê-lo ou demiti-lo tira a contribuição dele. A fama do clube anterior de um jogador não passa para o seu.</p></section>
    <section class="tc-card"><table class="tc-tabela"><thead><tr><th>Jogador</th><th class="n">Fama</th><th class="n">Audiência</th></tr></thead><tbody>${lin}</tbody></table></section>`;
}
function viewFin() {
  if (!X.fin) return '<p class="tc-carregando">Carregando…</p>';
  const lin = X.fin.slice(0, 30).map((x) => `<tr><td>${quando(x.criado)}</td><td>${MOTIVOS[x.motivo] || C.esc(x.motivo)}</td><td class="n" style="color:${x.delta >= 0 ? 'var(--bom)' : 'var(--ruim)'}">${x.delta >= 0 ? '+' : '−'}${C.fmt(Math.abs(x.delta))}</td><td class="n">${C.fmt(x.saldo)}</td></tr>`).join('');
  return `<section class="tc-card"><h3>Histórico financeiro<span class="dir">últimos ${Math.min(30, X.fin.length)}</span></h3><p class="tc-mudo tc-peq" style="margin:0 0 8px">A receita passiva é lançada de forma consolidada (um lançamento por processamento), não segundo a segundo.</p>
    <table class="tc-tabela"><thead><tr><th>Quando</th><th>O quê</th><th class="n">Valor</th><th class="n">Saldo</th></tr></thead><tbody>${lin || '<tr><td colspan="4" class="tc-mudo">Sem lançamentos.</td></tr>'}</tbody></table></section>`;
}
export function viewMarketingCentral() {
  const e = X.e; if (!e) return '<p class="tc-carregando">Carregando…</p>';
  const abas = `<div class="mkt-abas" role="tablist">${ABAS_MKT.map(([id, n]) => `<button type="button" role="tab" data-act="mkt-aba" data-aba="${id}" class="${X.aba === id ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const corpo = { visao: viewVisao, marketing: viewMarketing, patro: viewPatro, aud: viewAud, fin: viewFin }[X.aba](e);
  return `${topoCentral(e)}${abas}${corpo}`;
}
export function modalMktResumo(m) {
  const r = m.r;
  return `<h2>Seu clube continuou trabalhando enquanto você estava fora!</h2>
    <div class="tc-resumo"><div class="l"><span>Tempo contabilizado</span><b>${dur(r.minutos * 60000)}${r.limitado ? ' (limite máximo)' : ''}</b></div>
      <div class="l"><span>Receita dos patrocinadores</span><b>+${C.fmt(r.patrocinadores)} cr.</b></div>
      <div class="l"><span>Receita do clube</span><b>+${C.fmt(r.receita_clube)} cr.</b></div>
      <div class="l"><span>Bônus comercial</span><b>+${C.fmt(r.bonus_comercial)} cr.</b></div>
      <div class="l tot"><span>Total recebido</span><b>+${C.fmt(r.total)} cr.</b></div></div>
    <p class="tc-mudo tc-peq">Esse valor já foi adicionado ao seu saldo de créditos.</p>
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="fechar">Continuar</button></div>`;
}

// ------------------------------------------------------------------ ações
export async function tratarMkt(act, b) {
  const recarregar = async () => { await carregarMarketing(); await C.atualizarMeu(); };
  if (act === 'mkt-aba') { X.aba = b.dataset.aba; if (X.aba === 'fin') X.fin = await api.marketingHistorico().catch(() => []); return true; }
  if (act === 'mkt-melhorar') { if (await C.agir(() => api.marketingMelhorar(), { ok: 'Marketing melhorado!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-campanha') { if (await C.agir(() => api.campanhaIniciar(b.dataset.id), { ok: 'Campanha iniciada!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-contratar') { if (await C.agir(() => api.patrocinioContratar(b.dataset.id, false), { ok: 'Patrocínio contratado!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-auto') { await C.agir(() => api.patrocinioAuto(Number(b.dataset.id), b.checked), { recarregar: false }); await C.agir(carregarMarketing, { recarregar: false }); return true; }
  return false;
}
