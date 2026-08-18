// Correio (menu Outros) — mensagens do Admin (avisos de atualização/bug)
// e recompensas automáticas da Arena (diária/semanal, ver
// supabase/migrations/0011_pvp_daily_weekly_rewards.sql). Cliente Supabase
// compartilhado com o resto do PvP (ver systems/pvp.js) — mesma sessão
// anônima, sem login separado.
//
// Confiança: resgatar aqui é um UPDATE direto (marca claimed=true) feito
// pelo PRÓPRIO cliente, sem passar por Edge Function — mesmo nível de
// confiança que hunter_level/transcend_count já tinham (ver
// 0002/0008_pvp_ranks.sql). O item em si (fragmento/ovo/carta) é aplicado
// aqui, no SAVE LOCAL — o Supabase só guarda "o que" foi prometido, nunca
// teve acesso ao inventário do jogador.
import { getClient, ensureSignedIn } from './pvp.js';
import { CARD_FRAGMENT_ID, CARDS } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';

export async function fetchMailbox() {
  const userId = await ensureSignedIn();
  if (!userId) return [];
  const { data, error } = await getClient()
    .from('pvp_mailbox').select('*').eq('profile_id', userId).order('created_at', { ascending: false });
  if (error) {
    console.warn('Correio: falha ao buscar mensagens:', error.message);
    return [];
  }
  return data || [];
}

// reward_type/reward2_type possíveis (ver check constraint em
// 0010/0013): 'none', 'card_fragment', 'pet_fragment', 'egg',
// 'random_card', 'gold', 'esmeralda'.
export function mailHasReward(message) {
  return message.reward_type !== 'none' || !!message.reward2_type;
}

export function hasUnreadMail(messages) {
  return messages.some((m) => !m.read);
}

/// Marca a mensagem como LIDA (diferente de resgatada, ver claimMailReward
/// abaixo) — chamado ao abrir a janela de detalhe (ver showMailDetailModal
/// em ui/render.js), é o que apaga o indicador de "não lida" (ver
/// 0014_pvp_mailbox_read.sql).
export async function markMailRead(messageId) {
  const userId = await ensureSignedIn();
  if (!userId) return false;
  const { error } = await getClient()
    .from('pvp_mailbox').update({ read: true }).eq('id', messageId).eq('profile_id', userId);
  if (error) {
    console.warn('Correio: falha ao marcar como lida:', error.message);
    return false;
  }
  return true;
}

export function mailIsFullyClaimed(message) {
  return !mailHasReward(message) || message.claimed;
}

/// Aplica UMA recompensa (reward_type/reward_amount) no save local — usado
/// duas vezes por mensagem (a principal e a reward2_*, se tiver).
function applyMailReward(state, type, amount) {
  if (type === 'card_fragment') {
    state.materials = state.materials || {};
    state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + amount;
  } else if (type === 'pet_fragment') {
    state.petFragments = (state.petFragments || 0) + amount;
  } else if (type === 'egg') {
    state.eggCount = (state.eggCount || 0) + amount;
  } else if (type === 'gold') {
    state.gold = (state.gold || 0) + amount;
  } else if (type === 'esmeralda') {
    state.cash = (state.cash || 0) + amount;
  } else if (type === 'random_card') {
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    if (card) {
      state.cards = state.cards || {};
      state.cards[card.id] = (state.cards[card.id] || 0) + 1;
      recordCardDiscovered(state, card.id);
    }
  }
}

/// Aplica a(s) recompensa(s) da mensagem no save local e marca ela como
/// resgatada no Supabase (só a coluna "claimed" — é a única que o
/// cliente tem permissão de escrever, ver GRANT em 0010_pvp_mailbox.sql).
/// Retorna true se resgatou de fato (false se já não tinha item, ou se a
/// escrita no servidor falhou — nesse caso NÃO aplica o item local, pra
/// não conceder 2x se o jogador tentar de novo).
export async function claimMailReward(state, message) {
  if (!mailHasReward(message) || message.claimed) return false;
  const userId = await ensureSignedIn();
  if (!userId) return false;
  const { error } = await getClient()
    .from('pvp_mailbox').update({ claimed: true }).eq('id', message.id).eq('profile_id', userId);
  if (error) {
    console.warn('Correio: falha ao resgatar:', error.message);
    return false;
  }
  applyMailReward(state, message.reward_type, message.reward_amount);
  if (message.reward2_type) applyMailReward(state, message.reward2_type, message.reward2_amount);
  return true;
}

/// Só permite apagar mensagem sem item pendente (ver mailIsFullyClaimed) —
/// a RLS de delete (ver 0010_pvp_mailbox.sql) já bloqueia isso do lado do
/// servidor também, esse check aqui só evita a viagem de rede à toa.
export async function deleteMail(messageId) {
  const userId = await ensureSignedIn();
  if (!userId) return false;
  const { error } = await getClient()
    .from('pvp_mailbox').delete().eq('id', messageId).eq('profile_id', userId);
  if (error) {
    console.warn('Correio: falha ao apagar:', error.message);
    return false;
  }
  return true;
}
