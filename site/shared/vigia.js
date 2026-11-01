// Vigilância dos jogos da ranqueada (Lendas, Runetermo, Campeão Oculto e Na
// Medida): sinais de partida suspeita, para o painel. Só sugerem onde olhar;
// um sinal sozinho não prova trapaça (acaso e bom jogo também acontecem).

export const JOGOS_VIGIA = ['cblol', 'runetermo', 'campeao', 'escala']; // lista de vigilância; a ficha do jogador também mostra a Carreira

// Só entram sinais que acaso e bom jogo não explicam sozinhos: tempo impossível para quem joga de verdade
// e (na Carreira, pelo painel) nota fora da faixa possível. Ser muito bom (nota alta, campeão invicto, média
// quase perfeita) ou ter sorte (acertar de primeira) NÃO é sinal; só vira sinal se repetir em vários dias.
// Cada sinal: [código, texto curto]. `p` é uma linha de site_admin_vigia.
export const DIAS_SORTE = 3; // acertos de primeira em tantos dias diferentes viram sinal

export function sinaisVigia(p) {
  const out = [];
  const rapido = (limite) => p.duracao_s != null && p.duracao_s < limite;
  if (p.jogo === 'cblol') {
    if (rapido(30)) out.push(['rapida', 'Rápida demais']);
  } else if (p.jogo === 'runetermo' || p.jogo === 'campeao') {
    const ganhou = p.status === 'ganhou';
    if (ganhou && rapido(5)) out.push(['rapida', 'Rápida demais']);
    if (p.sorte_repetida) out.push(['rara', 'Acerta de primeira em vários dias']);
  } else if (p.jogo === 'carreira-no-rift') {
    if (rapido(180)) out.push(['rapida', 'Rápida demais']);
  } else if (p.jogo === 'escala') {
    if (Number(p.media) >= 99) out.push(['rara', 'Média perfeita']);
    if (rapido(15)) out.push(['rapida', 'Rápida demais']);
  }
  return out;
}

// Marca (em `sorte_repetida`) as vitórias de primeira de quem fez isso em DIAS_SORTE dias diferentes ou mais
// no mesmo jogo, dentro das partidas recebidas. Uma só não prova nada; a repetição é que chama atenção.
export function anotarRepeticoes(partidas) {
  const dias = new Map();
  const deprimeira = (p) => (p.jogo === 'runetermo' || p.jogo === 'campeao') && p.status === 'ganhou' && p.chutes === 1 && !p.dicas;
  for (const p of partidas) {
    p.sorte_repetida = false;
    if (!deprimeira(p)) continue;
    const k = `${p.username}|${p.jogo}`;
    if (!dias.has(k)) dias.set(k, new Set());
    dias.get(k).add(p.dia);
  }
  for (const p of partidas) if (deprimeira(p) && dias.get(`${p.username}|${p.jogo}`).size >= DIAS_SORTE) p.sorte_repetida = true;
  return partidas;
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
