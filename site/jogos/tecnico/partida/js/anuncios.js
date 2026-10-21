// Anúncios na tela, no estilo do jogo real: Primeiro Sangue, Double/Triple/Quadra/Penta Kill, ACE, Shutdown, torres, inibidores, Nexus
// e objetivos épicos. Só leem os eventos do motor (P.eventos); não alteram a simulação.
import { campIcone } from '../../js/campeoes-img.js';
import { t } from '../../../../shared/i18n.js';

const JANELA_MULTI = 10; // segundos de jogo entre abates seguidos para contar como multi-abate
const MULTI = { 2: ['DOUBLE KILL!', 4], 3: ['TRIPLE KILL!', 7], 4: ['QUADRA KILL!', 8], 5: ['PENTAKILL!', 10] };
const EPICO = { dragao: ['DRAGÃO ELIMINADO!', 6], anciao: ['DRAGÃO ANCIÃO ELIMINADO!', 8], arauto: ['ARAUTO ELIMINADO!', 6], barao: ['BARÃO NASHOR ELIMINADO!', 8] };
// Abates seguidos sem morrer (como no jogo): 3, 4, 5, 6, 7 e 8 ou mais.
const SERIE = { 3: ['KILLING SPREE!', 5], 4: ['RAMPAGE!', 6], 5: ['UNSTOPPABLE!', 7], 6: ['DOMINATING!', 8], 7: ['GODLIKE!', 9], 8: ['LEGENDARY!', 9.5] };
// Imagem de quem deu o golpe final numa execução.
function imgExecutor(e, eqK) {
  const sub = e.fonteSubtipo || ''; const eq = e.fonteEquipe === 'azul' || e.fonteEquipe === 'vermelho' ? e.fonteEquipe : eqK;
  if (e.por === 'minion') return `img/minion_${eq}_frente.webp`;
  if (e.por === 'estrutura') return sub === 'inibidor' ? `img/inibidor_${eq}.webp` : sub === 'nexus' ? `img/nexus_${eq}.webp` : `img/torre_${eq}.webp`;
  if (e.por === 'epico') return `img/epicos/${sub}.webp`;
  if (e.por === 'monstro') { const k = sub.split('_').pop(); return `img/${k}.webp`; }
  return `img/minion_${eq}_frente.webp`;
}
const outro = (eq) => (eq === 'azul' ? 'vermelho' : 'azul');

