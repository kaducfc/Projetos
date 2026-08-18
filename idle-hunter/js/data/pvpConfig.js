// Credenciais do projeto Supabase da Arena PvP — a URL e a "publishable/
// anon key" são feitas pra ficar expostas no cliente (é assim que todo
// app Supabase funciona); a proteção de verdade vem das políticas de RLS
// (ver supabase/migrations/0001_pvp_arena.sql) e da Edge Function que
// resolve as lutas com a service_role key, nunca exposta aqui (ver
// supabase/functions/resolve-pvp-battle/index.ts).
export const SUPABASE_URL = 'https://xkcvvcvyzobnojgkkngy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IpU7-k0nwnkQMxjBjjgNmA_TOkaIb_e';

// Metadados dos 6 tiers — espelham supabase/migrations/0002_pvp_tiers.sql
// (pvp_tiers), só pro CLIENTE não precisar de uma consulta a mais só pra
// saber nome/emoji/cor de exibição. A pontuação-base e a ordem têm que
// bater exatamente com o banco (ver run_weekly_pvp_reset lá).
export const PVP_TIERS = [
  { name: 'bronze', label: 'Bronze', emoji: '🥉', basePoints: 1000, hiddenScore: false },
  { name: 'prata', label: 'Prata', emoji: '🥈', basePoints: 1200, hiddenScore: false },
  { name: 'ouro', label: 'Ouro', emoji: '🥇', basePoints: 1400, hiddenScore: false },
  { name: 'platina', label: 'Platina', emoji: '💠', basePoints: 1600, hiddenScore: false },
  { name: 'diamante', label: 'Diamante', emoji: '💎', basePoints: 1800, hiddenScore: false },
  { name: 'lendario', label: 'Lendário', emoji: '👑', basePoints: 2000, hiddenScore: true },
];

export function getPvpTierInfo(tierName) {
  return PVP_TIERS.find((t) => t.name === tierName) || PVP_TIERS[0];
}

// Sistema de Entradas (energia): até 5 guardadas, +1 a cada 1h — espelha
// as mesmas constantes da Edge Function (MAX_ENTRIES/ENTRY_REGEN_MS em
// supabase/functions/resolve-pvp-battle/index.ts). Só usado aqui pro
// CLIENTE conseguir mostrar uma contagem regressiva ao vivo; quem de fato
// consome/recarrega uma entrada é sempre o servidor.
export const PVP_MAX_ENTRIES = 5;
export const PVP_ENTRY_REGEN_MS = 60 * 60 * 1000;
