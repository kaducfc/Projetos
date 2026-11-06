// Orquestrador diário dos 30 bots — 1 execução = 1 "dia" de progresso pra
// cada bot, usando o motor real de jogo (decide.mjs) e sincronizando com
// o Supabase de verdade (mesmo projeto/tabelas/Edge Function que o
// jogo usa no navegador — os bots aparecem na Arena/Ranks como jogadores
// reais). Chamado 1x por dia pelo workflow agendado (ver
// .github/workflows/bots-daily.yml).
//
// Estado de cada bot (save local + tokens de sessão do Supabase) fica em
// scripts/bots/state/bot-NN.json, commitado de volta no repo a cada
// execução — é isso que garante que a MESMA conta anônima seja reusada
// todo dia (ver ensureSignedIn em supabase.mjs), em vez de criar uma
// conta nova toda vez (exatamente o problema de duplicata que motivou
// essa automação a ser cuidadosa com isso).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newBotState, runOneDay } from './decide.mjs';
import { NARUTO_NAMES } from './names.mjs';
import * as sbReal from './supabase.mjs';
import { isVipActive } from '../../js/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, 'state');
export const BOT_COUNT = NARUTO_NAMES.length;

// Mesma dupla de constantes de PVP_COMBAT_OPPONENT_RADIUS/COUNT em
// js/systems/pvp.js — não dá pra importar aquele arquivo aqui (ele importa
// o supabase-js via esm.sh, que só existe em navegador), então duplicada
// só esses 2 números fixos.
const PVP_COMBAT_OPPONENT_RADIUS = 15;
const PVP_COMBAT_OPPONENT_COUNT = 5;

function botFile(i) {
  return path.join(STATE_DIR, `bot-${String(i).padStart(2, '0')}.json`);
}

export function loadBot(i) {
  const file = botFile(i);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return { index: i, name: NARUTO_NAMES[i], gameState: newBotState(), session: null, nickClaimed: false };
}

export function saveBot(i, bundle) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(botFile(i), JSON.stringify(bundle, null, 2));
}

function pickOpponents(board, myEntityId, myPosition) {
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

/// `sb` injetável só pra teste local sem rede (ver test do dry-run) —
/// produção sempre usa o supabase.mjs de verdade (sbReal).
export async function runBot(i, sb = sbReal) {
  const bundle = loadBot(i);
  const client = sb.makeClient();

  let userId, session;
  try {
    ({ userId, session } = await sb.ensureSignedIn(client, bundle.session));
  } catch (err) {
    console.error(`bot ${i} (${bundle.name}): falha no login, pulando essa execução — ${err.message}`);
    return null;
  }
  bundle.session = session;
  bundle.userId = userId;

  if (!bundle.nickClaimed) {
    const claim = await sb.claimNick(client, userId, bundle.name);
    if (claim.ok) {
      bundle.nickClaimed = true;
    } else {
      console.warn(`bot ${i} (${bundle.name}): não travou o nick ainda (${claim.taken ? 'já em uso' : claim.message}) — tenta de novo amanhã.`);
    }
  }

  const { state, stats, power } = runOneDay(bundle.gameState);
  bundle.gameState = state;

  const nickToSync = bundle.nickClaimed ? bundle.name : (state.playerName || 'Caçador');
  await sb.syncProfile(client, userId, state, { ...stats, power }, nickToSync, isVipActive(state));

  const myProfile = await sb.getMyProfile(client, userId);
  let attacksResolved = 0;
  if (myProfile) {
    const board = await sb.fetchTierBoard(client, myProfile.tier, myProfile.group_index);
    const myRow = board.find((r) => !r.is_bot && r.entity_id === userId);
    if (myRow) {
      const opponents = pickOpponents(board, userId, myRow.position);
      for (const opp of opponents) {
        const result = await sb.attackOpponent(client, opp.entity_id, opp.is_bot);
        if (result?.error) break; // sem entradas sobrando ou outro erro — para de tentar hoje
        attacksResolved += 1;
      }
    }
  }

  saveBot(i, bundle);
  const summary = {
    index: i, name: bundle.name, nickClaimed: bundle.nickClaimed,
    hunterLevel: state.hunterLevel, transcendCount: state.transcendCount,
    power: Math.round(power), vip: isVipActive(state), attacksResolved,
    tier: myProfile?.tier || null, rating: myProfile?.rating || null,
  };
  console.log(`bot ${i} (${bundle.name}): nível=${summary.hunterLevel} power=${summary.power} vip=${summary.vip} transcend=${summary.transcendCount} tier=${summary.tier}/${summary.rating} ataques=${attacksResolved}`);
  return summary;
}

async function main() {
  const results = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    // Sequencial de propósito (não Promise.all) — evita estourar rate
    // limit da Edge Function/Auth do Supabase com 30 logins/ataques
    // simultâneos de uma vez.
    // eslint-disable-next-line no-await-in-loop
    results.push(await runBot(i));
  }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${BOT_COUNT} bots processados com sucesso hoje.`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('bots: falha geral na execução diária:', err);
    process.exitCode = 1;
  });
}