export function criarAnuncios(mapaEl) {
  const caixa = document.createElement('div'); caixa.className = 'pt-anuncios'; caixa.setAttribute('aria-live', 'polite'); mapaEl.appendChild(caixa);
  const fila = []; let tocando = false; let veloc = 1; let ativo = true;
  const multi = new Map(); // abatedor -> { n, t }
  let primeiro = null; // vítima do First Blood (o evento vem logo antes do abate)
  const seq = new Map();   // campeão -> abates seguidos sem morrer

  const mostrar = () => {
    if (tocando || !fila.length) return;
    fila.sort((a, b) => b.prio - a.prio); const a = fila.shift(); tocando = true;
    const el = document.createElement('div'); el.className = `pt-an ${a.classe} eq-${a.equipe}`; el.innerHTML = a.html; caixa.appendChild(el);
    requestAnimationFrame(() => el.classList.add('entra'));
    setTimeout(() => { el.classList.remove('entra'); el.classList.add('sai'); setTimeout(() => { el.remove(); tocando = false; mostrar(); }, 320); }, a.dur);
  };
  const por = (a) => {
    // em velocidade alta só passam os anúncios importantes, para não cobrir o mapa
    if (!ativo || a.prio < (veloc >= 16 ? 6 : veloc >= 8 ? 4 : 1)) return;
    fila.push(a); while (fila.length > 4) { fila.sort((x, y) => x.prio - y.prio); fila.shift(); } mostrar();
  };
  const retrato = (P, id, eq, imgFallback) => {
    const u = id ? P.mapaUnidades.get(id) : null;
    if (u && u.campeao) return `<span class="an-ret ${u.equipe}">${campIcone(u.campeao, 56)}</span>`;
    return `<span class="an-ret ${eq}"><img src="img/${imgFallback}.webp" alt="" width="56" height="56" /></span>`;
  };
  const quadro = (P, { esq, dir, titulo, sub, equipe, classe, prio, dur }) => {
    por({ equipe, classe, prio, dur, html: `${esq}<div class="an-meio"><b>${t(titulo)}</b>${sub ? `<small>${sub}</small>` : ''}</div>${dir || ''}` });
  };
  const imgObj = (src, eq) => `<span class="an-ret obj ${eq}"><img src="${src}" alt="" width="56" height="56" /></span>`;
  const nomeDe = (P, id) => P.mapaUnidades.get(id)?.campeao || '';

  const aoAbate = (e, P) => {
    const pular = primeiro; primeiro = null; // o First Blood já anuncia esta eliminação
    const v = P.mapaUnidades.get(e.vitima); const kid = e.abatedor; const k = kid ? P.mapaUnidades.get(kid) : null;
    const vseq = seq.get(e.vitima) || 0; seq.set(e.vitima, 0); multi.delete(e.vitima);
    const eqK = e.equipe; const eqV = v?.equipe || outro(eqK);
    // ACE: todos os campeões do time derrotado estão mortos
    const ace = P.campeoes.filter((c) => c.equipe === eqV).every((c) => c.morto);
    if (k && k.tipo === 'campeao') {
      seq.set(kid, (seq.get(kid) || 0) + 1);
      const m = multi.get(kid); const n = m && e.t - m.t <= JANELA_MULTI ? m.n + 1 : 1; multi.set(kid, { n, t: e.t });
      const esq = retrato(P, kid, eqK, 'minion_azul_frente'); const dir = retrato(P, e.vitima, eqV, 'minion_azul_frente');
      if (n >= 2) { const [tt, prio] = MULTI[Math.min(5, n)]; quadro(P, { esq, dir, titulo: tt, equipe: eqK, classe: n >= 4 ? 'epico' : 'multi', prio, dur: n >= 4 ? 3600 : 2800 }); }
      else if (vseq >= 3) quadro(P, { esq, dir, titulo: 'SHUTDOWN!', sub: `${vseq} ${t('abates seguidos')}`, equipe: eqK, classe: 'multi', prio: 5, dur: 2600 });
      else if (pular !== e.vitima) quadro(P, { esq, dir, titulo: 'ELIMINOU!', equipe: eqK, classe: 'abate', prio: 1, dur: 1700 });
    } else {
      // executado: ninguém causou dano nos últimos 15s; a imagem é de quem deu o golpe final (tropa, monstro, torre...)
      quadro(P, { esq: `<span class="an-ret ${e.fonteEquipe === 'azul' || e.fonteEquipe === 'vermelho' ? e.fonteEquipe : eqK}"><img src="${imgExecutor(e, eqK)}" alt="" width="56" height="56" /></span>`, dir: retrato(P, e.vitima, eqV, 'minion_azul_frente'), titulo: 'EXECUTADO!', equipe: eqK, classe: 'abate', prio: 2, dur: 2000 });
    }
    if (k && k.tipo === 'campeao') {
      const serie = seq.get(kid); const def = SERIE[Math.min(8, serie)];
      if (serie >= 3 && def) quadro(P, { esq: retrato(P, kid, eqK, 'minion_azul_frente'), titulo: def[0], sub: `${serie} ${t('abates seguidos')}`, equipe: eqK, classe: def[1] >= 8 ? 'epico' : 'multi', prio: def[1], dur: def[1] >= 8 ? 3600 : 2800 });
    }
    if (ace) quadro(P, { esq: retrato(P, kid, eqK, 'nexus_azul'), titulo: 'ACE!', equipe: eqK, classe: 'epico', prio: 9, dur: 3200 });
  };

  return {
    definirVelocidade(v) { veloc = v; },
    ativar(v) { ativo = v; if (!v) { fila.length = 0; caixa.innerHTML = ''; tocando = false; } },
    reiniciar() { fila.length = 0; caixa.innerHTML = ''; tocando = false; multi.clear(); seq.clear(); },
    evento(e, P) {
      const eq = e.equipe;
      if (e.tipo === 'abate') return aoAbate(e, P);
      if (e.tipo === 'primeiro_abate') { primeiro = e.vitima; return quadro(P, { esq: retrato(P, e.campeao, eq), dir: retrato(P, e.vitima, outro(eq)), titulo: 'FIRST BLOOD!', equipe: eq, classe: 'multi', prio: 5, dur: 2800 }); }
      if (e.tipo === 'torre_destruida' || e.tipo === 'inibidor_destruido') {
        const dono = outro(eq); const torre = e.tipo === 'torre_destruida';
        return quadro(P, { esq: retrato(P, e.abatedor, eq, `minion_${eq}_frente`), dir: imgObj(torre ? `img/torre_${dono}.webp` : `img/inibidor_${dono}.webp`, dono), titulo: torre ? 'TORRE DESTRUÍDA!' : 'INIBIDOR DESTRUÍDO!', equipe: eq, classe: 'obj', prio: torre ? 4 : 5, dur: 2400 });
      }
      if (e.tipo === 'nexus_destruido') return quadro(P, { esq: retrato(P, e.abatedor, eq, `minion_${eq}_frente`), dir: imgObj(`img/nexus_${outro(eq)}.webp`, outro(eq)), titulo: 'NEXUS DESTRUÍDO!', equipe: eq, classe: 'epico', prio: 10, dur: 3600 });
      if (e.tipo === 'objetivo_abatido' && EPICO[e.objetivo]) {
        const [tt, prio] = EPICO[e.objetivo];
        return quadro(P, { esq: retrato(P, e.abatedor, eq, 'nexus_azul'), dir: imgObj(`img/epicos/${e.objetivo}.webp`, eq), titulo: tt, sub: e.roubado ? t('Roubado!') : '', equipe: eq, classe: prio >= 8 ? 'epico' : 'obj', prio, dur: prio >= 8 ? 3400 : 2600 });
      }
      if (e.tipo === 'alma_dragao') return quadro(P, { esq: `<span class="an-ret ${eq}"><img src="img/epicos/dragao.webp" alt="" width="56" height="56" /></span>`, titulo: 'ALMA DO DRAGÃO CONQUISTADA!', equipe: eq, classe: 'epico', prio: 7, dur: 3000 });
    },
  };
}
