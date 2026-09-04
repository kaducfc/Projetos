// Arena PvP (assíncrona, com Tiers/Rank) — cliente Supabase. Ver
// supabase/migrations/0001_pvp_arena.sql + 0002_pvp_tiers.sql pro schema
// e supabase/functions/resolve-pvp-battle pra lógica de resolução de luta
// (roda no servidor, nunca no cliente — ver o comentário lá em cima).
//
// Import via CDN (esm.sh), sem bundler — mesmo espírito "no-build-step"
// do resto do projeto (ver build-bundle.mjs). O @supabase/supabase-js já
// persiste a sessão sozinho em localStorage, então um refresh de página
// mantém o mesmo login anônimo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PVP_MAX_ENTRIES, PVP_ENTRY_REGEN_MS } from '../data/pvpConfig.js';
import { isVipActive } from '../state.js';
import { computePlayerPower } from './power.js';

let client = null;
export function getClient() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/// Login anônimo (sem e-mail/senha) — cria (ou recupera, se já existia
/// sessão salva) uma conta Supabase de verdade por trás dos panos, só sem
/// nenhuma fricção de cadastro pro jogador. Precisa de "Anonymous
/// Sign-Ins" habilitado no painel Supabase (Authentication > Providers).
/// Retorna o user id, ou null se falhar (sem internet, projeto mal
/// configurado, etc. — todo chamador trata null como "PvP indisponível
/// agora").
export async function ensureSignedIn() {
  const supabase = getClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('Arena PvP: falha no login anônimo:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}

/// Checa se `nick` já está em uso por outra conta (ver DEFAULT_PLAYER_NAME
/// em data/profile.js — o chamador NÃO deve chamar isso pro nome padrão,
/// todo jogador novo já começa com ele, não faz sentido bloquear). Busca
/// case-insensitive (ilike) pra "Kadu" e "kadu" contarem como o mesmo
/// nick. Falha de rede = "disponível" (não trava o jogador por causa de
/// conexão instável, mesmo espírito de todo o resto do PvP — só nick
/// repetido de propósito é bloqueado, nunca uma falha técnica).
export async function isNickAvailable(nick) {
  const userId = await ensureSignedIn();
  const supabase = getClient();
  const { data, error } = await supabase.from('pvp_profiles').select('id').ilike('nick', nick).limit(5);
  if (error) {
    console.warn('Arena PvP: falha ao checar nick disponível:', error.message);
    return true;
  }
  return !(data || []).some((row) => row.id !== userId);
}

/// Grava SÓ o nick no servidor NA HORA que o jogador confirma a troca (ver
/// saveProfileNameFlow em main.js) — não espera o próximo ciclo periódico
/// de syncProfile. isNickAvailable acima ainda roda antes, pra UX rápida
/// (a maioria dos casos já barra ali), mas só essa escrita aqui é
/// AUTORITATIVA: o índice único do banco (ver
/// 0025_pvp_profiles_nick_unique.sql) é quem decide de verdade, fechando
/// a janela de corrida entre 2 sessões passando no isNickAvailable quase
/// ao mesmo tempo. 'taken' = outra sessão venceu a corrida (o chamador
/// deve desfazer a troca local); 'network' = falha técnica, sem sinal
/// confiável — o chamador decide se aceita a troca local mesmo assim
/// (mesmo espírito de "falha de rede não trava o jogador" do resto do
/// PvP), sabendo que o próximo syncProfile periódico tenta de novo.
export async function claimNick(nick) {
  const userId = await ensureSignedIn();
  if (!userId) return { ok: false, reason: 'network' };
  const { error } = await getClient().from('pvp_profiles').upsert({
    id: userId, nick, updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'taken' };
    console.warn('Arena PvP: falha ao gravar nick:', error.message);
    return { ok: false, reason: 'network' };
  }
  return { ok: true };
}

/// "Prancheta" do equipamento atual — 1 entrada por slotId ocupado, com só
/// o necessário pra exibir na janela de outro jogador (ver
/// showForeignEquipmentModal em ui/render.js): sem uid (não faz sentido
/// fora do inventário de quem é dono) nem fromAwakening (não afeta exibição).
/// godAttribute só entra quando existe (itens Deus sem atributo preso ao
/// molde, ver data/items.js GOD_ITEMS/systems/godItems.js).
function serializeEquippedSnapshot(state) {
  const bySlot = {};
  for (const [slotId, uid] of Object.entries(state.equipped || {})) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    bySlot[slotId] = {
      itemId: entry.itemId,
      rarityId: entry.rarityId,
      baseStats: entry.baseStats,
      additionalStats: entry.additionalStats,
      enhanceLevel: entry.enhanceLevel,
      isMaster: entry.isMaster,
      cardIds: entry.cardIds,
      ...(entry.godAttribute ? { godAttribute: entry.godAttribute } : {}),
    };
  }
  return bySlot;
}

/// Envia o nick/ícone/nível (ver systems/profile.js) e as stats de combate
/// atuais (ver computePlayerStats em systems/stats.js) pro servidor — é
/// contra ESSA cópia salva que qualquer outro jogador te ataca. tier/
/// rating/entradas NUNCA são mandados daqui — só o servidor mexe neles
/// (ver GRANT de update em 0002_pvp_tiers.sql, que bloqueia o cliente de
/// escrever essas colunas mesmo que tentasse).
export async function syncProfile(state, stats, playerName, profileIconId) {
  const userId = await ensureSignedIn();
  if (!userId) return false;
  const supabase = getClient();

  const [{ error: profileError }, { error: snapshotError }] = await Promise.all([
    supabase.from('pvp_profiles').upsert({
      id: userId,
      nick: playerName,
      icon_id: profileIconId,
      hunter_level: state.hunterLevel || 1,
      transcend_count: state.transcendCount || 0,
      // Nick colorido (ver 0015_pvp_vip_nick.sql + CSS .vip-nick) —
      // auto-reportado, mesmo modelo de confiança de hunter_level acima.
      is_vip: isVipActive(state),
      // Equipamento visível na página Ranks (ver 0016_pvp_equipment_view.sql
      // + showForeignEquipmentModal em ui/render.js) — mesmo modelo de
      // confiança, puramente cosmético.
      equipped_snapshot: serializeEquippedSnapshot(state),
      updated_at: new Date().toISOString(),
    }),
    supabase.from('pvp_snapshots').upsert({
      profile_id: userId,
      dps: stats.dps,
      max_hp: stats.maxHp,
      armor: stats.armor,
      crit_chance: stats.critChance,
      crit_damage: stats.critDamage,
      dodge_chance: stats.dodgeChance,
      pet_dps: stats.petDps || 0,
      attack_speed_per_sec: stats.attackSpeedPerSec || 1,
      // Reflexo de Dano (ver reflectChance em systems/stats.js + 0022_pvp_reflect.sql)
      // — usado pela Edge Function resolve-pvp-battle pra refletir % do
      // dano que o ADVERSÁRIO causa (já pós-crítico/esquiva/armadura) de
      // volta nele, na Arena.
      reflect_percent: stats.reflectChance || 0,
      // Power total (ver js/systems/power.js + 0018_pvp_power.sql) — mostrado
      // na lista de jogadores da Arena (ver pvpBoardRowHtml em ui/render.js).
      power: computePlayerPower(state),
      updated_at: new Date().toISOString(),
    }),
  ]);
  if (profileError) console.warn('Arena PvP: falha ao sincronizar perfil:', profileError.message);
  if (snapshotError) console.warn('Arena PvP: falha ao sincronizar stats:', snapshotError.message);
  return !profileError && !snapshotError;
}

/// Equipamento sincronizado (ver serializeEquippedSnapshot/syncProfile
/// acima) de OUTRO jogador — chamado ao clicar numa linha da página Ranks
/// (ver wireRanksTabEvents em main.js). Null tanto pra erro de rede quanto
/// pra perfil sem nenhuma peça equipada ainda (equipped_snapshot vem
/// '{}' — showForeignEquipmentModal mostra o boneco vazio nesse caso, não
/// precisa diferenciar dos dois motivos aqui).
export async function fetchPlayerEquipment(entityId) {
  const { data, error } = await getClient()
    .from('pvp_profiles')
    .select('nick, icon_id, is_vip, equipped_snapshot')
    .eq('id', entityId)
    .maybeSingle();
  if (error) {
    console.warn('Arena PvP: falha ao buscar equipamento de outro jogador:', error.message);
    return null;
  }
  return data;
}

export async function getMyPvpProfile() {
  const userId = await ensureSignedIn();
  if (!userId) return null;
  const { data, error } = await getClient().from('pvp_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('Arena PvP: falha ao buscar o próprio perfil:', error.message);
    return null;
  }
  return data;
}

/// Entradas disponíveis AGORA, projetando a regeneração (+1/hora) — só
/// pra exibição (contador "X/5" + tempo pra próxima); quem de fato
/// consome/recarrega uma entrada é sempre o servidor (ver
/// projectEntries na Edge Function, mesma fórmula espelhada aqui).
export function projectPvpEntries(storedEntries, updatedAtIso) {
  const elapsedMs = Date.now() - new Date(updatedAtIso).getTime();
  const regen = Math.max(0, Math.floor(elapsedMs / PVP_ENTRY_REGEN_MS));
  const current = Math.min(PVP_MAX_ENTRIES, (storedEntries || 0) + regen);
  const msSinceLastTick = elapsedMs - regen * PVP_ENTRY_REGEN_MS;
  const msUntilNext = current >= PVP_MAX_ENTRIES ? null : PVP_ENTRY_REGEN_MS - msSinceLastTick;
  return { current, msUntilNext };
}

/// A "prancheta" de 1 tier inteiro (só o GRUPO do jogador, do Bronze ao
/// Diamante — ver 0007_pvp_groups.sql sobre por que existem grupos e por
/// que o jogador nunca vê esse número; no Lendário groupIndex é ignorado
/// no servidor, o pool é o tier inteiro) — todo jogador de verdade + os
/// bots ainda visíveis, já ordenados e numerados por posição. Serve tanto
/// de ranking quanto de base pra sortear oponentes (ver
/// pickRandomPvpOpponents abaixo).
export async function fetchTierBoard(tier, groupIndex) {
  const { data, error } = await getClient().rpc('pvp_tier_board', {
    target_tier: tier,
    target_group: groupIndex,
  });
  if (error) {
    console.warn('Arena PvP: falha ao buscar o tier:', error.message);
    return [];
  }
  return data || [];
}

// Mesma faixa de pontos por luta da Edge Function (ver
// supabase/functions/resolve-pvp-battle/index.ts computeSwing) — usada
// aqui só pra PRÉ-VISUALIZAR quanto o jogador ganha/perde antes de
// escolher um oponente na janela de "Combate" (ver
// pickRandomPvpOpponents/previewPvpAttackSwing). O valor real é sempre
// recalculado no servidor no momento do ataque; se a posição de alguém
// mudou entre a prévia e o clique em "Atacar", o número real pode diferir
// um pouco — mesmo espírito de qualquer outra prévia de jogo.
const SWING_MIN = 3;
const SWING_MID = 5;
const SWING_MAX = 10;

/// Quanto EU (na posição myPosition) ganho vencendo ou perco perdendo
/// contra alguém na posição opponentPosition, dentro de um grupo/tier com
/// groupSize entradas (jogadores + bots visíveis) — mesma fórmula
/// (distância de posição normalizada) da Edge Function, só que calculada
/// aqui pra não precisar de uma ida ao servidor só pra mostrar a prévia.
export function previewPvpAttackSwing(myPosition, opponentPosition, groupSize) {
  const gap = Math.abs(myPosition - opponentPosition);
  const normalizedGap = groupSize > 1 ? Math.min(1, gap / (groupSize - 1)) : 0;
  const iAmFavored = myPosition < opponentPosition;

  const favoredWinGain = Math.round(SWING_MID - (SWING_MID - SWING_MIN) * normalizedGap);
  const favoredLossPenalty = Math.round(SWING_MID + (SWING_MAX - SWING_MID) * normalizedGap);
  const underdogWinGain = Math.round(SWING_MID + (SWING_MAX - SWING_MID) * normalizedGap);
  const underdogLossPenalty = Math.round(SWING_MID - (SWING_MID - SWING_MIN) * normalizedGap);

  return {
    winDelta: iAmFavored ? favoredWinGain : underdogWinGain,
    lossDelta: iAmFavored ? -favoredLossPenalty : -underdogLossPenalty,
  };
}

// Raio pedido pelo usuário: "5 jogadores entre o rank 35 e 65" pra quem
// está no 50 — ±15 posições ao redor de quem vai atacar.
export const PVP_COMBAT_OPPONENT_RADIUS = 15;
export const PVP_COMBAT_OPPONENT_COUNT = 5;

/// Sorteia até PVP_COMBAT_OPPONENT_COUNT oponentes (jogadores OU bots, os
/// 2 contam) dentro de ±PVP_COMBAT_OPPONENT_RADIUS posições de myPosition
/// no board já carregado — é isso que alimenta a janela de "Combate" (ver
/// js/ui/render.js showPvpCombatPickerModal). Se a vizinhança tiver menos
/// candidatos que o pedido (tier/grupo pequeno), devolve só os que existem.
export function pickRandomPvpOpponents(board, myEntityId, myPosition) {
  const pool = board.filter((row) => {
    if (!row.is_bot && row.entity_id === myEntityId) return false;
    return Math.abs(row.position - myPosition) <= PVP_COMBAT_OPPONENT_RADIUS;
  });
  const picked = [];
  while (pool.length && picked.length < PVP_COMBAT_OPPONENT_COUNT) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/// Ataca outro jogador OU um bot — a luta em si roda inteira na Edge
/// Function (ver supabase/functions/resolve-pvp-battle), o cliente só
/// manda quem quer atacar e recebe o resultado pronto. Retorna o JSON de
/// resultado, ou { error } se recusado (ex: sem entradas — ver
/// retryAfterMs).
export async function attackOpponent(defenderId, isBot) {
  const supabase = getClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { error: 'not_signed_in' };

  const { data, error } = await supabase.functions.invoke('resolve-pvp-battle', {
    body: { defenderId, isBot: !!isBot },
  });
  if (error) {
    // supabase-js embrulha erros HTTP não-2xx aqui — o corpo JSON de erro
    // (ex: { error: 'no_entries', retryAfterMs }) já veio no `context`
    // quando é um FunctionsHttpError; cai pra uma mensagem genérica senão.
    const detail = error.context?.body ? await tryParseJson(error.context.body) : null;
    return { error: detail?.error || error.message || 'unknown_error', retryAfterMs: detail?.retryAfterMs };
  }
  return data;
}

async function tryParseJson(body) {
  try {
    if (typeof body === 'string') return JSON.parse(body);
    if (body?.text) return JSON.parse(await body.text());
  } catch {
    // corpo não era JSON — ignora, chamador já cai no fallback genérico.
  }
  return null;
}

// ---------------------------------------------------------------
// Página "Ranks" (menu Outros) — 3 rankeamentos GLOBAIS, cruzando todos os
// tiers/grupos (ver supabase/migrations/0008_pvp_ranks.sql). Cada RPC já
// devolve o top 100 + a própria linha do jogador (com a posição real)
// caso ele não esteja entre os 100 — por isso todos precisam do próprio
// id como viewer_id.
// ---------------------------------------------------------------

async function fetchPvpRank(rpcName) {
  const userId = await ensureSignedIn();
  if (!userId) return [];
  const { data, error } = await getClient().rpc(rpcName, { viewer_id: userId });
  if (error) {
    console.warn(`Arena PvP: falha ao buscar ${rpcName}:`, error.message);
    return [];
  }
  return data || [];
}

export const fetchArenaRank = () => fetchPvpRank('pvp_rank_arena');
export const fetchLevelRank = () => fetchPvpRank('pvp_rank_level');
export const fetchTranscendRank = () => fetchPvpRank('pvp_rank_transcend');
export const fetchPowerRank = () => fetchPvpRank('pvp_rank_power');

// ---------------------------------------------------------------
// Recompensas automáticas da Arena — diária (por grupo) e semanal (por
// tier inteiro), ver supabase/migrations/0011_pvp_daily_weekly_rewards.sql
// pras curvas de verdade (essas tabelas aqui são um espelho EXATO, só pra
// pré-visualizar "quanto você ganha se terminar assim" na UI sem precisar
// de uma ida ao servidor — quem de fato manda a recompensa pro Correio é
// sempre o cron no servidor, isso aqui nunca concede nada sozinho).
// ---------------------------------------------------------------

const DAILY_ARENA_REWARD_CURVE = {
  bronze: { best: 20, worst: 10 },
  prata: { best: 28, worst: 14 },
  ouro: { best: 40, worst: 20 },
  platina: { best: 56, worst: 28 },
  diamante: { best: 80, worst: 40 },
};
const LEGENDARY_DAILY_BEST = 100;
const LEGENDARY_DAILY_WORST = 70;

/// Prévia da recompensa diária (fragmento de carta + de mascote, mesma
/// quantidade dos 2) pra uma linha do tier_board — real_rank/
/// real_player_count vêm da RPC pvp_tier_board (só jogadores de verdade,
/// bots não contam nem entram na conta). Retorna null se a linha não vai
/// ganhar nada (fora da metade de cima, exceto Lendário que sempre ganha).
export function previewDailyArenaReward(tier, realRank, realPlayerCount) {
  if (!realRank || !realPlayerCount) return null;
  if (tier === 'lendario') {
    const amount = realPlayerCount <= 1
      ? LEGENDARY_DAILY_BEST
      : Math.round(LEGENDARY_DAILY_BEST - (LEGENDARY_DAILY_BEST - LEGENDARY_DAILY_WORST) * (realRank - 1) / (realPlayerCount - 1));
    return { cardFragment: amount, petFragment: amount };
  }
  const curve = DAILY_ARENA_REWARD_CURVE[tier];
  if (!curve) return null;
  const cutoff = Math.max(1, Math.ceil(realPlayerCount / 2));
  if (realRank > cutoff) return null;
  const amount = cutoff <= 1 ? curve.best : Math.round(curve.best - (curve.best - curve.worst) * (realRank - 1) / (cutoff - 1));
  return { cardFragment: amount, petFragment: amount };
}

const WEEKLY_ARENA_REWARD_CURVE = {
  bronze: { kind: 'card_fragment', best1: 100, worst1: 50, bestEggs: 60, worstEggs: 30 },
  prata: { kind: 'card_fragment', best1: 174, worst1: 87, bestEggs: 100, worstEggs: 50 },
  ouro: { kind: 'card_fragment', best1: 300, worst1: 150, bestEggs: 170, worstEggs: 85 },
  platina: { kind: 'random_card', best1: 1, worst1: 1, bestEggs: 226, worstEggs: 113 },
  diamante: { kind: 'random_card', best1: 1, worst1: 1, bestEggs: 302, worstEggs: 151 },
  lendario: { kind: 'random_card', best1: 1, worst1: 1, bestEggs: 400, worstEggs: 200 },
};

/// Prévia da recompensa semanal (carta/fragmento + ovos) pra uma linha do
/// rank de Arena (ver pvp_rank_arena) — tierPosition/tierPlayerCount são a
/// posição do jogador DENTRO do próprio tier inteiro (ignora grupo, é
/// assim que o reset semanal de verdade decide). Retorna null se fora da
/// metade de cima do tier.
export function previewWeeklyArenaReward(tier, tierPosition, tierPlayerCount) {
  const curve = WEEKLY_ARENA_REWARD_CURVE[tier];
  if (!curve || !tierPosition || !tierPlayerCount) return null;
  const cutoff = Math.max(1, Math.ceil(tierPlayerCount / 2));
  if (tierPosition > cutoff) return null;
  const lerp = (best, worst) => (cutoff <= 1 ? best : Math.round(best - (best - worst) * (tierPosition - 1) / (cutoff - 1)));
  return { kind: curve.kind, amount: lerp(curve.best1, curve.worst1), eggs: lerp(curve.bestEggs, curve.worstEggs) };
}

// ---------------------------------------------------------------
// Contadores regressivos — mesma conta de sempre pros crons (Brasília não
// tem mais horário de verão desde 2019, sempre UTC-3): diário reseta
// 00:00 UTC = 21h de Brasília todo dia; semanal reseta domingo 00:00 UTC
// = sábado 21h de Brasília.
// ---------------------------------------------------------------

export function msUntilNextDailyArenaReset(now = Date.now()) {
  const d = new Date(now);
  const todayReset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  const target = todayReset > now ? todayReset : todayReset + 24 * 60 * 60 * 1000;
  return target - now;
}

export function msUntilNextWeeklyArenaReset(now = Date.now()) {
  const d = new Date(now);
  const daysUntilSunday = (7 - d.getUTCDay()) % 7;
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilSunday, 0, 0, 0, 0);
  const target = base > now ? base : base + 7 * 24 * 60 * 60 * 1000;
  return target - now;
}
