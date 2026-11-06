// "Expedição do Caçador" — sem janela por ciclo nem luta. O jogador escolhe
// 1 de 3 durações (1h/4h/8h); ao clicar Entrar, a recompensa (Moeda de
// Evento + Ovo de Mascote) é concedida NA HORA, sem precisar voltar depois
// pra "coletar" nada. O único gate é um cooldown ÚNICO e COMPARTILHADO
// entre as 3 durações (não 3 relógios independentes) — ao entrar numa
// expedição de duração D, o jogador só pode entrar em QUALQUER expedição
// de novo depois de D (ver state.expeditionReadyAt / canEnterExpedition em
// systems/expedition.js). Escolher uma duração maior trava por mais tempo,
// mas rende proporcionalmente mais — e com melhores chances de bônus, ver
// EXPEDITION_REWARDS abaixo.
export const EXPEDITION_TIERS = [
  { id: '1h', label: '1 Hora', durationMs: 1 * 60 * 60 * 1000, color: '#63d47a', image: 'assets/ui/scenes/zone1.jpg' },
  { id: '4h', label: '4 Horas', durationMs: 4 * 60 * 60 * 1000, color: '#b56de0', image: 'assets/ui/scenes/zone5.jpg' },
  { id: '8h', label: '8 Horas', durationMs: 8 * 60 * 60 * 1000, color: '#e8c94a', image: 'assets/ui/scenes/zone10.jpg' },
];

// Cada recompensa (gold/currency/eggs) é uma lista de "linhas" independentes
// — {chance, qty}. A 1ª linha de cada lista tem sempre chance 1 (garantida,
// sempre entra); as demais são rolls independentes que, quando acontecem,
// SOMAM ao total (não são tiers exclusivos de "pelo menos X") — ver
// rollExpeditionRewardRows em systems/expedition.js. Ex.: garantido 4 + 25%
// chance de mais 5 + 2% chance de mais 8 (podendo empilhar os 2 bônus na
// mesma expedição). Valores de ovo pedidos explicitamente pelo usuário (ovos
// 4/5/8, 14/17/28, 23/31/50 por duração); moeda de evento segue o mesmo
// formato/proporção — só os 2 extremos (1h=20, 8h=140) foram dados, o resto
// foi calculado espelhando a mesma progressão usada nos ovos. Ouro (pedido
// depois) segue exatamente a mesma forma — garantido + 2 bônus, mesmas %
// de chance da moeda de evento em cada duração, só numa escala maior
// (ouro é bem mais abundante no jogo que Moeda de Evento).
export const EXPEDITION_REWARDS = {
  '1h': {
    gold: [{ chance: 1, qty: 1000 }, { chance: 0.25, qty: 1250 }, { chance: 0.02, qty: 2000 }],
    currency: [{ chance: 1, qty: 20 }, { chance: 0.25, qty: 25 }, { chance: 0.02, qty: 40 }],
    eggs: [{ chance: 1, qty: 4 }, { chance: 0.25, qty: 5 }, { chance: 0.02, qty: 8 }],
  },
  '4h': {
    gold: [{ chance: 1, qty: 4000 }, { chance: 0.3, qty: 4750 }, { chance: 0.03, qty: 8000 }],
    currency: [{ chance: 1, qty: 80 }, { chance: 0.3, qty: 95 }, { chance: 0.03, qty: 160 }],
    eggs: [{ chance: 1, qty: 14 }, { chance: 0.3, qty: 17 }, { chance: 0.03, qty: 28 }],
  },
  '8h': {
    gold: [{ chance: 1, qty: 7000 }, { chance: 0.35, qty: 9500 }, { chance: 0.05, qty: 15000 }],
    currency: [{ chance: 1, qty: 140 }, { chance: 0.35, qty: 190 }, { chance: 0.05, qty: 300 }],
    eggs: [{ chance: 1, qty: 23 }, { chance: 0.35, qty: 31 }, { chance: 0.05, qty: 50 }],
  },
};

export function getExpeditionTier(tierId) {
  return EXPEDITION_TIERS.find((t) => t.id === tierId) || null;
}
