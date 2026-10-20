// Central de Marketing e Patrocínios: renda passiva em créditos. Tudo que vale (receita, fama, contratos, offline) é calculado no servidor
// (SQL 0116); aqui só se mostra o estado e se chamam as ações. O contador da tela é só visual: o saldo real vem do servidor.
import * as platform from '../../../shared/platform.js';

const api = platform.tecnico;
let C = null; // contexto de main.js
export const iniciarMarketing = (ctx) => { C = ctx; };

const ABAS_MKT = [['visao', 'Visão geral'], ['marketing', 'Marketing'], ['patro', 'Patrocinadores'], ['aud', 'Audiência e jogadores'], ['fin', 'Histórico financeiro']];
const X = { e: null, aba: 'visao', fin: null, timer: null, t0: 0 };
const CAT = { local: 'Local', regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional', premium: 'Premium' };
// Nomes das movimentações de créditos (Finanças e Histórico financeiro).
// Nome de uma movimentação de créditos; a receita do marketing é um lançamento por dia ("Marketing · Ganhos 18/10").
export const nomeMovimento = (x) => {
  const d = x.motivo === 'mkt_receita' && /^dia:\d{4}-\d{2}-\d{2}$/.test(x.ref || '') ? x.ref.slice(4).split('-') : null;
  return d ? `Marketing · Ganhos ${d[2]}/${d[1]}` : MOTIVOS[x.motivo] || C.esc(x.motivo);
};
export const MOTIVOS = {
  inicial: 'Créditos iniciais', contratacao: 'Contratação de jogador', contrato: 'Contrato de jogador', renovacao: 'Renovação de contrato', rescisao: 'Rescisão de contrato',
  salarios: 'Salários da semana', premiacao: 'Premiação de campeonato', treino: 'Treinamento', bau: 'Baú de Recrutamento',
  mkt_receita: 'Marketing', mkt_melhoria: 'Marketing · Melhoria', mkt_contrato: 'Marketing · Patrocínio', mkt_renovacao: 'Marketing · Renovação de patrocínio', mkt_campanha: 'Marketing · Campanha',
};

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num1 = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
};
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ------------------------------------------------------------------ carga
export async function carregarMarketing(entrada = false) {
  X.e = await api.marketingEstado(entrada); X.t0 = Date.now(); // `entrada` só no início do jogo: abrir a tela não credita
  if (C.S.meu?.org) C.S.meu.org.creditos = X.e.creditos;
  if (X.aba === 'fin') X.fin = await api.marketingHistorico();
  ligarRelogio();
}
export const limparMarketing = () => { clearInterval(X.timer); X.e = null; X.fin = null; };
// Ao abrir o jogo: credita o que foi acumulado enquanto o jogador estava fora e mostra o resumo uma única vez.
export async function abrirComResumo() {
  try {
    await carregarMarketing(true);
    const r = X.e.resumo;
    if (r && r.total > 0) { C.S.modal = { t: 'mkt_resumo', r }; api.marketingResumoVisto().catch(() => {}); }
  } catch { /* sem marketing instalado ainda: o resto do jogo segue normal */ }
}
function ligarRelogio() {
  clearInterval(X.timer);
  X.timer = setInterval(() => {
    if (!X.e || C.S.aba !== 'marketing') { clearInterval(X.timer); return; }
    const s = (Date.now() - X.t0) / 1000;
    const el = document.querySelector('[data-mkt-acum]'); if (el) el.textContent = C.fmt(acumulado(s));
    if (s >= 60) { carregarMarketing().then(() => C.render()).catch(() => {}); }
  }, 1000);
}

// Acumulado ainda não resgatado: o que o servidor já contava + o que sobe desde que a tela carregou (até o limite de horas offline).
const acumulado = (s) => { const p = X.e.pendente; const max = X.e.taxa.por_minuto * p.limite_h * 60; return Math.floor(Math.min(max, p.valor + X.e.taxa.por_minuto * s / 60)); };

