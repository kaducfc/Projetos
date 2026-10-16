// Tela de picks e bans do amistoso. Você é o lado azul; o computador escolhe pelo vermelho.
import { prepararImagens, campIcone } from '../../js/campeoes-img.js';
import { novoDraft, passoAtual, terminou, banir, escolher, jogadaIA, vagasLivres, indisponiveis, serve, jogadorDaVaga, resultadoDraft, ORDEM, VAGAS } from '../dados/draft.js';

const NOME = { top: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador', suporte: 'Suporte' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mostra o draft e devolve { azul, vermelho, bans } quando termina.
export function abrirDraft({ catalogo, azul, vermelho, semente, nomeAzul, nomeVermelho }) {
  return new Promise((resolver) => {
    const d = novoDraft(catalogo, azul, vermelho, semente);
    const S = { vaga: null, busca: '', trocando: false };
    const fundo = document.createElement('div'); fundo.className = 'pt-fundo pt-draft';
    document.body.appendChild(fundo);
    const bansHtml = (lado) => Array.from({ length: 5 }, (_, i) => { const n = d.bans[lado][i]; return `<span class="ban ${n ? 'on' : ''}">${n ? campIcone(n, 30) : ''}</span>`; }).join('');
    const colunaHtml = (lado, nome) => `<div class="col ${lado === 'azul' ? 'a' : 'v'}"><h3>${esc(nome)}</h3>${VAGAS.map((v) => {
      const c = d.picks[lado][v]; const j = jogadorDaVaga(d, lado, v);
      const sel = lado === 'azul' && S.vaga === v;
      return `<div class="slot ${c ? 'ok' : ''} ${sel ? 'sel' : ''}" ${lado === 'azul' && !c ? `data-vaga="${v}"` : ''}>${c ? campIcone(c.nome, 38) : '<span class="vazio"></span>'}<div><b>${c ? esc(c.nome) : NOME[v]}</b><small>${esc(j?.nome || '')} · ${NOME[v]}</small></div></div>`;
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
      const feitos = d.passo, total = ORDEM.length;
      const titulo = !minha ? `${esc(nomeVermelho)} está escolhendo…` : p.tipo === 'ban' ? 'Sua vez: <b>banir</b> um campeão' : `Sua vez: <b>escolher</b> o campeão de ${NOME[S.vaga]} (${esc(jogadorDaVaga(d, 'azul', S.vaga)?.nome || '')})`;
      fundo.innerHTML = `<div class="pt-modal pt-draft-box"><h2>Picks e bans</h2>
        <p class="pt-mudo">Passo ${feitos + 1} de ${total} · ${titulo}</p>
        <div class="bans"><div>${bansHtml('azul')}</div><small>Bans</small><div>${bansHtml('vermelho')}</div></div>
        <div class="corpo">${colunaHtml('azul', nomeAzul)}
          <div class="meio"><input type="search" class="busca" placeholder="Buscar campeão" value="${esc(S.busca)}" ${minha ? '' : 'disabled'} />
            <div class="grade">${grade || '<p class="pt-mudo">Nenhum campeão disponível para esta vaga.</p>'}</div></div>
          ${colunaHtml('vermelho', nomeVermelho)}</div>
        ${minha && p.tipo === 'pick' ? '<p class="pt-mudo">Escolha a vaga na sua coluna para ver só os campeões que jogam nela. Campeões com borda dourada são favoritos do jogador e dão bônus de maestria.</p>' : ''}</div>`;
      const busca = fundo.querySelector('.busca');
      if (minha) busca.addEventListener('input', () => { S.busca = busca.value; const pos = busca.selectionStart; desenhar(); const n = fundo.querySelector('.busca'); n.focus(); n.setSelectionRange(pos, pos); });
      fundo.querySelectorAll('[data-vaga]').forEach((el) => el.addEventListener('click', () => { if (p.tipo === 'pick' && minha) { S.vaga = el.dataset.vaga; desenhar(); } }));
      fundo.querySelectorAll('.ch').forEach((el) => el.addEventListener('click', () => {
        const nome = el.dataset.nome;
        const ok = p.tipo === 'ban' ? banir(d, nome) : escolher(d, nome, S.vaga);
        if (ok) { S.busca = ''; avancar(); }
      }));
      if (!minha) setTimeout(() => { jogadaIA(d); avancar(); }, 650);
    }
    function avancar() { desenhar(); }
    function finalizar() {
      const r = resultadoDraft(d);
      fundo.innerHTML = `<div class="pt-modal pt-draft-box"><h2>Draft completo</h2><div class="corpo fim">${colunaHtml('azul', nomeAzul)}<div class="meio"><p class="pt-mudo">Os campeões estão escolhidos. Boa partida!</p><button type="button" class="pt-btn ouro" id="d-ir">Começar a partida</button></div>${colunaHtml('vermelho', nomeVermelho)}</div></div>`;
      fundo.querySelector('#d-ir').onclick = () => { fundo.remove(); resolver(r); };
    }
    prepararImagens().finally(desenhar);
  });
}
