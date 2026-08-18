// Arena PvP (assíncrona) — resolve UM ataque no servidor.
//
// Por que isso precisa ser uma Edge Function (e não lógica no cliente):
// o resultado de uma luta PvP não pode depender de números que o cliente
// que está atacando informa na hora — ele poderia simplesmente mandar
// "meu DPS é 999999999" e vencer sempre. Em vez disso, o cliente só manda
// QUEM ele quer atacar; esta função busca os snapshots de stats dos DOIS
// jogadores já salvos no banco (o do atacante foi salvo da última vez que
// ele sincronizou, ver js/systems/pvp.js syncProfile) e roda a simulação
// aqui, com a service_role key (que ignora RLS) — só esta função tem
// permissão de escrever em pvp_matches e de atualizar rating (ver
// supabase/migrations/0001_pvp_arena.sql).
//
// Deploy: supabase functions deploy resolve-pvp-battle
// (ou cole o conteúdo no editor de Edge Functions do painel Supabase)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ARMOR_CONSTANT = 100; // mesma fórmula de js/systems/combat.js armorReduction
const ATTACK_COOLDOWN_MS = 60_000; // 1 min entre ataques (por atacante)
const ELO_K_FACTOR = 32;
const GOLD_REWARD_BASE = 50;
const GOLD_REWARD_PER_RATING = 0.05; // um pouco mais de ouro atacando alvos mais fortes

function armorReduction(armor: number): number {
  return armor / (armor + ARMOR_CONSTANT);
}

/// DPS "esperado" de A contra B: crítico e esquiva são eventos
/// probabilísticos no combate ao vivo (ver resolveHit/rollDodge em
/// js/systems/combat.js), mas aqui usamos o valor esperado direto em vez
/// de rolar dado — dá o mesmo resultado em média, sem depender de nenhum
/// RNG que uma das partes pudesse alegar ter sido "injusto".
function effectiveDps(attacker: Snapshot, defender: Snapshot): number {
  const critMultiplier = 1 + (attacker.crit_chance / 100) * (attacker.crit_damage / 100);
  const dodgeMultiplier = 1 - Math.min(0.95, defender.dodge_chance / 100);
  const armorMultiplier = 1 - armorReduction(defender.armor);
  return Math.max(0, attacker.dps * critMultiplier * dodgeMultiplier * armorMultiplier);
}

interface Snapshot {
  dps: number;
  max_hp: number;
  armor: number;
  crit_chance: number;
  crit_damage: number;
  dodge_chance: number;
}

/// Tempo (segundos) que cada lado leva pra derrubar o outro, dado o DPS
/// efetivo de cada um (ver effectiveDps acima) — quem tem o menor tempo
/// "vence a corrida" primeiro. dpsToOpponent == 0 é tratado como "nunca
/// mata" (Infinity), não divisão por zero.
function timeToKill(hp: number, dps: number): number {
  return dps > 0 ? hp / dps : Infinity;
}

