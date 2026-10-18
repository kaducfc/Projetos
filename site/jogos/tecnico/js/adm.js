// Painel ADM, aba Jogadores: lista todos os jogadores do jogo e permite editar nome e atributos (só administradores; o servidor confere).
// O OVR (Poder) é a média ponderada dos 5 atributos com os pesos da posição que o servidor manda: mudar um atributo recalcula o OVR e
// mudar o OVR reescala os atributos para chegar nele.
import * as platform from '../../../shared/platform.js';
import { retratoSvg } from './art.js';

const api = platform.tecnico;
let C = null; // contexto de main.js: { S, esc, agir, toast, render }
export const iniciarAdm = (ctx) => { C = ctx; };

const ATR = [['mec', 'MEC'], ['rotas', 'ROT'], ['macro', 'MAC'], ['tf', 'TF'], ['mental', 'MEN']];
const POS = { top: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador', suporte: 'Suporte' };
const X = { f: { busca: '', pos: '', dono: '', pagina: 0 }, dados: null };

export const ovrDe = (a, w) => Math.min(100, Math.max(1, ATR.reduce((s, [k], i) => s + w[i] * a[k], 0)));

// Reescala os atributos para que a média ponderada fique em `alvo` (1 a 100), mantendo as proporções e respeitando os limites.
export function atributosParaOvr(a, w, alvo) {
  const t = Math.min(100, Math.max(1, Number(alvo) || 1));
  const atual = ovrDe(a, w);
  const fator = t / (atual || 1);
  const n = {}; ATR.forEach(([k]) => { n[k] = Math.min(100, Math.max(1, Math.round(a[k] * fator))); });
  // ajuste fino de 1 em 1 no atributo de maior peso que ainda possa mover, até chegar a 0,5 do alvo
  for (let i = 0; i < 400 && Math.abs(ovrDe(n, w) - t) > 0.5; i++) {
    const sobe = ovrDe(n, w) < t;
    const cand = ATR.map(([k], idx) => ({ k, p: w[idx] })).filter((c) => (sobe ? n[c.k] < 100 : n[c.k] > 1)).sort((x, y) => y.p - x.p)[0];
    if (!cand) break;
    n[cand.k] += sobe ? 1 : -1;
  }
  return n;
}

export async function carregarAdm() { X.dados = await api.admJogadores(X.f); }

const linha = (j) => `<tr data-adm="${j.id}" data-pesos="${j.pesos.join(',')}">
  <td class="n">${j.id}</td>
  <td class="adm-foto">${retratoSvg(j, 48)}</td>
  <td><input class="tc-input adm-nome" value="${C.esc(j.nome)}" maxlength="24" /><small class="tc-mudo">${POS[j.pos]} · ${j.ficticio ? 'comum' : 'legado'} · ${j.time ? C.esc(j.time.sigla) + (j.time.tecnico ? ' ★' : '') : 'livre'}</small></td>
  <td><input class="tc-input adm-ovr" type="number" min="1" max="100" value="${Math.round(j.ovr)}" title="OVR (Poder): mudar aqui reescala os atributos" /></td>
  ${ATR.map(([k, n]) => `<td><div class="adm-atr"><button type="button" data-act="adm-menos" data-k="${k}" aria-label="diminuir ${n}">−</button><input class="tc-input adm-a" data-k="${k}" type="number" min="1" max="100" value="${j[k]}" /><button type="button" data-act="adm-mais" data-k="${k}" aria-label="aumentar ${n}">+</button></div></td>`).join('')}
  <td><button type="button" class="tc-btn ouro" data-act="adm-salvar" data-id="${j.id}">Salvar</button></td></tr>`;

export function viewAdmJogadores() {
  const d = X.dados;
  const f = X.f;
  const paginas = d ? Math.max(1, Math.ceil(d.total / d.por_pagina)) : 1;
  return `<section class="tc-card"><h3>Jogadores<span class="dir">${d ? d.total : '…'} no jogo</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0 0 8px">Edite o nome e os atributos. Mudar um atributo recalcula o OVR; mudar o OVR reescala os atributos. Clique em Salvar na linha para gravar.</p>
    <form class="tc-filtros" data-form="adm-jog"><label>Buscar<input name="busca" type="search" value="${C.esc(f.busca)}" placeholder="Nome" /></label>
      <label>Posição<select name="pos"><option value="">Todas</option>${Object.entries(POS).map(([v, n]) => `<option value="${v}" ${f.pos === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>De quem<select name="dono">${[['', 'Todos'], ['livre', 'Livres (mercado)'], ['sistema', 'Equipes do sistema'], ['tecnico', 'Técnicos'], ['legado', 'Legados']].map(([v, n]) => `<option value="${v}" ${f.dono === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="tc-acoes" style="align-self:end"><button class="tc-btn ciano" type="submit">Filtrar</button></div></form>
    ${d ? `<div class="tc-tabela-rolagem"><table class="tc-tabela adm-tab"><thead><tr><th class="n">ID</th><th></th><th>Nome</th><th>OVR</th>${ATR.map(([, n]) => `<th>${n}</th>`).join('')}<th></th></tr></thead><tbody>${d.itens.map(linha).join('')}</tbody></table></div>
    <div class="tc-acoes" style="justify-content:space-between;margin-top:8px"><button class="tc-btn" type="button" data-act="adm-pag" data-d="-1" ${f.pagina <= 0 ? 'disabled' : ''}>← Anterior</button><span class="tc-mudo">Página ${f.pagina + 1} de ${paginas}</span><button class="tc-btn" type="button" data-act="adm-pag" data-d="1" ${f.pagina + 1 >= paginas ? 'disabled' : ''}>Próxima →</button></div>` : '<p class="tc-carregando">Carregando…</p>'}</section>`;
}

const lerLinha = (tr) => {
  const w = tr.dataset.pesos.split(',').map(Number);
  const a = {}; tr.querySelectorAll('.adm-a').forEach((i) => { a[i.dataset.k] = Math.min(100, Math.max(1, Math.round(Number(i.value) || 1))); });
  return { w, a };
};
const marcarSujo = (tr) => tr.classList.add('sujo');

// Edição ao vivo (delegada pelo main.js nos eventos "input" e "click").
export function aoDigitar(e) {
  const tr = e.target.closest('tr[data-adm]'); if (!tr) return false;
  const { w, a } = lerLinha(tr);
  if (e.target.classList.contains('adm-a')) { tr.querySelector('.adm-ovr').value = Math.round(ovrDe(a, w)); marcarSujo(tr); return true; }
  if (e.target.classList.contains('adm-ovr')) {
    const n = atributosParaOvr(a, w, e.target.value);
    tr.querySelectorAll('.adm-a').forEach((i) => { i.value = n[i.dataset.k]; }); marcarSujo(tr); return true;
  }
  if (e.target.classList.contains('adm-nome')) { marcarSujo(tr); return true; }
  return false;
}

export async function tratarAdm(act, b) {
  if (act === 'adm-mais' || act === 'adm-menos') {
    const tr = b.closest('tr[data-adm]'); const i = tr.querySelector(`.adm-a[data-k="${b.dataset.k}"]`);
    i.value = Math.min(100, Math.max(1, Number(i.value) + (act === 'adm-mais' ? 1 : -1)));
    const { w, a } = lerLinha(tr); tr.querySelector('.adm-ovr').value = Math.round(ovrDe(a, w)); marcarSujo(tr); return false;
  }
  if (act === 'adm-salvar') {
    const tr = b.closest('tr[data-adm]'); const { a } = lerLinha(tr);
    const r = await C.agir(() => api.admJogadorEditar(Number(b.dataset.id), tr.querySelector('.adm-nome').value, a), { ok: (r) => (r && r.copias_atualizadas ? `Jogador salvo! ${r.copias_atualizadas} cópia(s) dos técnicos atualizada(s).` : 'Jogador salvo!'), recarregar: false });
    if (r && r !== true) { // atualiza só esta linha (as outras podem ter edições ainda não salvas)
      const it = X.dados.itens.find((x) => x.id === r.id); if (it) Object.assign(it, r);
      tr.querySelector('.adm-nome').value = r.nome; tr.querySelector('.adm-ovr').value = Math.round(r.ovr);
      tr.querySelectorAll('.adm-a').forEach((i) => { i.value = r[i.dataset.k]; }); tr.classList.remove('sujo');
    }
    return false;
  }
  if (act === 'adm-pag') {
    X.f.pagina = Math.max(0, X.f.pagina + Number(b.dataset.d)); X.dados = null; C.render();
    await C.agir(carregarAdm, { recarregar: false }); return true;
  }
  return false;
}
export async function filtrarAdm(form) {
  const v = Object.fromEntries(new FormData(form)); X.f = { busca: String(v.busca || ''), pos: String(v.pos || ''), dono: String(v.dono || ''), pagina: 0 };
  X.dados = null; C.render(); await C.agir(carregarAdm, { recarregar: false });
}
