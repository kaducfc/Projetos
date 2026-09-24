// SDK compartilhado do site: conta, progresso salvo e histórico de partidas.
//
// Todo jogo usa só estas funções:
//   init()                          → restaura a sessão (se houver)
//   loadLocalSave(gameId)           → progresso salvo neste aparelho (síncrono)
//   writeSave(gameId, data)         → salva o progresso (local na hora, nuvem logo depois)
//   clearSave(gameId)               → apaga o progresso (ex.: nova carreira)
//   recordResult(gameId, {score, summary}) → registra uma partida terminada
//   listResults({gameId, limit})    → histórico de partidas
//   onChange(fn)                    → avisa login/logout e saves vindos da nuvem
//
// Sem conta, tudo fica no localStorage do navegador. Ao entrar, o que foi
// jogado como visitante é enviado para a conta, e o save mais recente
// (local ou nuvem) vence.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SAVE_PREFIX = 'site.save.';
const RESULTS_KEY = 'site.results';
const MAX_LOCAL_RESULTS = 200;
const PUSH_DELAY_MS = 1500;

const listeners = new Set();
let clientPromise = null;
let injectedClient = null;
let initPromise = null;
let user = null; // { id, email, username }
let loggingIn = null;
const pushTimers = new Map();

// ------------------------------------------------------------------ utilidades

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function readLS(key, fallback) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  try {
    if (value == null) storage()?.removeItem(key);
    else storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Sem espaço ou storage bloqueado: o jogo segue sem salvar.
  }
}

function localSaveIds() {
  const ids = [];
  const st = storage();
  if (!st) return ids;
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (k && k.startsWith(SAVE_PREFIX)) ids.push(k.slice(SAVE_PREFIX.length));
  }
  return ids;
}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const time = (iso) => (iso ? Date.parse(iso) : 0);

function emit(evt) {
  listeners.forEach((fn) => {
    try { fn(evt); } catch (err) { console.error(err); }
  });
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Na versão publicada como arquivo único (sem acesso ao servidor) o site
// roda só em modo visitante.
export const cloudEnabled = () => !globalThis.__SITE_OFFLINE;

export const getUser = () => user;

// Só para testes automatizados: troca o cliente Supabase por um falso.
export function __setClientForTests(client) {
  injectedClient = client;
  clientPromise = null;
  initPromise = null;
  user = null;
}

function unavailable() {
  return new Error(cloudEnabled()
    ? 'Não foi possível falar com o servidor de contas. Verifique a internet e tente de novo.'
    : 'Login indisponível nesta versão. Jogue pelo site para salvar na nuvem.');
}

async function getClient() {
  if (injectedClient) return injectedClient;
  if (!cloudEnabled()) return null;
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // Chave própria para não misturar com a sessão anônima do Idle Hunter.
        auth: { storageKey: 'rift-arcade-auth', persistSession: true, autoRefreshToken: true },
      }))
      .catch((err) => {
        console.warn('Site: não foi possível carregar o Supabase:', err);
        clientPromise = null; // tenta de novo na próxima ação
        return null;
      });
  }
  return clientPromise;
}

// ------------------------------------------------------------------ sessão

export function init() {
  if (!initPromise) {
    initPromise = (async () => {
      const sb = await getClient();
      if (!sb) {
        emit({ type: 'auth', user: null });
        return null;
      }
      const { data } = await sb.auth.getSession();
      const sessionUser = data?.session?.user;
      if (sessionUser && !sessionUser.is_anonymous) await setUser(sb, sessionUser);
      else emit({ type: 'auth', user: null });

      sb.auth.onAuthStateChange((event, session) => {
        // Chamadas ao Supabase dentro deste callback podem travar; adia.
        setTimeout(() => {
          if (event === 'SIGNED_OUT' && user) handleSignedOut();
          else if (session?.user && !session.user.is_anonymous && session.user.id !== user?.id) setUser(sb, session.user);
        }, 0);
      });
      return user;
    })();
  }
  return initPromise;
}

async function setUser(sb, authUser) {
  if (loggingIn) return loggingIn;
  loggingIn = (async () => {
    const { data: profile } = await sb.from('site_profiles').select('username').eq('id', authUser.id).maybeSingle();
    user = {
      id: authUser.id,
      email: authUser.email,
      username: profile?.username || authUser.user_metadata?.username || (authUser.email || 'jogador').split('@')[0],
    };
    await syncAll(sb);
    emit({ type: 'auth', user });
    return user;
  })();
  try {
    return await loggingIn;
  } finally {
    loggingIn = null;
  }
}

function handleSignedOut() {
  user = null;
  // O que estava no aparelho pertencia à conta que saiu: limpa.
  localSaveIds().forEach((id) => writeLS(SAVE_PREFIX + id, null));
  writeLS(RESULTS_KEY, null);
  emit({ type: 'auth', user: null, cleared: true });
}

const ERRORS = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/already registered|already exists/i, 'Já existe uma conta com esse e-mail.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
  [/invalid.*email|email.*invalid/i, 'Esse e-mail não parece válido.'],
  [/fetch|network/i, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'],
];

function friendly(error) {
  const msg = error?.message || String(error);
  const hit = ERRORS.find(([re]) => re.test(msg));
  return new Error(hit ? hit[1] : `Não foi possível concluir (${msg}).`);
}

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;

export async function signUp({ email, password, username }) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  if (!USERNAME_RE.test(username)) throw new Error('O nome de usuário precisa ter de 3 a 20 letras, números, "_" ou ".".');
  const { data: free, error: rpcError } = await sb.rpc('site_username_available', { name: username });
  if (rpcError) throw friendly(rpcError);
  if (free === false) throw new Error('Esse nome de usuário já está em uso.');
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
  if (error) throw friendly(error);
  if (!data.session) return { needsConfirmation: true };
  await setUser(sb, data.user);
  return { needsConfirmation: false };
}