function eloExpectedScore(ratingSelf: number, ratingOpponent: number): number {
  return 1 / (1 + 10 ** ((ratingOpponent - ratingSelf) / 400));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Client "de serviço" (service_role, ignora RLS — só ele grava
  // pvp_matches/atualiza rating) e um client separado só pra descobrir
  // QUEM está chamando, a partir do JWT que o cliente já manda (o mesmo
  // token da sessão anônima do Supabase Auth).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const attackerId = userData.user.id;

  let body: { defenderId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400 });
  }
  const defenderId = body.defenderId;
  if (!defenderId || typeof defenderId !== 'string') {
    return new Response(JSON.stringify({ error: 'missing_defender_id' }), { status: 400 });
  }
  if (defenderId === attackerId) {
    return new Response(JSON.stringify({ error: 'cannot_attack_self' }), { status: 400 });
  }

  const [{ data: attackerProfile }, { data: defenderProfile }] = await Promise.all([
    supabaseAdmin.from('pvp_profiles').select('*').eq('id', attackerId).maybeSingle(),
    supabaseAdmin.from('pvp_profiles').select('*').eq('id', defenderId).maybeSingle(),
  ]);
  if (!attackerProfile) {
    return new Response(JSON.stringify({ error: 'attacker_profile_not_found' }), { status: 404 });
  }
  if (!defenderProfile) {
    return new Response(JSON.stringify({ error: 'defender_profile_not_found' }), { status: 404 });
  }

  if (attackerProfile.last_attack_at) {
    const elapsed = Date.now() - new Date(attackerProfile.last_attack_at).getTime();
    if (elapsed < ATTACK_COOLDOWN_MS) {
      return new Response(
        JSON.stringify({ error: 'cooldown', retryAfterMs: ATTACK_COOLDOWN_MS - elapsed }),
        { status: 429 },
      );
    }
  }

  const [{ data: attackerSnap }, { data: defenderSnap }] = await Promise.all([
    supabaseAdmin.from('pvp_snapshots').select('*').eq('profile_id', attackerId).maybeSingle(),
    supabaseAdmin.from('pvp_snapshots').select('*').eq('profile_id', defenderId).maybeSingle(),
  ]);
  if (!attackerSnap || !defenderSnap) {
    return new Response(JSON.stringify({ error: 'snapshot_missing' }), { status: 409 });
  }

  const attackerTtk = timeToKill(defenderSnap.max_hp, effectiveDps(attackerSnap, defenderSnap));
  const defenderTtk = timeToKill(attackerSnap.max_hp, effectiveDps(defenderSnap, attackerSnap));
  // Empate genuíno (os 2 nunca se matam, ex: os 2 com 0 de DPS) vira
  // vitória do defensor — corresponde ao padrão comum de PvP assíncrono
  // ("o desafiante precisa vencer de forma clara pra levar a recompensa").
  const attackerWins = attackerTtk < defenderTtk;

  const attackerExpected = eloExpectedScore(attackerProfile.rating, defenderProfile.rating);
  const defenderExpected = 1 - attackerExpected;
  const attackerActual = attackerWins ? 1 : 0;
  const defenderActual = 1 - attackerActual;
  const attackerRatingAfter = Math.round(attackerProfile.rating + ELO_K_FACTOR * (attackerActual - attackerExpected));
  const defenderRatingAfter = Math.round(defenderProfile.rating + ELO_K_FACTOR * (defenderActual - defenderExpected));

  const goldReward = attackerWins
    ? Math.round(GOLD_REWARD_BASE + defenderProfile.rating * GOLD_REWARD_PER_RATING)
    : 0;

  const now = new Date().toISOString();
  const winnerId = attackerWins ? attackerId : defenderId;

  const [matchResult] = await Promise.all([
    supabaseAdmin.from('pvp_matches').insert({
      attacker_id: attackerId,
      defender_id: defenderId,
      winner_id: winnerId,
      attacker_rating_before: attackerProfile.rating,
      defender_rating_before: defenderProfile.rating,
      attacker_rating_after: attackerRatingAfter,
      defender_rating_after: defenderRatingAfter,
      gold_reward: goldReward,
    }),
    supabaseAdmin.from('pvp_profiles').update({
      rating: attackerRatingAfter,
      last_attack_at: now,
    }).eq('id', attackerId),
    supabaseAdmin.from('pvp_profiles').update({
      rating: defenderRatingAfter,
    }).eq('id', defenderId),
  ]);
  if (matchResult.error) {
    return new Response(JSON.stringify({ error: 'write_failed', detail: matchResult.error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    attackerWins,
    attackerRatingBefore: attackerProfile.rating,
    attackerRatingAfter,
    defenderRatingBefore: defenderProfile.rating,
    defenderRatingAfter,
    goldReward,
    defenderNick: defenderProfile.nick,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
