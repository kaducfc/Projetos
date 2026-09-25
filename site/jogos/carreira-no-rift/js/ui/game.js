// Tela principal: coluna do jogador, painel central (fase atual) e
// tabela da carreira. Tudo é reconstruído a cada ação.
import { ATTRS, REGIONS, ROLES, nationById, ofLeague, inLeague } from '../data/world.js';
import { eventById, roleText } from '../data/events.js';
import { ovrOf, marketValue, STATUS } from '../engine/player.js';
import { teamOf, leagueName, standings, seasonStages, legacyLabel, legacyScore, eventOptions } from '../engine/career.js';
import { teamBadge, trophySvg, stars } from './art.js';
import { esc, fmtKda, fmtMoney, fmtSalary } from '../util.js';
import { FAN_NOTICE, DONATION_NOTICE } from '../../../../shared/footer.js';

// Texto de evento: escolhe a variação da rota e troca os placeholders.
const fill = (text, state) => {
  const team = state.player.teamId ? teamOf(state, state.player.teamId) : null;
  const role = state.player.role;
  return esc(roleText(text, role))
    .replaceAll('{lane}', role === 'jungle' ? 'selva' : 'rota')
    .replaceAll('{nick}', esc(state.player.nick))
    .replaceAll('{team}', esc(team?.name || 'seu time'))
    .replaceAll('{doLeague}', esc(team ? ofLeague(leagueName(team)) : 'da liga'))
    .replaceAll('{naLeague}', esc(team ? inLeague(leagueName(team)) : 'na liga'))
    .replaceAll('{league}', esc(team ? leagueName(team) : 'liga'));
};

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

// ------------------------------------------------------------ coluna esquerda

function playerCard(state) {
  const p = state.player;
  const nat = nationById(p.nat);
  const team = p.teamId ? teamOf(state, p.teamId) : null;
  const ovr = ovrOf(p);
  const s = p.stats;
  return `
  <div class="card player-card">
    <div class="pc-top">
      <div class="ovr-badge"><small>OVR</small><b>${ovr}</b></div>
      <div class="pc-id">
        <div class="chips">
          <span class="chip"><span class="flag">${nat.flag}</span>${nat.id}</span>
          <span class="chip">${ROLES[p.role].short}</span>
          ${team ? `<span class="chip chip-${p.status}">${STATUS[p.status].name}</span>` : ''}
        </div>
        <h2 class="nick">${esc(p.nick)}</h2>
        ${team
          ? `<div class="team-line">${teamBadge(team, 22)}<span>${esc(team.name)}</span></div>`
          : '<div class="muted small">Esperando o primeiro contrato</div>'}
      </div>
    </div>
    <div class="kv">
      <div><small>Idade</small><b>${p.age}</b></div>
      <div><small>Valor</small><b>${fmtMoney(marketValue(p))}</b></div>
      ${p.contract ? `<div class="kv-wide"><small>Contrato</small><b>${fmtSalary(p.contract.salary)} · ${p.contract.years} ${p.contract.years === 1 ? 'ano' : 'anos'}</b></div>` : ''}
    </div>
    <div class="stat-row">
      <div><small>Jogos</small><b>${s.games}</b></div>
      <div><small>KDA</small><b>${fmtKda(s.k, s.d, s.a)}</b></div>
      <div><small>Abates</small><b>${s.k}</b></div>
      <div><small>POG</small><b>${s.pog}</b></div>
    </div>
    <div class="gallery">
      <span><small>Galeria</small> <b class="gold">${p.trophies.length}</b></span>
      <span class="gallery-icons">${p.trophies.length
        ? p.trophies.slice(-8).map((t) => `<span title="${esc(`${t.name} ${t.detail} ${t.year}`)}">${trophySvg(t.kind === 'award' ? 'award' : t.kind, 22)}</span>`).join('')
        : '<span class="muted small">Galeria vazia</span>'}</span>
    </div>
  </div>`;
}