export async function signIn({ email, password }) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw friendly(error);
  await setUser(sb, data.user);
  return user;
}

export async function signOut() {
  const sb = await getClient();
  await flushPushes();
  if (sb) await sb.auth.signOut();
  if (user) handleSignedOut();
}

// ------------------------------------------------------------------ saves

export function loadLocalSave(gameId) {
  return readLS(SAVE_PREFIX + gameId, null)?.data ?? null;
}

export function writeSave(gameId, data) {
  writeLS(SAVE_PREFIX + gameId, { data, updatedAt: new Date().toISOString(), synced: false });
  if (user) schedulePush(gameId);
}

export async function clearSave(gameId) {
  clearTimeout(pushTimers.get(gameId));
  pushTimers.delete(gameId);
  writeLS(SAVE_PREFIX + gameId, null);
  const sb = await getClient();
  if (sb && user) {
    const { error } = await sb.from('site_game_saves').delete().eq('user_id', user.id).eq('game_id', gameId);
    if (error) console.warn('Site: falha ao apagar save na nuvem:', error.message);
  }
}

function schedulePush(gameId) {
  clearTimeout(pushTimers.get(gameId));
  pushTimers.set(gameId, setTimeout(() => {
    pushTimers.delete(gameId);
    pushSave(gameId);
  }, PUSH_DELAY_MS));
}

async function pushSave(gameId) {
  const sb = await getClient();
  const entry = readLS(SAVE_PREFIX + gameId, null);
  if (!sb || !user || !entry) return;
  const { error } = await sb.from('site_game_saves').upsert({
    user_id: user.id, game_id: gameId, data: entry.data, updated_at: entry.updatedAt,
  });
  if (error) {
    console.warn('Site: falha ao salvar na nuvem:', error.message);
    return;
  }
  const current = readLS(SAVE_PREFIX + gameId, null);
  if (current && current.updatedAt === entry.updatedAt) writeLS(SAVE_PREFIX + gameId, { ...current, synced: true });
}

// Envia o que estiver esperando (ex.: ao fechar a aba).
export async function flushPushes() {
  const ids = [...pushTimers.keys()];
  ids.forEach((id) => clearTimeout(pushTimers.get(id)));
  pushTimers.clear();
  await Promise.all(ids.map(pushSave));
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPushes();
  });
}

// Ao entrar: junta o que foi jogado como visitante com o que está na conta.
async function syncAll(sb) {
  await syncSaves(sb);
  await pushResults(sb);
}

async function syncSaves(sb) {
  const { data: rows, error } = await sb.from('site_game_saves').select('game_id, data, updated_at').eq('user_id', user.id);
  if (error) {
    console.warn('Site: falha ao ler saves da nuvem:', error.message);
    return;
  }
  const cloud = new Map((rows || []).map((r) => [r.game_id, r]));
  const ids = new Set([...cloud.keys(), ...localSaveIds()]);
  for (const id of ids) {
    const local = readLS(SAVE_PREFIX + id, null);
    const remote = cloud.get(id);
    if (local && (!remote || time(local.updatedAt) > time(remote.updated_at))) {
      await pushSave(id);
    } else if (remote && (!local || time(remote.updated_at) > time(local.updatedAt))) {
      writeLS(SAVE_PREFIX + id, { data: remote.data, updatedAt: remote.updated_at, synced: true });
      emit({ type: 'save', gameId: id, data: remote.data });
    }
  }
}

// ------------------------------------------------------------------ resultados

export async function recordResult(gameId, { score = null, summary = {} } = {}) {
  const entry = {
    clientId: newId(), gameId, score, summary, playedAt: new Date().toISOString(), synced: false,
  };
  const list = readLS(RESULTS_KEY, []);
  list.unshift(entry);
  writeLS(RESULTS_KEY, list.slice(0, MAX_LOCAL_RESULTS));
  const sb = await getClient();
  if (sb && user) await pushResults(sb);
  emit({ type: 'results', gameId });
  return entry;
}

async function pushResults(sb) {
  const list = readLS(RESULTS_KEY, []);
  const pending = list.filter((r) => !r.synced);
  if (!pending.length || !user) return;
  const { error } = await sb.from('site_game_results').upsert(
    pending.map((r) => ({
      user_id: user.id, game_id: r.gameId, score: r.score, summary: r.summary, played_at: r.playedAt, client_id: r.clientId,
    })),
    { onConflict: 'user_id,client_id', ignoreDuplicates: true },
  );
  if (error) {
    console.warn('Site: falha ao enviar partidas:', error.message);
    return;
  }
  const sent = new Set(pending.map((r) => r.clientId));
  writeLS(RESULTS_KEY, readLS(RESULTS_KEY, []).map((r) => (sent.has(r.clientId) ? { ...r, synced: true } : r)));
}

export async function listResults({ gameId = null, limit = 50 } = {}) {
  await init();
  const sb = await getClient();
  if (sb && user) {
    let q = sb.from('site_game_results')
      .select('game_id, score, summary, played_at, client_id')
      .eq('user_id', user.id);
    if (gameId) q = q.eq('game_id', gameId);
    const { data, error } = await q.order('played_at', { ascending: false }).limit(limit);
    if (!error) {
      return data.map((r) => ({
        gameId: r.game_id, score: r.score, summary: r.summary, playedAt: r.played_at, clientId: r.client_id,
      }));
    }
    console.warn('Site: falha ao ler histórico:', error.message);
  }
  return readLS(RESULTS_KEY, []).filter((r) => !gameId || r.gameId === gameId).slice(0, limit);
}
