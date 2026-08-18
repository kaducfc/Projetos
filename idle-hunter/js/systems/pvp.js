// Arena PvP (assíncrona) — cliente Supabase. Ver supabase/migrations/
// 0001_pvp_arena.sql pro schema e supabase/functions/resolve-pvp-battle
// pra lógica de resolução de luta (roda no servidor, nunca no cliente —
// ver o comentário lá em cima do porquê).
//
// Import via CDN (esm.sh), sem bundler — mesmo espírito "no-build-step"
// do resto do projeto (ver build-bundle.mjs). O @supabase/supabase-js já
// persiste a sessão sozinho em localStorage, então um refresh de página
// mantém o mesmo login anônimo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../data/pvpConfig.js';

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
/// contra ESSA cópia salva que qualquer outro jogador te ataca, então só
/// fica "desatualizada" até a próxima vez que o jogador abrir a aba Arena
/// PvP (ver renderPvpTab/syncProfile em main.js).
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

export async function fetchLeaderboard(limit = 20) {
  const { data, error } = await getClient()
    .from('pvp_profiles')
    .select('id, nick, icon_id, hunter_level, rating')
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('Arena PvP: falha ao buscar ranking:', error.message);
    return [];
  }
  return data || [];
}

/// Oponentes pra atacar: outros jogadores com rating parecido (janela de
/// ±100 ao redor do próprio), excluindo a própria conta — evita tanto
/// "bater sempre no mesmo peixe pequeno" quanto cair contra alguém muito
/// mais forte por azar do sorteio.
export async function fetchOpponents(selfRating, selfUserId, limit = 10) {
  const { data, error } = await getClient()
    .from('pvp_profiles')
    .select('id, nick, icon_id, hunter_level, rating')
    .neq('id', selfUserId)
    .gte('rating', selfRating - 100)
    .lte('rating', selfRating + 100)
    .limit(limit);
  if (error) {
    console.warn('Arena PvP: falha ao buscar oponentes:', error.message);
    return [];
  }
  return data || [];
}

/// Ataca outro jogador — a luta em si roda inteira na Edge Function (ver
/// supabase/functions/resolve-pvp-battle), o cliente só manda quem quer
/// atacar e recebe o resultado pronto. Retorna o JSON de resultado, ou
/// { error } se recusado (ex: cooldown ainda ativo — ver retryAfterMs).
export async function attackOpponent(defenderId) {
  const supabase = getClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { error: 'not_signed_in' };

  const { data, error } = await supabase.functions.invoke('resolve-pvp-battle', {
    body: { defenderId },
  });
  if (error) {
    // supabase-js embrulha erros HTTP não-2xx aqui — o corpo JSON de erro
    // (ex: { error: 'cooldown', retryAfterMs }) já veio no `context`
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