function attrsCard(state) {
  const p = state.player;
  const meter = (label, v, cls = '') => `
    <div class="attr-row ${cls}"><span>${label}</span><div class="bar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`;
  return `
  <div class="card side-card">
    <h4 class="side-title">Atributos</h4>
    ${ATTRS.map((a) => meter(a.name, p.attrs[a.id])).join('')}
    <div class="divider"></div>
    ${meter('Confiança do técnico', p.morale, 'meter-cyan')}
    ${meter('Fama', p.fame, 'meter-gold')}
  </div>`;
}

function calendarCard(state) {
  const s = state.season;
  if (!s || state.screen.type === 'offers' || state.screen.type === 'retired') return '';
  const stages = seasonStages(s);
  const current = [...stages].reverse().find((st) => st.started && st.result === undefined && !st.intl);
  const label = (st) => {
    if (st.intl) {
      if (st.result === 'champion') return '<b class="ok-text">Campeão</b>';
      if (st.result === 'eliminated') return 'Eliminado';
      if (st.result === 'out') return '<span class="muted">Não foi</span>';
      return '<span class="muted">—</span>';
    }
    if (st.result === 1) return '<b class="ok-text">Campeão</b>';
    if (st.result) return `${st.result}º`;
    if (st === current) return '<b class="now">Em andamento</b>';
    return '<span class="muted">—</span>';
  };
  return `
  <div class="card side-card">
    <h4 class="side-title">Temporada ${s.year}</h4>
    ${stages.map((st) => `<div class="cal-row${st.intl ? ' intl' : ''}${st === current ? ' current' : ''}">
      <span>${st.intl ? '🌍 ' : ''}${esc(st.name)}</span><span>${label(st)}</span>
    </div>`).join('')}
  </div>`;
}

function leagueCard(state) {
  const s = state.season;
  if (!s || !s.split || state.screen.type === 'offers' || state.screen.type === 'retired') return '';
  const table = standings(s.split);
  const pos = table.indexOf(s.teamId);
  const rows = table.slice(0, 3);
  if (pos > 2) rows.push(s.teamId);
  return `
  <div class="card side-card">
    <div class="league-head"><h4 class="side-title">${esc(s.split.name)} · fase de pontos</h4><b>${pos + 1}º</b></div>
    <div class="progress"><i style="width:${(s.split.played / s.split.rounds.length) * 100}%"></i></div>
    ${rows.map((id) => {
      const t = teamOf(state, id);
      const r = s.split.table[id];
      return `<div class="mini-row${id === s.teamId ? ' me' : ''}">
        <span class="pos">${table.indexOf(id) + 1}</span>${teamBadge(t, 16)}<span class="nm">${esc(t.name)}</span><b>${r.w}-${r.l}</b>
      </div>`;
    }).join('')}
  </div>`;
}

// ------------------------------------------------------------ tabela da carreira

