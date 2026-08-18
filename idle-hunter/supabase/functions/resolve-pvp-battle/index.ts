// Arena PvP — resolve UM ataque no servidor (v2: tiers/rank, bots,
// sistema de entradas, pontuação por posição).
//
// Por que isso precisa ser uma Edge Function: o cliente nunca decide quem
// venceu nem quantos pontos mudam de mão — ele só manda "quero atacar X".
// Esta função busca os snapshots de stats dos dois lados já salvos no
// banco (o do atacante veio da última sincronização automática, ver
// js/systems/pvp.js syncProfile) e resolve tudo aqui, com a service_role
// key (ignora RLS) — só ela tem permissão de fato de gravar
// pvp_matches/mudar rating/tier/entradas (ver GRANTs em
// supabase/migrations/0002_pvp_tiers.sql).
//
// Deploy: cole este arquivo inteiro no editor de Edge Functions do painel
// Supabase, função "resolve-pvp-battle" (mesmo nome de antes — só o
// CONTEÚDO mudou).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ARMOR_CONSTANT = 100; // mesma fórmula de js/systems/combat.js armorReduction
const MAX_ENTRIES = 5;
const ENTRY_REGEN_MS = 60 * 60 * 1000; // +1 entrada a cada 1h

// Faixa de pontos por luta pedida pelo usuário: nunca menos que 3, nunca
// mais que 10. Quando as posições dos 2 jogadores no tier estão bem
// próximas, os 2 lados ficam perto de 5 (nem favorito nem azarão claro).
// Quanto mais distantes as posições, mais os extremos se separam: o
// favorito (melhor posição) ganha pouco vencendo e perde muito perdendo;
// o azarão (pior posição) ganha muito vencendo e perde pouco perdendo —
// ver computeSwing abaixo.
const MIN_SWING = 3;
const MID_SWING = 5;
const MAX_SWING = 10;
const GOLD_REWARD_BASE = 30;
const GOLD_REWARD_PER_RATING = 0.05; // um pouco mais de ouro atacando alvos mais fortes

// Teto de sanidade pras stats que o cliente reporta no snapshot — não é
// uma prova de anti-cheat de verdade (validar 100% exigiria o servidor
// recalcular as stats a partir do inventário/skills reais, fora do
// escopo por ora), só um freio contra alguém mandar um número absurdo
// direto pela API. Folgado o bastante pra nunca incomodar um jogador
// legítimo no fim de jogo atual.
const SANE_MAX = {
  dps: 5_000_000, max_hp: 20_000_000, armor: 500_000, crit_chance: 100, crit_damage: 2000,
  dodge_chance: 95, attack_speed_per_sec: 30,
};

// ---------------------------------------------------------------
// CORS: o navegador manda um preflight OPTIONS antes de qualquer POST
// "não simples" (com header Authorization, que o supabase-js sempre
// manda) — sem responder esse OPTIONS com os headers abaixo, o navegador
// bloqueia o POST de verdade ANTES dele nem chegar na função (é isso que
// causava "Não foi possível atacar agora" pro jogador: toda chamada
// aparecia como OPTIONS 405 nos logs, o POST real nunca rodava).
// ---------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function armorReduction(armor: number): number {
  return armor / (armor + ARMOR_CONSTANT);
}

interface Snapshot {
  dps: number;
  max_hp: number;
  armor: number;
  crit_chance: number;
  crit_damage: number;
  dodge_chance: number;
  pet_dps: number;
  attack_speed_per_sec: number;
}

function clampSnapshot(s: Snapshot): Snapshot {
  return {
    dps: Math.min(Math.max(0, s.dps), SANE_MAX.dps),
    max_hp: Math.min(Math.max(1, s.max_hp), SANE_MAX.max_hp),
    armor: Math.min(Math.max(0, s.armor), SANE_MAX.armor),
    crit_chance: Math.min(Math.max(0, s.crit_chance), SANE_MAX.crit_chance),
    crit_damage: Math.min(Math.max(0, s.crit_damage), SANE_MAX.crit_damage),
    dodge_chance: Math.min(Math.max(0, s.dodge_chance), SANE_MAX.dodge_chance),
    pet_dps: Math.min(Math.max(0, s.pet_dps || 0), SANE_MAX.dps),
    attack_speed_per_sec: Math.min(Math.max(0.05, s.attack_speed_per_sec || 1), SANE_MAX.attack_speed_per_sec),
  };
}

