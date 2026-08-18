// Credenciais do projeto Supabase da Arena PvP — a URL e a "publishable/
// anon key" são feitas pra ficar expostas no cliente (é assim que todo
// app Supabase funciona); a proteção de verdade vem das políticas de RLS
// (ver supabase/migrations/0001_pvp_arena.sql) e da Edge Function que
// resolve as lutas com a service_role key, nunca exposta aqui (ver
// supabase/functions/resolve-pvp-battle/index.ts).
export const SUPABASE_URL = 'https://xkcvvcvyzobnojgkkngy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IpU7-k0nwnkQMxjBjjgNmA_TOkaIb_e';
