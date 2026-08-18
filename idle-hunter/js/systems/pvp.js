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

let client = null;
function getClient() {
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
      updated_at: new Date().toISOString(),
    }),
  ]);
  if (profileError) console.warn('Arena PvP: falha ao sincronizar perfil:', profileError.message);
  if (snapshotError) console.warn('Arena PvP: falha ao sincronizar stats:', snapshotError.message);
  return !profileError && !snapshotError;
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

/// A "prancheta" de 1 tier inteiro — todo jogador de verdade daquele tier
/// + os bots ainda visíveis, já ordenados e numerados por posição (ver
/// pvp_tier_board em supabase/migrations/0002_pvp_tiers.sql). Serve tanto
/// de ranking quanto de lista de oponentes — não tem mais 2 buscas
/// separadas como na v1 (fetchLeaderboard/fetchOpponents): o tier JÁ é o
/// pool de matchmaking inteiro.
export async function fetchTierBoard(tier) {
  const { data, error } = await getClient().rpc('pvp_tier_board', { target_tier: tier });
  if (error) {
    console.warn('Arena PvP: falha ao buscar o tier:', error.message);
    return [];
  }
  return data || [];
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