function careerTable(state) {
  const p = state.player;
  const s = state.season;
  const rows = p.history.map((h) => {
    const t = teamOf(state, h.teamId);
    return `<tr>
      <td>${h.age}</td>
      <td class="club">${teamBadge(t, 18)}<span>${esc(t.name)}</span>${h.titles ? `<em title="Títulos">🏆${h.titles > 1 ? h.titles : ''}</em>` : ''}</td>
      <td><span class="ovr-cell">${h.ovr}</span></td>
      <td>${h.games}</td>
      <td>${h.games ? Math.round((h.wins / h.games) * 100) + '%' : '—'}</td>
      <td>${h.games ? fmtKda(h.k, h.d, h.a) : '—'}</td>
    </tr>`;
  });
  const lastAge = p.history.length ? p.history[p.history.length - 1].age : 15;
  let nextAge = lastAge + 1;
  if (!p.retired) {
    const inSeason = s && s.age === nextAge && state.screen.type !== 'seasonEnd';
    const t = inSeason ? teamOf(state, s.teamId) : null;
    rows.push(`<tr class="current">
      <td>${nextAge}</td>
      <td class="club">${t ? `${teamBadge(t, 18)}<span>${esc(t.name)}</span>` : '<span class="muted">• Decisão de carreira…</span>'}</td>
      <td><span class="ovr-cell q">?</span></td><td>—</td><td>—</td><td>—</td>
    </tr>`);
    nextAge++;
  }
  const until = Math.max(nextAge + 2, 27);
  if (!p.retired) {
    for (let a = nextAge; a <= until; a++) rows.push(`<tr class="empty"><td>${a}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`);
  }
  const st = p.stats;
  return `
  <div class="card career-card">
    <div class="table-scroll">
      <table class="career">
        <colgroup><col class="c-age"><col><col class="c-ovr"><col class="c-j"><col class="c-v"><col class="c-kda"></colgroup>
        <thead><tr><th>Idade</th><th>Clube</th><th>OVR</th><th>J</th><th>V%</th><th>KDA</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <div class="career-total">
      <span>Carreira</span>
      <span>${st.games} jogos</span>
      <span>${st.games ? Math.round((st.wins / st.games) * 100) : 0}% V</span>
      <span>KDA ${fmtKda(st.k, st.d, st.a)}</span>
    </div>
  </div>`;
}

// ------------------------------------------------------------ painel central

function offerCard(state, o, act, label) {
  const t = teamOf(state, o.teamId);
  const region = REGIONS[t.region];
  const flag = o.bet ? '<span class="offer-flag">Aposta</span>'
    : o.loan ? '<span class="offer-flag loan">Empréstimo</span>'
      : o.entry ? '<span class="offer-flag entry">Exterior</span>' : '';
  return `
  <button class="offer${o.bet ? ' bet' : ''}${flag ? ' flagged' : ''}" data-act="${act}" ${act === 'offer' ? `data-i="${o.i}"` : ''}>
    ${flag}
    <div class="offer-top">${label} · ${esc(leagueName(t))} · ${esc(o.ambition || 'Seu clube atual')}</div>
    <div class="offer-badge">${teamBadge(t, 64)}</div>
    <h3>${esc(t.name)}</h3>
    <div class="offer-meta">${region.flag} ${region.name} · ${stars(t.rating)}</div>
    <div class="offer-money">${fmtSalary(o.salary)} · ${o.years} ${o.years === 1 ? 'ano' : 'anos'}</div>
    <div class="offer-status st-${o.status}">${o.status ? STATUS[o.status].name : ''}</div>
  </button>`;
}

function offersPanel(state) {
  const scr = state.screen;
  const loan = scr.kind === 'loan';
  const cards = scr.offers.map((o, i) => offerCard(state, { ...o, i }, 'offer', o.loan ? 'Emprestado para' : 'Assinar com'));
  if (scr.stay) {
    const status = state.player.status;
    const label = scr.stay.back ? 'Voltar para' : scr.stay.renew ? 'Renovar com' : 'Continuar no';
    const ambition = scr.stay.back ? 'Fim do empréstimo' : scr.stay.renew ? 'Renovação' : 'Contrato vigente';
    cards.unshift(offerCard(state, { ...scr.stay, status, ambition }, 'stay', label));
  }
  let title = 'Escolha o seu próximo clube';
  let eyebrow = `Janela de transferências · ${state.world.year}`;
  let sub = cards.length > 1 ? 'Chegaram propostas. Aceite uma delas ou siga no clube atual.' : '';
  if (scr.first) {
    title = 'Propostas da base';
    eyebrow = `Temporada ${state.world.year}`;
    sub = `${cards.length === 2 ? 'Dois' : 'Três'} times querem você nas categorias de base. Escolha onde a sua carreira começa.`;
  } else if (loan) {
    title = 'Você vai ser emprestado';
    eyebrow = `Empréstimo · ${state.world.year}`;
    sub = 'Ficar não é uma opção nesta janela. Jogue bem fora e volte valorizado.';
  }
  return `
  <div class="panel">
    <div class="eyebrow">${eyebrow}</div>
    <h1 class="display">${title}</h1>
    ${sub ? `<p class="lead">${sub}</p>` : ''}
    ${scr.note ? `<div class="note${loan ? ' warn' : ''}">${esc(scr.note)}</div>` : ''}
    <div class="offers-grid count-${cards.length}">${cards.join('')}</div>
  </div>`;
}