// ------------------------------------------------------------------ telas
function barraFama(f) {
  const marcos = f.niveis.map((n) => `<i style="left:${n.min / f.max * 100}%" title="${C.esc(n.nome)} (${n.min})"></i>`).join('');
  return `<div class="mkt-fama"><div class="tc-barra"><i style="width:${Math.min(100, f.valor / f.max * 100)}%"></i></div><div class="marcos">${marcos}</div>
    <div class="mkt-fama-l"><b>${C.esc(f.nivel.nome)}</b>${f.nivel.proximo_nome ? `<small class="tc-mudo">próximo: ${C.esc(f.nivel.proximo_nome)} (${f.nivel.proximo_min})</small>` : ''}<span>${num1(f.valor)} / ${f.max}</span></div></div>`;
}
function topoCentral(e) {
  const t = e.taxa; const ativos = e.contratos.filter((c) => c.ativo).length;
  return `<section class="tc-card"><h3>${C.IMG('ic-marketing')}Central de Marketing<span class="dir">${ativos} patrocinador(es) ativo(s)</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0 0 10px">Seu clube gera créditos mesmo quando você está fora (até ${e.pendente.limite_h}h acumuladas). Fama, marketing, patrocinadores e jogadores famosos aumentam a renda.</p>
    <div class="mkt-grade">
      <div><small>Saldo</small><b>${C.fmt(e.creditos)} cr.</b></div>
      <div><small>Receita por minuto</small><b>${num1(t.por_minuto)} cr.</b></div>
      <div><small>Por hora</small><b>${C.fmt(t.por_hora)} cr.</b></div>
      <div><small>Em 24 horas</small><b>${C.fmt(t.por_dia)} cr.</b></div>
      <div><small>Fama</small><b>${num1(e.fama.valor)}</b></div>
      <div><small>Nível de marketing</small><b>${e.marketing.nivel} / ${e.marketing.max}</b></div>
      <div><small>Acumulando agora</small><b data-mkt-acum>${C.fmt(acumulado(0))}</b><button type="button" class="tc-btn peq ouro" data-act="mkt-resgatar" ${C.S.ocupado ? 'disabled' : ''}>Resgatar</button></div>
    </div></section>`;
}
function viewVisao(e) {
  const t = e.taxa; const pm = t.por_minuto;
  const linhas = [
    ['Receita base do clube', t.base * 1, `base ${num1(t.base_inicial)} + fama ${num1(t.base_fama)}${t.base_divisao ? ` + divisão principal ${num1(t.base_divisao)}` : ''}`],
    ['Bônus de marketing', t.base * t.bonus_marketing, `+${pct(t.bonus_marketing)} sobre a base`],
    ['Bônus de audiência', t.base * t.bonus_audiencia, `+${pct(t.bonus_audiencia)} (${num1(e.audiencia.total)} de audiência)`],
    ['Bônus de campanha', (t.base * (1 + t.bonus_marketing + t.bonus_audiencia) + t.patrocinadores) * t.bonus_campanha, e.campanha_ativa ? `+${pct(t.bonus_campanha)} sobre toda a receita até ${quando(e.campanha_ativa.fim)}` : 'nenhuma campanha ativa'],
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
  const semCamp = (e.taxa.base * (1 + e.taxa.bonus_marketing + e.taxa.bonus_audiencia) + e.taxa.patrocinadores); // receita por minuto sem campanha: base da estimativa
  const camps = e.campanhas.map((c) => {
    const ganho = Math.round(semCamp * c.bonus * c.duracao_h * 60); const saldo = ganho - c.custo;
    const rec = c.recarga_ate ? `em recarga até ${quando(c.recarga_ate)}` : '';
    const bloq = e.campanha_ativa || c.requisito || c.recarga_ate || e.creditos < c.custo || C.S.ocupado;
    const ativa = e.campanha_ativa?.id === c.id;
    return `<div class="mkt-camp ${ativa ? 'on' : ''}"><div><b>${C.esc(c.nome)}</b><small>${C.esc(c.efeito)} · recarga ${c.recarga_h}h</small>
      <small class="mkt-roi ${saldo >= 0 ? 'bom' : 'ruim'}">Com a sua receita de hoje rende cerca de +${C.fmt(ganho)} cr. no período (${saldo >= 0 ? 'lucro' : 'prejuízo'} de ${C.fmt(Math.abs(saldo))} cr.)</small>
      <small class="tc-mudo">${ativa ? `Em andamento · termina em ${dur(new Date(e.campanha_ativa.fim) - Date.now())}` : c.requisito ? C.esc(c.requisito) : rec}</small></div>
      <button type="button" class="tc-btn ciano" data-act="mkt-campanha" data-id="${c.id}" ${bloq ? 'disabled' : ''}>${C.fmt(c.custo)} cr.</button></div>`;
  }).join('');
  return `<section class="tc-card"><h3>Nível de marketing<span class="dir">${m.nivel} / ${m.max}</span></h3>
    <p style="margin:0 0 6px"><b>${C.esc(m.nome || '')}</b> · bônus de ${pct(m.bonus)} na receita base · ${m.limite_contratos} contrato(s) de patrocínio simultâneo(s)</p>
    <div class="tc-barra"><i style="width:${m.nivel / m.max * 100}%"></i></div>${prox || '<p class="tc-mudo tc-peq">Marketing no nível máximo.</p>'}
    <table class="tc-tabela" style="margin-top:10px"><thead><tr><th>Nível</th><th class="n">Limite</th></tr></thead><tbody>${lim}</tbody></table></section>
    <section class="tc-card"><h3>Campanhas<span class="dir">uma por vez</span></h3><p class="tc-mudo tc-peq" style="margin:0 0 8px">Uma campanha multiplica <b>toda a sua receita</b> (clube, bônus comerciais e patrocinadores) durante o período. A estimativa de cada uma usa a sua receita atual por minuto. Depois que termina, ela fica em recarga.</p>${camps}</section>`;
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
  const lin = X.fin.slice(0, 30).map((x) => `<tr><td>${quando(x.criado)}</td><td>${nomeMovimento(x)}</td><td class="n" style="color:${x.delta >= 0 ? 'var(--bom)' : 'var(--ruim)'}">${x.delta >= 0 ? '+' : '−'}${C.fmt(Math.abs(x.delta))}</td><td class="n">${C.fmt(x.saldo)}</td></tr>`).join('');
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
  const chip = (cls, nome, v) => `<div class="c ${cls}"><i></i><span>${nome}</span><b>+${C.fmt(v)}</b></div>`;
  return `<div class="tc-bv" role="group" aria-label="Rendimento enquanto você esteve fora">
    <span class="luz" aria-hidden="true"></span>
    <small class="tit">Bem-vindo de volta!</small>
    <p class="fora">Você ficou fora por <b>${dur(r.minutos * 60000)}</b>${r.limitado ? ' <em>(limite máximo)</em>' : ''}</p>
    <img class="moeda" src="img/credito-96.webp" srcset="img/credito-192.webp 2x" alt="" width="84" height="84" />
    <div class="num"><b>+${C.fmt(r.total)}</b><span>créditos</span></div>
    <div class="chips">${chip('pat', 'Patrocinadores', r.patrocinadores)}${chip('clu', 'Clube', r.receita_clube)}${chip('bon', 'Bônus', r.bonus_comercial)}</div>
    <button type="button" class="tc-btn ouro" data-act="fechar">Continuar</button>
  </div>`;
}

// ------------------------------------------------------------------ ações
export async function tratarMkt(act, b) {
  const recarregar = async () => { await carregarMarketing(); await C.atualizarMeu(); };
  if (act === 'mkt-aba') { X.aba = b.dataset.aba; if (X.aba === 'fin') X.fin = await api.marketingHistorico().catch(() => []); return true; }
  if (act === 'mkt-resgatar') { const r = await C.agir(() => api.marketingResgatar(), { ok: (x) => (x.total > 0 ? `+${C.fmt(x.total)} créditos resgatados!` : 'Nada para resgatar ainda.'), recarregar: false }); if (r) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-melhorar') { if (await C.agir(() => api.marketingMelhorar(), { ok: 'Marketing melhorado!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-campanha') { if (await C.agir(() => api.campanhaIniciar(b.dataset.id), { ok: 'Campanha iniciada!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-contratar') { if (await C.agir(() => api.patrocinioContratar(b.dataset.id, false), { ok: 'Patrocínio contratado!', recarregar: false })) await C.agir(recarregar, { recarregar: false }); return true; }
  if (act === 'mkt-auto') { await C.agir(() => api.patrocinioAuto(Number(b.dataset.id), b.checked), { recarregar: false }); await C.agir(carregarMarketing, { recarregar: false }); return true; }
  return false;
}