/// Fator de crítico/esquiva/armadura de A atacando B — o MESMO fator (valor
/// esperado, não RNG — ver resolveHit/rollDodge em js/systems/combat.js)
/// vale tanto pro dano do próprio caçador quanto do mascote (o mascote
/// crítica com a mesma chance/dano do caçador, ver resolvePetHit em
/// js/systems/combat.js), então dá pra escalar os 2 pelo mesmo número.
function combatMultiplier(attacker: Snapshot, defender: Snapshot): number {
  const critMultiplier = 1 + (attacker.crit_chance / 100) * (attacker.crit_damage / 100);
  const dodgeMultiplier = 1 - Math.min(0.95, defender.dodge_chance / 100);
  const armorMultiplier = 1 - armorReduction(defender.armor);
  return Math.max(0, critMultiplier * dodgeMultiplier * armorMultiplier);
}

/// DPS "esperado" de A contra B, já separado em dano do próprio caçador +
/// dano do mascote ativo (ver getBestEquippedPet em js/systems/pets.js) —
/// devolvido em 2 pedaços pra alimentar as estatísticas pós-combate
/// (ver pvpResultContentHtml em js/ui/render.js), mas o total é o que
/// decide quem vence (ver timeToKill mais abaixo).
function effectiveDpsBreakdown(attacker: Snapshot, defender: Snapshot) {
  const multiplier = combatMultiplier(attacker, defender);
  const character = attacker.dps * multiplier;
  const pet = attacker.pet_dps * multiplier;
  return { character, pet, total: character + pet };
}

function timeToKill(hp: number, dps: number): number {
  return dps > 0 ? hp / dps : Infinity;
}

/// Ganho/perda de pontos dos 2 lados, baseado na DISTÂNCIA DE POSIÇÃO no
/// tier (não na diferença de pontos crua) — ver a explicação do usuário:
/// perto = ~5 pra ambos; longe = favorito ganha pouco (3) ou perde muito
/// (10), azarão ganha muito (10) ou perde pouco (3). tierSize é quantas
/// entradas existem no tier_board (jogadores + bots visíveis) — usado só
/// pra normalizar "o que é longe" (gap grande num tier de 6 é bem mais
/// significativo que num de 200).
function computeSwing(attackerPosition: number, defenderPosition: number, tierSize: number) {
  const gap = Math.abs(attackerPosition - defenderPosition);
  const normalizedGap = tierSize > 1 ? Math.min(1, gap / (tierSize - 1)) : 0;

  // Posição MENOR = melhor colocado = favorito.
  const attackerIsFavored = attackerPosition < defenderPosition;

  const favoredWinGain = Math.round(MID_SWING - (MID_SWING - MIN_SWING) * normalizedGap);
  const favoredLossPenalty = Math.round(MID_SWING + (MAX_SWING - MID_SWING) * normalizedGap);
  const underdogWinGain = Math.round(MID_SWING + (MAX_SWING - MID_SWING) * normalizedGap);
  const underdogLossPenalty = Math.round(MID_SWING - (MID_SWING - MIN_SWING) * normalizedGap);

  return {
    attackerWinDelta: attackerIsFavored ? favoredWinGain : underdogWinGain,
    attackerLossDelta: attackerIsFavored ? -favoredLossPenalty : -underdogLossPenalty,
    defenderWinDelta: attackerIsFavored ? underdogWinGain : favoredWinGain,
    defenderLossDelta: attackerIsFavored ? -underdogLossPenalty : -favoredLossPenalty,
  };
}

