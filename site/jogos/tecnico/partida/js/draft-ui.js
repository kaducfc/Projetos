// Tela de picks e bans do amistoso. Você é o lado azul; o computador escolhe pelo vermelho.
import { prepararImagens, campIcone } from '../../js/campeoes-img.js';
import { novoDraft, passoAtual, terminou, banir, escolher, jogadaIA, vagasLivres, indisponiveis, serve, jogadorDaVaga, resultadoDraft, ORDEM, VAGAS } from '../dados/draft.js';

const NOME = { top: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador', suporte: 'Suporte' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TEMPO_ACAO = 60; // segundos por pick ou ban, para os dois lados
const IA_MIN = 3; const IA_MAX = 6; // o computador escolhe entre 3 e 6 segundos depois que a vez dele começa

// Palavra em SVG: contorno fino fixo com brilho e um traço de luz que corre pela borda das letras (efeito neon).
const palavraNeon = (txt) => `<svg class="neon" viewBox="0 0 ${txt.length * 62 + 24} 78" role="img" aria-label="${txt}"><defs><filter id="neon-b" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <text x="50%" y="62" text-anchor="middle" class="t0">${txt}</text><text x="50%" y="62" text-anchor="middle" class="t1" filter="url(#neon-b)">${txt}</text><text x="50%" y="62" text-anchor="middle" class="t2">${txt}</text></svg>`;

// Tempo esgotado: o campeão de maior maestria do jogador da vaga; sem favorito livre, um aleatório que joga na posição.
function jogadaAutomatica(d, p, vaga) {
  const usados = indisponiveis(d);
  if (p.tipo === 'pick') {
    const v = vaga && !d.picks.azul[vaga] ? vaga : vagasLivres(d, 'azul')[0];
    const favs = [...(jogadorDaVaga(d, 'azul', v)?.favoritos || [])].sort((a, b) => (b.bonus_pct || 0) - (a.bonus_pct || 0));
    for (const f of favs) { const c = d.catalogo.find((x) => x.nome === f.nome || x.id === f.id); if (c && !usados.has(c.nome) && serve(c, v) && escolher(d, c.nome, v)) return; }
    const pool = d.catalogo.filter((c) => !usados.has(c.nome) && serve(c, v));
    if (pool.length && escolher(d, pool[Math.floor(Math.random() * pool.length)].nome, v)) return;
  }
  jogadaIA(d);
}

// Mostra o draft e devolve { azul, vermelho, bans } quando termina.
export function abrirDraft({ catalogo, azul, vermelho, semente, nomeAzul, nomeVermelho }) {
  return new Promise((resolver) => {
    const d = novoDraft(catalogo, azul, vermelho, semente);
    const S = { vaga: null, busca: '', trocando: false, passoT: -1, fim: 0, iaEm: 0, relogio: null };
    const fundo = document.createElement('div'); fundo.className = 'pt-fundo pt-draft';
    document.body.appendChild(fundo);
    const bansHtml = (lado, agora) => Array.from({ length: 5 }, (_, i) => { const n = d.bans[lado][i]; return `<span class="ban ${n ? 'on' : ''} ${agora === lado && i === d.bans[lado].length ? 'agora' : ''}">${n ? campIcone(n, 30) : ''}</span>`; }).join('');
    const colunaHtml = (lado, nome, vez) => `<div class="col ${lado === 'azul' ? 'a' : 'v'}"><h3>${esc(nome)}</h3>${VAGAS.map((v) => {
      const c = d.picks[lado][v]; const j = jogadorDaVaga(d, lado, v);
      const sel = lado === 'azul' && S.vaga === v;
      const vezAqui = vez && vez.tipo === 'pick' && vez.lado === lado && !c && (lado === 'azul' ? sel : v === vez.vagaIA);
      return `<div class="slot ${c ? 'ok' : ''} ${sel ? 'sel' : ''} ${vezAqui ? 'agora' : ''}" ${lado === 'azul' && !c ? `data-vaga="${v}"` : ''}>${c ? campIcone(c.nome, 38) : '<span class="vazio"></span>'}<div><b>${c ? esc(c.nome) : NOME[v]}</b><small>${esc(j?.nome || '')} · ${NOME[v]}</small></div></div>`;
    }).join('')}</div>`;
    function desenhar() {
      const p = passoAtual(d);
      if (!p) { finalizar(); return; }
      const minha = p.lado === 'azul';
      const usados = indisponiveis(d);
      if (p.tipo === 'pick' && minha && !S.vaga) S.vaga = vagasLivres(d, 'azul')[0];
      if (p.tipo === 'pick' && minha && S.vaga && d.picks.azul[S.vaga]) S.vaga = vagasLivres(d, 'azul')[0];
      const q = S.busca.trim().toLowerCase();
      let lista = catalogo.filter((c) => !q || c.nome.toLowerCase().includes(q));
      if (p.tipo === 'pick' && minha) lista = lista.filter((c) => serve(c, S.vaga));
      const fav = (c) => p.tipo === 'pick' && minha && (jogadorDaVaga(d, 'azul', S.vaga)?.favoritos || []).find((f) => f.nome === c.nome || f.id === c.id);
      const grade = lista.map((c) => { const off = usados.has(c.nome); const f = fav(c); return `<button type="button" class="ch ${off ? 'off' : ''} ${f ? 'fav' : ''}" data-nome="${esc(c.nome)}" ${off || !minha ? 'disabled' : ''} title="${esc(c.nome)}${f ? ` · favorito (+${f.bonus_pct}%)` : ''}">${campIcone(c.nome, 44)}<span>${esc(c.nome)}</span></button>`; }).join('');
      const titulo = !minha ? `${esc(nomeVermelho)} está ${p.tipo === 'ban' ? 'banindo' : 'escolhendo'}…` : p.tipo === 'ban' ? 'Sua vez: <b>banir</b> um campeão' : `Sua vez: <b>escolher</b> o campeão de ${NOME[S.vaga]} (${esc(jogadorDaVaga(d, 'azul', S.vaga)?.nome || '')})`;
      if (S.passoT !== d.passo) { // vez nova: zera o cronômetro e sorteia quando o computador joga
        S.passoT = d.passo; S.fim = Date.now() + TEMPO_ACAO * 1000; S.iaEm = Date.now() + (IA_MIN + Math.random() * (IA_MAX - IA_MIN)) * 1000;
      }
      const vez = { tipo: p.tipo, lado: p.lado, vagaIA: !minha && p.tipo === 'pick' ? (vagasLivres(d, 'vermelho')[0] || null) : null };
      const ban = p.tipo === 'ban';
      fundo.innerHTML = `<div class="pt-modal pt-draft-box ${ban ? 'v-ban' : 'v-pick'} ${minha ? 'minha' : ''}"><h2>Picks e bans</h2>
        <p class="pt-mudo vez">${titulo}</p>
        <div class="fase"><div class="bans"><div>${bansHtml('azul', ban ? p.lado : null)}</div>
          <div class="palavra ${ban ? 'p-ban' : 'p-pick'}">${palavraNeon(ban ? 'BAN' : 'PICK')}<div class="tempo"><span class="num">1:00</span><i class="tbar"><b></b></i></div></div>
          <div>${bansHtml('vermelho', ban ? p.lado : null)}</div></div></div>
        <div class="corpo">${colunaHtml('azul', nomeAzul, vez)}
          <div class="meio"><input type="search" class="busca" placeholder="Buscar campeão" value="${esc(S.busca)}" ${minha ? '' : 'disabled'} />
            <div class="grade">${grade || '<p class="pt-mudo">Nenhum campeão disponível para esta vaga.</p>'}</div></div>
          ${colunaHtml('vermelho', nomeVermelho, vez)}</div>
        ${minha && p.tipo === 'pick' ? '<p class="pt-mudo">Escolha a vaga na sua coluna para ver só os campeões que jogam nela. Campeões com borda dourada são favoritos do jogador e dão bônus de maestria.</p>' : ''}</div>`;
      const busca = fundo.querySelector('.busca');
      if (minha) busca.addEventListener('input', () => { S.busca = busca.value; const pos = busca.selectionStart; desenhar(); const n = fundo.querySelector('.busca'); n.focus(); n.setSelectionRange(pos, pos); });
      fundo.querySelectorAll('[data-vaga]').forEach((el) => el.addEventListener('click', () => { if (p.tipo === 'pick' && minha) { S.vaga = el.dataset.vaga; desenhar(); } }));
      fundo.querySelectorAll('.ch').forEach((el) => el.addEventListener('click', () => {
        const nome = el.dataset.nome;
        const ok = p.tipo === 'ban' ? banir(d, nome) : escolher(d, nome, S.vaga);
        if (ok) { S.busca = ''; avancar(); }
      }));
      atualizarTempo();
    }
    function avancar() { desenhar(); }
    // O cronômetro só mexe no texto e na barra; a jogada automática vale para o tempo esgotado (qualquer lado) e para o computador.
    function atualizarTempo() {
      const p = passoAtual(d); if (!p) return;
      const resta = Math.max(0, S.fim - Date.now());
      const n = fundo.querySelector('.tempo .num'); if (n) { const sg = Math.ceil(resta / 1000); n.textContent = `${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, '0')}`; }
      const b = fundo.querySelector('.tempo .tbar b'); if (b) b.style.width = `${resta / (TEMPO_ACAO * 10)}%`;
      fundo.querySelector('.tempo')?.classList.toggle('fim', resta <= 10000);
      if (p.lado !== 'azul' && Date.now() >= S.iaEm) { jogadaIA(d); S.busca = ''; desenhar(); } else if (resta <= 0) { jogadaAutomatica(d, p, S.vaga); S.busca = ''; desenhar(); }
    }
    function finalizar() {
      clearInterval(S.relogio);
      const r = resultadoDraft(d);
      fundo.innerHTML = `<div class="pt-modal pt-draft-box"><h2>Draft completo</h2><div class="corpo fim">${colunaHtml('azul', nomeAzul)}<div class="meio"><p class="pt-mudo">Os campeões estão escolhidos. Boa partida!</p><button type="button" class="pt-btn ouro grande" id="d-ir">Começar a partida</button></div>${colunaHtml('vermelho', nomeVermelho)}</div></div>`;
      fundo.querySelector('#d-ir').onclick = () => { fundo.remove(); resolver(r); };
    }
    function intro() {
      fundo.innerHTML = `<div class="pt-modal pt-draft-box intro"><h2>Picks e bans</h2><div class="corpo fim">${colunaHtml('azul', nomeAzul)}<div class="meio"><p class="pt-mudo">Cada banimento ou escolha tem <b>${TEMPO_ACAO} segundos</b>. Se o tempo acabar, o jogo escolhe por você (o campeão de maior maestria do jogador).</p><button type="button" class="pt-btn ouro grande" id="d-comecar">Começar Picks e Bans</button></div>${colunaHtml('vermelho', nomeVermelho)}</div></div>`;
      fundo.querySelector('#d-comecar').onclick = () => { S.relogio = setInterval(atualizarTempo, 250); desenhar(); };
    }
    prepararImagens().finally(intro);
  });
}
