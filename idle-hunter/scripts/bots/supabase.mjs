// Ponte com o Supabase real pros bots — mesmo projeto/tabelas/Edge
// Function que js/systems/pvp.js usa no navegador, só que reescrita pra
// rodar em Node puro (pvp.js importa o supabase-js via esm.sh, que só
// funciona em navegador; aqui usamos o pacote npm de verdade). Nenhuma
// regra de jogo mora aqui — só a fiação de rede (mesmas chamadas que o
// cliente do jogo já faz: upsert em pvp_profiles/pvp_snapshots, RPC
// pvp_tier_board, Edge Function resolve-pvp-battle).
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../js/data/pvpConfig.js';

export function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/// `session` (opcional): { access_token, refresh_token } persistidos de uma
/// execução anterior (ver state/*.json) — restaura a MESMA conta anônima em
/// vez de criar uma nova (é exatamente essa falta de persistência, do lado
/// do navegador de um jogador humano, que causou as contas duplicadas —
/// aqui a gente controla os tokens à mão pra nunca deixar isso acontecer
/// com os bots). Retorna { userId, session } com o par de tokens ATUAL
/// (rotacionado) pra ser salvo de volta no arquivo do bot.
export async function ensureSignedIn(client, session) {
  if (session?.access_token && session?.refresh_token) {
    const { data, error } = await client.auth.setSession(session);
    if (!error && data?.session?.user) {
      return { userId: data.session.user.id, session: extractTokens(data.session) };
    }
    console.warn('bot: sessão salva inválida/expirada, criando conta nova:', error?.message);
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data?.user) {
    throw new Error(`falha no login anônimo: ${error?.message || 'sem usuário'}`);
  }
  return { userId: data.user.id, session: extractTokens(data.session) };
}

function extractTokens(session) {
  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

/// Mesma regra de nick único do jogo (ver claimNick em js/systems/pvp.js +
/// 0025_pvp_profiles_nick_unique.sql) — 23505 = índice único do Postgres
/// recusou (outro perfil, bot ou jogador de verdade, já tem esse nick).
export async function claimNick(client, userId, nick) {
  const { error } = await client.from('pvp_profiles').upsert({
    id: userId, nick, updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, taken: error.code === '23505', message: error.message };
  return { ok: true };
}

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

/// Mesmo par de upserts de syncProfile (js/systems/pvp.js) — nick/ícone/
/// nível + stats de combate, exatamente o que qualquer jogador real manda.
export async function syncProfile(client, userId, state, stats, playerName, isVip) {
  const [{ error: profileError }, { error: snapshotError }] = await Promise.all([
    client.from('pvp_profiles').upsert({
      id: userId,
      nick: playerName,
      icon_id: state.profileIconId || 'hunter',
      hunter_level: state.hunterLevel || 1,
      transcend_count: state.transcendCount || 0,
      is_vip: !!isVip,
      equipped_snapshot: serializeEquippedSnapshot(state),
      updated_at: new Date().toISOString(),
    }),
    client.from('pvp_snapshots').upsert({
      profile_id: userId,
      dps: stats.dps,
      max_hp: stats.maxHp,
      armor: stats.armor,
      crit_chance: stats.critChance,
      crit_damage: stats.critDamage,
      dodge_chance: stats.dodgeChance,
      pet_dps: stats.petDps || 0,
      attack_speed_per_sec: stats.attackSpeedPerSec || 1,
      reflect_percent: stats.reflectChance || 0,
      power: stats.power || 0,
      updated_at: new Date().toISOString(),
    }),
  ]);
  if (profileError) console.warn('bot: falha ao sincronizar perfil:', profileError.message);
  if (snapshotError) console.warn('bot: falha ao sincronizar stats:', snapshotError.message);
  return !profileError && !snapshotError;
}

export async function getMyProfile(client, userId) {
  const { data, error } = await client.from('pvp_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('bot: falha ao buscar o próprio perfil:', error.message);
    return null;
  }
  return data;
}

export async function fetchTierBoard(client, tier, groupIndex) {
  const { data, error } = await client.rpc('pvp_tier_board', { target_tier: tier, target_group: groupIndex });
  if (error) {
    console.warn('bot: falha ao buscar o tier board:', error.message);
    return [];
  }
  return data || [];
}

/// Mesma Edge Function que resolve o ataque de um jogador real (ver
/// attackOpponent em js/systems/pvp.js) — a luta inteira roda no servidor,
/// o bot só manda quem quer atacar.
export async function attackOpponent(client, defenderId, isBot) {
  const { data, error } = await client.functions.invoke('resolve-pvp-battle', {
    body: { defenderId, isBot: !!isBot },
  });
  if (error) {
    let detail = null;
    try {
      const body = error.context?.body;
      if (body) detail = typeof body === 'string' ? JSON.parse(body) : body;
    } catch { /* corpo não era JSON, ignora */ }
    return { error: detail?.error || error.message || 'unknown_error' };
  }
  return data;
}