/// Entradas disponíveis AGORA, projetando a regeneração (+1/hora) desde a
/// última vez que a linha foi atualizada — mesmo padrão de "energia" de
/// jogo mobile. Retorna também o novo timestamp-âncora (avança só pelos
/// ticks de fato consumidos, não pula pra "agora", pra não perder
/// progresso parcial rumo à próxima entrada).
function projectEntries(stored: number, updatedAt: string, now: number) {
  const elapsedMs = now - new Date(updatedAt).getTime();
  const regen = Math.max(0, Math.floor(elapsedMs / ENTRY_REGEN_MS));
  const current = Math.min(MAX_ENTRIES, stored + regen);
  const newAnchorMs = new Date(updatedAt).getTime() + regen * ENTRY_REGEN_MS;
  return { current, newAnchorIso: new Date(newAnchorMs).toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const attackerId = userData.user.id;

  let body: { defenderId?: string; isBot?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  const defenderId = body.defenderId;
  const defenderIsBot = body.isBot === true;
  if (!defenderId || typeof defenderId !== 'string') {
    return jsonResponse({ error: 'missing_defender_id' }, 400);
  }
  if (!defenderIsBot && defenderId === attackerId) {
    return jsonResponse({ error: 'cannot_attack_self' }, 400);
  }

  const { data: attackerProfile } = await supabaseAdmin
    .from('pvp_profiles').select('*').eq('id', attackerId).maybeSingle();
  if (!attackerProfile) {
    return jsonResponse({ error: 'attacker_profile_not_found' }, 404);
  }

  // Entradas: projeta a regeneração, recusa se não sobrou nenhuma.
  const now = Date.now();
  const { current: entriesNow, newAnchorIso } = projectEntries(
    attackerProfile.pvp_entries, attackerProfile.pvp_entries_updated_at, now,
  );
  if (entriesNow < 1) {
    const msUntilNext = ENTRY_REGEN_MS - (now - new Date(newAnchorIso).getTime());
    return jsonResponse({ error: 'no_entries', retryAfterMs: Math.max(0, msUntilNext) }, 429);
  }

  // Defensor: jogador de verdade OU bot — tabelas diferentes.
  let defenderNick: string;
  let defenderTier: string;
  let defenderRatingBefore: number;
  let defenderWinsBefore = 0;
  let defenderSnap: Snapshot | null;
  let defenderProfileForUpdate: { id: string } | null = null;

  if (defenderIsBot) {
    const { data: bot } = await supabaseAdmin.from('pvp_bots').select('*').eq('id', defenderId).maybeSingle();
    if (!bot) return jsonResponse({ error: 'defender_bot_not_found' }, 404);
    defenderNick = bot.nick;
    defenderTier = bot.tier;
    defenderRatingBefore = bot.rating;
    defenderSnap = clampSnapshot(bot as Snapshot);
  } else {
    const { data: defenderProfile } = await supabaseAdmin
      .from('pvp_profiles').select('*').eq('id', defenderId).maybeSingle();
    if (!defenderProfile) return jsonResponse({ error: 'defender_profile_not_found' }, 404);
    const { data: snap } = await supabaseAdmin
      .from('pvp_snapshots').select('*').eq('profile_id', defenderId).maybeSingle();
    if (!snap) return jsonResponse({ error: 'snapshot_missing' }, 409);
    defenderNick = defenderProfile.nick;
    defenderTier = defenderProfile.tier;
    defenderRatingBefore = defenderProfile.rating;
    defenderWinsBefore = defenderProfile.wins || 0;
    defenderSnap = clampSnapshot(snap as Snapshot);
    defenderProfileForUpdate = { id: defenderProfile.id };
  }

  if (defenderTier !== attackerProfile.tier) {
    return jsonResponse({ error: 'different_tier' }, 400);
  }

  const { data: attackerSnapRaw } = await supabaseAdmin
    .from('pvp_snapshots').select('*').eq('profile_id', attackerId).maybeSingle();
  if (!attackerSnapRaw) {
    return jsonResponse({ error: 'snapshot_missing' }, 409);
  }
  const attackerSnap = clampSnapshot(attackerSnapRaw as Snapshot);

  // Posição dos 2 no tier_board (ver pvp_tier_board em
  // supabase/migrations/0002_pvp_tiers.sql) — é ISSO, não a diferença de
  // pontos crua, que decide o tamanho do ganho/perda (ver computeSwing).
  const { data: board, error: boardError } = await supabaseAdmin.rpc('pvp_tier_board', {
    target_tier: attackerProfile.tier,
    target_group: attackerProfile.group_index,
  });
  if (boardError || !board) {
    return jsonResponse({ error: 'tier_board_failed' }, 500);
  }
  const attackerBoardRow = board.find((r: { entity_id: string; is_bot: boolean }) => r.entity_id === attackerId && !r.is_bot);
  const defenderBoardRow = board.find((r: { entity_id: string; is_bot: boolean }) =>
    r.entity_id === defenderId && r.is_bot === defenderIsBot);
  if (!attackerBoardRow || !defenderBoardRow) {
    // Bot que acabou de sumir da lista (jogador novo entrou no meio) ou
    // estado meio inconsistente — pede pro cliente tentar de novo com a
    // lista atualizada em vez de arriscar um cálculo com posição errada.
    return jsonResponse({ error: 'stale_opponent' }, 409);
  }

  // dps efetivo de cada lado contra o outro (caçador + mascote já
  // separados) — devolvido na resposta pro cliente animar a "barra de HP
  // descendo" na janela de batalha (ver js/ui/render.js showPvpBattleModal)
  // com os números REAIS da luta, e também pras estatísticas pós-combate
  // (dano causado, dano do mascote — ver pvpResultContentHtml).
  const attackerBreakdown = effectiveDpsBreakdown(attackerSnap, defenderSnap);
  const defenderBreakdown = effectiveDpsBreakdown(defenderSnap, attackerSnap);
  const attackerEffectiveDps = attackerBreakdown.total;
  const defenderEffectiveDps = defenderBreakdown.total;
  const attackerTtk = timeToKill(defenderSnap.max_hp, attackerEffectiveDps);
  const defenderTtk = timeToKill(attackerSnap.max_hp, defenderEffectiveDps);
  const attackerWins = attackerTtk < defenderTtk;

  // A luta acaba quando o lado perdedor chega a 0 de HP — é esse instante
  // (não um tempo fixo) que define quanto dano cada lado de fato causou.
  // Os 2 lados com 0 dps (nunca deveria acontecer de verdade, HP mínimo é
  // 1 — ver clampSnapshot) dariam Infinity; cai pra 0 dano nesse caso raro.
  const rawFightDuration = Math.min(attackerTtk, defenderTtk);
  const fightDurationSec = Number.isFinite(rawFightDuration) ? rawFightDuration : 0;
  const attackerDamageDealt = Math.round(attackerBreakdown.total * fightDurationSec);
  const attackerPetDamageDealt = Math.round(attackerBreakdown.pet * fightDurationSec);
  const defenderDamageDealt = Math.round(defenderBreakdown.total * fightDurationSec);
  const defenderPetDamageDealt = Math.round(defenderBreakdown.pet * fightDurationSec);

  // Golpes de cada lado durante a luta (mesmo relógio pro dano do caçador
  // e do mascote — ver resolvePetHit chamado junto de resolveHit em
  // js/main.js, os 2 sempre acontecem no mesmo tick) — usado só pra
  // converter % de crítico/esquiva em CONTAGEM de vezes que aconteceu
  // (valor esperado arredondado, não RNG, mesmo espírito do resto desta
  // função), pedido pelo usuário pras estatísticas pós-combate.
  const attackerHits = Math.round(fightDurationSec * attackerSnap.attack_speed_per_sec);
  const defenderHits = Math.round(fightDurationSec * defenderSnap.attack_speed_per_sec);
  const attackerCritCount = Math.round(attackerHits * (attackerSnap.crit_chance / 100));
  const defenderCritCount = Math.round(defenderHits * (defenderSnap.crit_chance / 100));
  // Esquivas do atacante = quantas vezes ele esquivou golpes do defensor
  // (dodge_chance é sempre "chance de EU esquivar", ver stats.js), então
  // usa os golpes do OUTRO lado.
  const attackerDodgeCount = Math.round(defenderHits * (attackerSnap.dodge_chance / 100));
  const defenderDodgeCount = Math.round(attackerHits * (defenderSnap.dodge_chance / 100));

  const swing = computeSwing(attackerBoardRow.position, defenderBoardRow.position, board.length);
  const attackerDelta = attackerWins ? swing.attackerWinDelta : swing.attackerLossDelta;
  const defenderDelta = attackerWins ? swing.defenderLossDelta : swing.defenderWinDelta;

  const attackerRatingAfter = attackerProfile.rating + attackerDelta;
  const defenderRatingAfter = defenderRatingBefore + defenderDelta;

  const goldReward = attackerWins ? Math.round(GOLD_REWARD_BASE + defenderRatingBefore * GOLD_REWARD_PER_RATING) : 0;
  const winnerEntityId = attackerWins ? attackerId : defenderId;

  const writes = [
    supabaseAdmin.from('pvp_matches').insert({
      attacker_id: attackerId,
      defender_id: defenderIsBot ? null : defenderId,
      defender_is_bot: defenderIsBot,
      defender_bot_id: defenderIsBot ? defenderId : null,
      winner_id: winnerEntityId,
      attacker_rating_before: attackerProfile.rating,
      defender_rating_before: defenderRatingBefore,
      attacker_rating_after: attackerRatingAfter,
      defender_rating_after: defenderRatingAfter,
      gold_reward: goldReward,
    }),
    supabaseAdmin.from('pvp_profiles').update({
      rating: attackerRatingAfter,
      pvp_entries: entriesNow - 1,
      pvp_entries_updated_at: newAnchorIso,
      last_attack_at: new Date().toISOString(),
      ...(attackerWins ? { wins: attackerProfile.wins + 1 } : {}),
    }).eq('id', attackerId),
  ];
  if (defenderProfileForUpdate) {
    writes.push(
      supabaseAdmin.from('pvp_profiles').update({
        rating: defenderRatingAfter,
        // Defensor só ganha "vitória" contada se ele de fato venceu (o
        // atacante perdeu) — bot nunca entra aqui, pvp_bots não guarda
        // histórico de vitórias.
        ...(!attackerWins ? { wins: defenderWinsBefore + 1 } : {}),
      }).eq('id', defenderProfileForUpdate.id),
    );
  }
  const results = await Promise.all(writes);
  const writeError = results.find((r) => r.error);
  if (writeError?.error) {
    return jsonResponse({ error: 'write_failed', detail: writeError.error.message }, 500);
  }

  // Recalcula a posição do atacante DEPOIS do rating novo já gravado —
  // essencial pro Lendário, que só mostra "subiu/desceu N posições", não
  // o número de pontos (ver hiddenScore abaixo). Custa 1 query a mais,
  // mas é o único jeito de saber a posição de verdade em vez de assumir
  // pelo sinal do delta de pontos (ganhar pontos nem sempre muda posição,
  // ex: já era o 1º do tier).
  const { data: boardAfter } = await supabaseAdmin.rpc('pvp_tier_board', {
    target_tier: attackerProfile.tier,
    target_group: attackerProfile.group_index,
  });
  const attackerBoardRowAfter = boardAfter?.find((r: { entity_id: string; is_bot: boolean }) => r.entity_id === attackerId && !r.is_bot);
  const attackerPositionAfter = attackerBoardRowAfter?.position ?? attackerBoardRow.position;
  // Positivo = subiu de posição (número de posição diminuiu).
  const attackerPositionDelta = attackerBoardRow.position - attackerPositionAfter;

  const tierHidesScore = attackerProfile.tier === 'lendario';

  return jsonResponse({
    attackerWins,
    tier: attackerProfile.tier,
    hiddenScore: tierHidesScore,
    // Tiers normais: mostra os pontos de verdade (attackerRatingBefore/
    // After). Lendário: omite os pontos, o cliente (ver
    // js/ui/render.js showPvpBattleResultModal) mostra só
    // attackerPositionDelta em verde (subiu) ou vermelho (desceu).
    attackerRatingBefore: tierHidesScore ? undefined : attackerProfile.rating,
    attackerRatingAfter: tierHidesScore ? undefined : attackerRatingAfter,
    attackerPositionBefore: attackerBoardRow.position,
    attackerPositionAfter,
    attackerPositionDelta,
    entriesRemaining: entriesNow - 1,
    goldReward,
    defenderNick,
    // Pra animar a barra de HP na janela de batalha (ver
    // js/ui/render.js showPvpBattleModal) — números reais, não decorativos.
    attackerEffectiveDps,
    defenderEffectiveDps,
    attackerMaxHp: attackerSnap.max_hp,
    defenderMaxHp: defenderSnap.max_hp,
    // Estatísticas pós-combate (ver pvpResultContentHtml em
    // js/ui/render.js), simétricas pros 2 lados — dano total já inclui a
    // fatia do mascote, attackerPetDamageDealt/defenderPetDamageDealt são
    // só a fatia dele. Crítico/esquiva vêm como CONTAGEM (quantas vezes
    // aconteceu na luta), não a % de chance crua.
    attackerDamageDealt,
    attackerPetDamageDealt,
    attackerCritCount,
    attackerDodgeCount,
    defenderDamageDealt,
    defenderPetDamageDealt,
    defenderCritCount,
    defenderDodgeCount,
  });
});