function fxChips(fx) {
  const names = {
    mec: 'Mecânica', rota: 'Fase de rotas', macro: 'Macro', tf: 'Teamfight', mental: 'Mental',
    morale: 'Confiança do técnico', fame: 'Fama',
  };
  const chips = Object.entries(fx).filter(([, v]) => v).map(([k, v]) => `<span class="fx ${v > 0 ? 'up' : 'down'}">${names[k]} <b>${signed(v)}</b></span>`);
  return chips.length ? chips.join('') : '<span class="fx">Nada mudou</span>';
}

function eventPanel(state) {
  const scr = state.screen;
  const ev = eventById(scr.eventId);
  const done = scr.choice !== null;
  const outcome = done ? (scr.ok ? ev.choices[scr.choice].ok : ev.choices[scr.choice].fail) : null;
  return `
  ${scr.recap ? recapCard(state, scr.recap) : ''}
  <div class="panel event">
    <div class="scene scene-${ev.scene}"><span class="scene-icon">${ev.icon}</span></div>
    <div class="event-body">
      <div class="tags"><span class="tag">${scr.label || ''}</span><span class="tag-accent">⚡ ${esc(ev.tag)}</span></div>
      <h2>${fill(ev.title, state)}</h2>
      <p>${fill(ev.text, state)}</p>
    </div>
    ${done ? `
      <button class="result ${scr.ok ? 'ok' : 'fail'}" data-act="next">
        <div class="result-head">
          <span class="dot"></span>Resultado da história
        </div>
        <div class="result-main">
          <div>
            <h3>${fill(ev.choices[scr.choice].label, state)} · ${scr.ok ? 'A escolha deu certo' : 'Não saiu como planejado'}</h3>
            <p>${fill(outcome.text, state)}</p>
          </div>
          <div class="fx-list">${fxChips(outcome.fx)}${scr.ovrDelta ? `<span class="fx ${scr.ovrDelta > 0 ? 'up' : 'down'}">OVR <b>${signed(scr.ovrDelta)}</b></span>` : ''}</div>
        </div>
        <div class="tap">Toque para continuar ›</div>
      </button>` : ''}
    <div class="choices${done ? ' locked' : ''}">
      ${eventOptions(scr).map(({ idx, chance: pct }, i) => {
        const c = ev.choices[idx];
        return `<button class="choice${done && scr.choice === idx ? ' picked' : ''}" data-act="choice" data-i="${i}" ${done ? 'disabled' : ''}>
          <div class="choice-txt"><b>${fill(c.label, state)}</b><small>${pct}%: ${fill(c.good, state)}. Erro: ${fill(c.bad, state)}</small></div>
          <div class="odds"><span class="o-ok" style="flex:${pct}">${pct >= 15 ? `${pct}%` : ''}</span><span class="o-bad" style="flex:${100 - pct}">${100 - pct >= 15 ? `${100 - pct}%` : ''}</span></div>
          <span class="arrow">→</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function standingsTable(state) {
  const s = state.season;
  const table = standings(s.split);
  return `
  <table class="standings">
    <thead><tr><th>#</th><th>Time</th><th>V</th><th>D</th></tr></thead>
    <tbody>${table.map((id, i) => {
      const t = teamOf(state, id);
      const r = s.split.table[id];
      return `<tr class="${id === s.teamId ? 'me' : ''}${i === s.split.poSize - 1 ? ' cut' : ''}"><td>${i + 1}</td><td class="club">${teamBadge(t, 18)}<span>${esc(t.name)}</span></td><td>${r.w}</td><td>${r.l}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

function lineTxt(line) {
  if (!line.played) return '<span class="muted">No banco</span>';
  return `${line.k}/${line.d}/${line.a}${line.pog ? ' <span class="pog" title="Player of the Game">★ POG</span>' : ''}`;
}

function matchRow(state, m) {
  const a = teamOf(state, m.a);
  const b = teamOf(state, m.b);
  const me = state.season.teamId;
  const mine = m.a === me || m.b === me;
  const won = mine && m.winner === me;
  return `<div class="match${mine ? (won ? ' mine w' : ' mine l') : ''}">
    <span class="m-label">${esc(m.label)}</span>
    <span class="m-team${m.winner === m.a ? ' win' : ''}">${teamBadge(a, 20)}<span>${esc(a.name)}</span></span>
    <span class="m-score">${m.sa} – ${m.sb}</span>
    <span class="m-team right${m.winner === m.b ? ' win' : ''}"><span>${esc(b.name)}</span>${teamBadge(b, 20)}</span>
  </div>`;
}

// Diz o que a colocação vale (vaga internacional da etapa).
function qualifyNote(state) {
  const s = state.season;
  if (s.tier !== 1) return '';
  const next = { cup: ['firstStand', 'First Stand'], s1: ['msi', 'MSI'], s2: ['worlds', 'Mundial'] }[s.split.kind];
  const slots = REGIONS[s.region][next[0]] + (next[0] === 'worlds' && s.msiFinalRegions.includes(s.region) ? 1 : 0);
  const got = s.placements[s.split.kind] <= slots;
  const vagas = slots === 1 ? 'Só o campeão vai' : `Os ${slots} primeiros vão`;
  return ` · ${vagas} ao ${next[1]}${got ? ' — <b class="ok-text">você está classificado!</b>' : ''}`;
}

// Etapa inteira numa tela: resumo, seus jogos, tabela e playoffs.
function stagePanel(state) {
  const scr = state.screen;
  const champ = teamOf(state, scr.championId);
  const w = scr.results.filter((r) => r.won).length;
  const played = scr.results.filter((r) => r.line.played).length;
  const k = scr.results.reduce((a, r) => a + r.line.k, 0);
  const d = scr.results.reduce((a, r) => a + r.line.d, 0);
  const as = scr.results.reduce((a, r) => a + r.line.a, 0);
  let title;
  if (scr.placement === 1) title = 'Campeões!';
  else if (scr.placement === 2) title = 'Vice-campeões';
  else if (scr.inPlayoffs) title = scr.placement <= 4 ? 'Eliminados na semifinal' : 'Eliminados nas quartas';
  else title = `Fora dos playoffs · ${scr.placement}º lugar`;
  return `
  <div class="panel">
    <div class="eyebrow">${esc(scr.name)} · ${scr.bo === 1 ? 'MD1' : 'MD3'} · top ${scr.poSize} nos playoffs</div>
    <h1 class="display">${title}</h1>
    <p class="lead">Fase de pontos: <b>${w}V ${scr.results.length - w}D</b> (${scr.regularPos}º) · você jogou ${played} de ${scr.results.length}${played ? ` · KDA ${fmtKda(k, d, as)}` : ''}<br>
      Campeão: <b>${esc(champ.name)}</b>${qualifyNote(state)}</p>
    <h4 class="sub-title">Playoffs</h4>
    <div class="matches">${scr.matches.map((m) => matchRow(state, m)).join('')}</div>
    <details class="stage-details">
      <summary>Ver fase de pontos</summary>
      <div class="two-col">
        <div class="results">
          ${scr.results.map((r) => {
            const t = teamOf(state, r.oppId);
            return `<div class="res-row ${r.won ? 'w' : 'l'}">
              <span class="rnd">R${r.round}</span>${teamBadge(t, 20)}<span class="nm">${esc(t.name)}</span>
              <span class="line">${lineTxt(r.line)}</span>
              <span class="wl">${scr.bo > 1 ? `${r.w}–${r.l}` : r.won ? 'V' : 'D'}</span>
            </div>`;
          }).join('')}
        </div>
        ${standingsTable(state)}
      </div>
    </details>
    <div class="actions"><button class="btn-primary" data-act="next">Continuar</button></div>
  </div>`;
}

function intlTitle(r, me) {
  if (!r.eliminated) return r.name === 'Mundial' ? 'Campeões do mundo!' : `Campeões do ${r.name}!`;
  if (r.swiss && !r.advanced) return 'Eliminados na fase suíça';
  if (!r.advanced) return 'Eliminados no play-in';
  const lost = r.matches.find((m) => (m.a === me || m.b === me) && m.winner !== me);
  return lost ? `Eliminados: ${lost.label.toLowerCase()}` : 'Eliminados';
}

// Resumo do First Stand/MSI no topo da decisão seguinte (sem clique extra).
function recapCard(state, r) {
  const me = state.season.teamId;
  const champ = teamOf(state, r.championId);
  const mine = r.matches.filter((m) => m.a === me || m.b === me);
  return `
  <div class="recap ${r.eliminated ? 'lost' : 'won'}">
    <div class="recap-head">
      <span class="eyebrow intl">🏆 ${esc(r.name)} ${state.season.year}</span>
      <b>${intlTitle(r, me)}</b>
      <span class="muted small">Campeão: ${esc(champ.name)}</span>
    </div>
    <div class="matches">${mine.map((m) => matchRow(state, m)).join('')}</div>
    <details class="stage-details">
      <summary>Ver chave completa</summary>
      <div class="matches">${r.matches.map((m) => matchRow(state, m)).join('')}</div>
    </details>
  </div>`;
}

function intlPanel(state) {
  const scr = state.screen;
  const me = state.season.teamId;
  const champ = teamOf(state, scr.championId);
  const title = intlTitle(scr, me);
  return `
  <div class="panel">
    <div class="eyebrow intl">${scr.name === 'Mundial' ? '🌍' : '🏆'} ${scr.name} ${state.season.year}</div>
    <h1 class="display">${title}</h1>
    <p class="lead">Campeão: <b>${esc(champ.name)}</b></p>
    ${scr.swiss ? `
      <h4 class="sub-title">Fase suíça · ${scr.swiss.w}–${scr.swiss.l}</h4>
      <div class="results">${scr.swiss.matches.map((r) => {
        const t = teamOf(state, r.oppId);
        return `<div class="res-row ${r.won ? 'w' : 'l'}"><span class="rnd">${r.w + r.l > 1 ? `MD3` : 'MD1'}</span>${teamBadge(t, 20)}<span class="nm">${esc(t.name)}</span><span class="line">${r.w}–${r.l}</span><span class="wl">${r.won ? 'V' : 'D'}</span></div>`;
      }).join('')}</div>
      <h4 class="sub-title">Mata-mata</h4>` : ''}
    <div class="matches">${scr.matches.map((m) => matchRow(state, m)).join('')}</div>
    <div class="actions"><button class="btn-primary" data-act="next">Continuar</button></div>
  </div>`;
}

function seasonEndPanel(state) {
  const scr = state.screen;
  const p = state.player;
  const st = scr.stats;
  const delta = scr.ovrEnd - scr.ovrStart;
  const all = [...scr.titles, ...scr.awards];
  return `
  <div class="panel">
    <div class="eyebrow">Temporada ${scr.year} encerrada</div>
    <h1 class="display">Balanço da temporada</h1>
    <div class="ovr-change">
      <div class="ovr-badge"><small>OVR</small><b>${scr.ovrStart}</b></div>
      <span class="arrow-big">→</span>
      <div class="ovr-badge ${delta >= 0 ? 'up' : 'down'}"><small>OVR</small><b>${scr.ovrEnd}</b></div>
      <span class="delta ${delta >= 0 ? 'up' : 'down'}">${signed(delta)}</span>
    </div>
    <div class="stat-row big">
      <div><small>Jogos</small><b>${st.games}</b></div>
      <div><small>Vitórias</small><b>${st.wins}</b></div>
      <div><small>KDA</small><b>${fmtKda(st.k, st.d, st.a)}</b></div>
      <div><small>POG</small><b>${st.pog}</b></div>
    </div>
    ${all.length ? `<div class="season-trophies">${all.map((t) => `<div class="st-item">${trophySvg(t.kind, 40)}<div><b>${esc(t.name)}</b><small>${esc(t.detail)}</small></div></div>`).join('')}</div>` : '<p class="muted">Nenhum título nesta temporada.</p>'}
    ${scr.loanNext ? '<div class="note warn">Temporada difícil. A diretoria está pensando em te emprestar para outro time na próxima janela.</div>' : ''}
    ${scr.forced ? `<div class="note">${p.age >= 35 ? `Aos ${p.age} anos, é hora de pendurar o mouse.` : 'Sem espaço no cenário, você decide encerrar a carreira.'}</div>` : ''}
    <div class="actions">
      ${scr.forced
        ? '<button class="btn-primary" data-act="season-next">Ver relatório da carreira</button>'
        : `<button class="btn-primary" data-act="season-next">Abrir janela de transferências</button>
           ${scr.canRetire ? '<button class="btn-ghost" data-act="retire">Anunciar aposentadoria</button>' : ''}`}
    </div>
  </div>`;
}

export function careerSummaryText(state) {
  const p = state.player;
  const nat = nationById(p.nat);
  const legacy = legacyLabel(p);
  const count = (name) => p.trophies.filter((t) => t.name === name).length;
  const leagues = p.trophies.filter((t) => t.kind === 'league').length;
  const clubs = [...new Set(p.history.map((h) => teamOf(state, h.teamId).tag))];
  return [
    `${nat.flag} ${p.nick} · ${ROLES[p.role].name} · ${legacy.title}`,
    `${legacyScore(p)} pontos de legado · OVR máximo ${p.peakOvr} · ${p.history.length} temporadas · ${p.stats.games} jogos · KDA ${fmtKda(p.stats.k, p.stats.d, p.stats.a)}`,
    `🏆 ${leagues} ligas · ${count('MSI')} MSI · ${count('Mundial')} Mundial`,
    `Clubes: ${clubs.join(' → ')}`,
    '#CarreiraNoRift',
  ].join('\n');
}

function retiredPanel(state) {
  const p = state.player;
  const legacy = legacyLabel(p);
  const st = p.stats;
  // Passagens por clube (anos consecutivos agrupados).
  const spells = [];
  for (const h of p.history) {
    const last = spells[spells.length - 1];
    if (last && last.teamId === h.teamId) { last.to = h.year; last.games += h.games; last.titles += h.titles; } else spells.push({ teamId: h.teamId, from: h.year, to: h.year, games: h.games, titles: h.titles });
  }
  const grouped = {};
  p.trophies.forEach((t) => {
    const key = t.kind === 'league' ? `${t.name}` : t.name;
    grouped[key] = grouped[key] || { t, n: 0 };
    grouped[key].n++;
  });
  return `
  <div class="panel retired">
    <div class="eyebrow">Relatório da aposentadoria</div>
    <div class="legacy tone-${legacy.tone}">
      ${trophySvg(legacy.tone === 'gold' ? 'intl' : legacy.tone === 'plain' ? 'award' : 'league', 70)}
      <div><small>Legado</small><h1 class="display">${legacy.title}</h1>
      <p class="lead">${esc(p.nick)} se aposenta aos ${p.age} anos, depois de ${p.history.length} temporadas.</p></div>
    </div>
    <div class="stat-row big">
      <div><small>Pontos de legado</small><b class="gold">${legacyScore(p)}</b></div>
      <div><small>OVR máximo</small><b>${p.peakOvr}</b></div>
      <div><small>Jogos</small><b>${st.games}</b></div>
      <div><small>Vitórias</small><b>${st.games ? Math.round((st.wins / st.games) * 100) : 0}%</b></div>
      <div><small>KDA</small><b>${fmtKda(st.k, st.d, st.a)}</b></div>
      <div><small>Abates</small><b>${st.k}</b></div>
      <div><small>POG</small><b>${st.pog}</b></div>
    </div>
    <h4 class="sub-title">Clubes</h4>
    <div class="spells">${spells.map((sp) => {
      const t = teamOf(state, sp.teamId);
      return `<div class="spell">${teamBadge(t, 26)}<div><b>${esc(t.name)}</b><small>${sp.from === sp.to ? sp.from : `${sp.from}–${sp.to}`} · ${sp.games} jogos${sp.titles ? ` · ${sp.titles} título${sp.titles > 1 ? 's' : ''}` : ''}</small></div></div>`;
    }).join('')}</div>
    <h4 class="sub-title">Títulos e prêmios</h4>
    ${Object.keys(grouped).length ? `<div class="season-trophies">${Object.values(grouped).map(({ t, n }) => `<div class="st-item">${trophySvg(t.kind, 40)}<div><b>${n > 1 ? `${n}× ` : ''}${esc(t.name)}</b><small>${t.kind === 'award' ? 'Prêmio individual' : t.kind === 'intl' ? 'Internacional' : 'Liga'}</small></div></div>`).join('')}</div>` : '<p class="muted">Nenhum título na carreira.</p>'}
    <p class="fan-note">${FAN_NOTICE} ${DONATION_NOTICE}</p>
    <pre class="share" id="share-text">${esc(careerSummaryText(state))}</pre>
    <div class="actions">
      <button class="btn-primary" data-act="copy-summary">Copiar resumo</button>
      <button class="btn-ghost" data-act="new-career">Nova carreira</button>
    </div>
  </div>`;
}

function centerPanel(state) {
  switch (state.screen.type) {
    case 'offers': return offersPanel(state);
    case 'event': return eventPanel(state);
    case 'stage': return stagePanel(state);
    case 'intl': return intlPanel(state);
    case 'seasonEnd': return seasonEndPanel(state);
    case 'retired': return retiredPanel(state);
    default: return '';
  }
}

// ------------------------------------------------------------ modal de troféu

export function trophyModal(state) {
  const m = state.modals[0];
  if (!m) return '';
  const t = m.trophy;
  const team = teamOf(state, t.teamId);
  const award = t.kind === 'award';
  return `
  <div class="modal-backdrop" data-act="modal-close">
    <div class="modal trophy-modal kind-${t.kind}" role="dialog" aria-modal="true">
      <div class="rays"></div>
      <div class="trophy-art">${trophySvg(t.kind, 150)}</div>
      <div class="eyebrow">${award ? 'Prêmio individual' : 'Campeão'} · ${t.year}</div>
      <h2 class="display">${esc(t.name)}</h2>
      <p>${award ? esc(state.player.nick) : esc(t.detail)} · ${teamBadge(team, 18)} ${esc(team.name)}</p>
      <button class="btn-primary" data-act="modal-close">Continuar</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------ layout

export function renderGame(root, state) {
  root.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">◆</span> CARREIRA NO RIFT</div>
    <div class="topbar-right muted small">Temporada ${state.season?.year ?? state.world.year}</div>
  </header>
  <main class="game">
    <aside class="col-left">
      ${playerCard(state)}
      <button class="btn-restart" data-act="restart">↺ Reiniciar carreira</button>
      ${calendarCard(state)}
      ${leagueCard(state)}
      ${attrsCard(state)}
    </aside>
    <section class="col-center" id="center">${centerPanel(state)}</section>
    <aside class="col-right">${careerTable(state)}</aside>
  </main>
  ${trophyModal(state)}`;
}
