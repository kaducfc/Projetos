// Vigilância dos jogos da ranqueada (Lendas, Runetermo, Campeão Oculto e Na
// Medida): sinais de partida suspeita, para o painel. Só sugerem onde olhar;
// um sinal sozinho não prova trapaça (acaso e bom jogo também acontecem).

export const JOGOS_VIGIA = ['cblol', 'runetermo', 'campeao', 'escala'];

// Cada sinal: [código, texto curto]. `p` é uma linha de site_admin_vigia.
export function sinaisVigia(p) {
  const out = [];
  const rapido = (limite) => p.duracao_s != null && p.duracao_s < limite;
  if (p.jogo === 'cblol') {
    if (p.invicto) out.push(['rara', 'Campeão invicto']);
    if (rapido(30)) out.push(['rapida', 'Rápida demais']);
  } else if (p.jogo === 'runetermo' || p.jogo === 'campeao') {
    const ganhou = p.status === 'ganhou';
    if (ganhou && p.chutes === 1) out.push(['rara', 'Acertou de primeira']);
    if (ganhou && rapido(5)) out.push(['rapida', 'Rápida demais']);
  } else if (p.jogo === 'escala') {
    if (Number(p.media) >= 95) out.push(['rara', 'Média quase perfeita']);
    if (rapido(15)) out.push(['rapida', 'Rápida demais']);
  }
  return out;
}

// Um jogador por linha: quantas partidas, quantas com sinais, em que jogos.
export function resumoJogadores(partidas) {
  const por = new Map();
  for (const p of partidas) {
    const j = por.get(p.username) || { nome: p.username, partidas: 0, comSinais: 0, dias: new Set(), jogos: {} };
    j.partidas++;
    if (sinaisVigia(p).length) {
      j.comSinais++;
      j.dias.add(p.dia);
      j.jogos[p.jogo] = (j.jogos[p.jogo] || 0) + 1;
    }
    por.set(p.username, j);
  }
  return [...por.values()]
    .map((j) => ({ ...j, dias: j.dias.size }))
    .sort((a, b) => b.dias - a.dias || b.comSinais - a.comSinais || b.partidas - a.partidas);
}
