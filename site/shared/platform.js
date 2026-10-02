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
//   requestPasswordReset(email) / updatePassword(senha) → "Esqueci minha senha"
//   signInWithGoogle() / claimUsername(nome) → login com Google + escolha do nome
//   track(tipo, gameId, dados)      → estatística anônima (início/fim de partida)
//   isAdmin() / adminStats(dias) / adminApoios(dias) → painel do administrador
//   changeUsername / setAvatar / changePassword / deleteAccount → página de perfil
//   rankedIniciar() / rankedStatus() / ranking(periodo) → ranqueada da Carreira no Rift (elo em getUser().elo)
//
// Sem conta, tudo fica no localStorage do navegador. Ao entrar, o que foi
// jogado como visitante é enviado para a conta, e o save mais recente
// (local ou nuvem) vence.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { NOME_RE, problemaNoNome } from './nomes.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SAVE_PREFIX = 'site.save.';
const RESULTS_KEY = 'site.results';
const MAX_LOCAL_RESULTS = 200;
// Envio para a nuvem: no máximo 1 vez por minuto por jogo (o navegador
// salva na hora). Pico de 5 mil jogadores ≈ 80 gravações/s no servidor.
const PUSH_INTERVAL_MS = 60_000;
const URGENT_DELAY_MS = 1500;
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
// Estatísticas anônimas: um id aleatório por navegador (sem dado pessoal).
const DEVICE_KEY = 'site.device';
const VISIT_KEY = 'site.visit';
// Marca na URL de volta do e-mail de "Esqueci minha senha".
const RECOVERY_PARAM = 'nova-senha';

const listeners = new Set();
let clientPromise = null;
let injectedClient = null;
let initPromise = null;
let user = null; // { id, email, username, needsUsername?, suggestedUsername? }
let loggingIn = null;
let recovering = false; // entrou pelo link de redefinição: falta escolher a senha nova
const pushTimers = new Map();
const lastPushAt = new Map();
const retryDelay = new Map();

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

// Modo visitante quando: é a versão em arquivo único (sem acesso ao
// servidor) ou o Supabase ainda não foi configurado em config.js.
export const cloudEnabled = () => !globalThis.__SITE_OFFLINE && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Versão em arquivo único (fora do site): não há hub para onde voltar.
export const isStandalone = () => Boolean(globalThis.__SITE_OFFLINE);

export const getUser = () => user;
export const isRecovering = () => recovering;

// Só para testes automatizados: troca o cliente Supabase por um falso.
export function __setClientForTests(client) {
  pushTimers.forEach((t) => clearTimeout(t.id));
  pushTimers.clear();
  lastPushAt.clear();
  retryDelay.clear();
  injectedClient = client;
  clientPromise = null;
  initPromise = null;
  user = null;
}

function unavailable() {
  return new Error(cloudEnabled()
    ? 'Não foi possível falar com o servidor de contas. Verifique a internet e tente de novo.'
    : 'Login indisponível no momento. Seu progresso continua salvo neste navegador.');
}

async function getClient() {
  if (injectedClient) return injectedClient;
  if (!cloudEnabled()) return null;
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
      trackVisit();
      const wantsRecovery = consumeRecoveryMark();
      const { data } = await sb.auth.getSession();
      const sessionUser = data?.session?.user;
      if (sessionUser && !sessionUser.is_anonymous) await setUser(sb, sessionUser);
      else emit({ type: 'auth', user: null });
      if (wantsRecovery && user) startRecovery();
      else if (wantsRecovery) emit({ type: 'recovery-failed' }); // link vencido ou já usado

      sb.auth.onAuthStateChange((event, session) => {
        // Chamadas ao Supabase dentro deste callback podem travar; adia.
        setTimeout(() => {
          if (event === 'PASSWORD_RECOVERY') startRecovery();
          if (event === 'SIGNED_OUT' && user) handleSignedOut();
          else if (session?.user && !session.user.is_anonymous && session.user.id !== user?.id) setUser(sb, session.user);
        }, 0);
      });
      return user;
    })();
  }
  return initPromise;
}

// O link do e-mail volta com ?nova-senha=1 (e, no fluxo implícito, com
// type=recovery no #). Tira a marca da URL para um F5 não repetir o pedido.
function consumeRecoveryMark() {
  const loc = globalThis.location;
  if (!loc) return false;
  const url = new URL(loc.href);
  const marked = url.searchParams.has(RECOVERY_PARAM) || /type=recovery/.test(loc.hash);
  if (url.searchParams.has(RECOVERY_PARAM)) {
    url.searchParams.delete(RECOVERY_PARAM);
    globalThis.history?.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return marked;
}

function startRecovery() {
  if (recovering) return;
  recovering = true;
  emit({ type: 'recovery' });
}

async function setUser(sb, authUser) {
  if (loggingIn) return loggingIn;
  loggingIn = (async () => {
    let { data: profile, error } = await sb.from('site_profiles')
      .select('username, avatar, username_changed_at, created_at').eq('id', authUser.id).maybeSingle();
    // Banco ainda sem as colunas do perfil (0005_perfil.sql não aplicado).
    if (error) ({ data: profile } = await sb.from('site_profiles').select('username').eq('id', authUser.id).maybeSingle());
    // Apoio ao site (banco sem 0008_apoio.sql: sem apoio).
    const { data: apoio } = await sb.from('site_profiles').select('apoio_total').eq('id', authUser.id).maybeSingle();
    // Elo da ranqueada (null = ainda não jogou ou banco sem 0006_ranqueada.sql).
    const { data: rank } = await sb.from('site_ranked').select('elo').eq('user_id', authUser.id).maybeSingle();
    const meta = authUser.user_metadata || {};
    const app = authUser.app_metadata || {};
    user = {
      id: authUser.id,
      email: authUser.email,
      username: profile?.username || meta.username || (authUser.email || 'jogador').split('@')[0],
      avatar: profile?.avatar || null,
      usernameChangedAt: profile?.username_changed_at || null,
      createdAt: profile?.created_at || authUser.created_at || null,
      elo: rank?.elo || null,
      apoioTotal: Number(apoio?.apoio_total || 0),
      // Como a conta entra: 'email' (senha) e/ou 'google'.
      providers: app.providers || (app.provider ? [app.provider] : ['email']),
    };
    // Entrou pelo Google (ou outro login sem nome de usuário): falta escolher.
    if (!profile && !meta.username) {
      user.needsUsername = true;
      user.suggestedUsername = suggestUsername(meta.full_name || meta.name || authUser.email);
    }
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

// "Kadu Silva" → "KaduSilva"; "joão.p@x.com" → "joao.p". Só uma sugestão.
function suggestUsername(source) {
  const base = String(source || '').split('@')[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_.]/g, '')
    .slice(0, 20);
  return base.length >= 3 ? base : '';
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
  [/should be different from the old password|same_password/i, 'A nova senha precisa ser diferente da atual.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/username_taken/i, 'Esse nome de usuário já está em uso.'],
  [/invalid_username/i, 'O nome de usuário precisa ter de 3 a 20 letras, números, "_" ou ".".'],
  [/already_has_username/i, 'Sua conta já tem um nome de usuário.'],
  [/username_blocked|database error saving new user/i, 'Esse nome de usuário não é permitido. Escolha outro.'],
  [/username_cooldown/i, 'Você trocou de nome há pouco. Dá para trocar de novo 2 dias depois da última troca.'],
  [/invalid_avatar/i, 'Esse ícone não está disponível.'],
  [/provider is not enabled|unsupported provider/i, 'O login com Google ainda não está disponível.'],
  [/rate limit|too many/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
  [/invalid.*email|email.*invalid/i, 'Esse e-mail não parece válido.'],
  [/fetch|network/i, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'],
];

function friendly(error) {
  const msg = error?.message || String(error);
  const hit = ERRORS.find(([re]) => re.test(msg));
  return new Error(hit ? hit[1] : `Não foi possível concluir (${msg}).`);
}

export const USERNAME_RE = NOME_RE;

export async function signUp({ email, password, username }) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  const problema = problemaNoNome(username);
  if (problema) throw new Error(problema);
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

// Leva para a tela do Google; na volta, o Supabase lê a sessão da URL e o
// onAuthStateChange em init() conecta a conta.
export async function signInWithGoogle() {
  const sb = await getClient();
  if (!sb) throw unavailable();
  let redirectTo;
  if (globalThis.location) {
    const back = new URL(globalThis.location.href);
    back.hash = '';
    redirectTo = back.toString();
  }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw friendly(error);
}

// Primeiro login pelo Google: grava o nome de usuário escolhido.
export async function claimUsername(username) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const name = String(username || '').trim();
  const problema = problemaNoNome(name);
  if (problema) throw new Error(problema);
  const { error } = await sb.rpc('site_claim_username', { name });
  if (error) throw friendly(error);
  user = { ...user, username: name, needsUsername: undefined, suggestedUsername: undefined };
  emit({ type: 'auth', user });
  return user;
}

// Envia o e-mail com o link para criar uma senha nova. Por segurança, o
// Supabase responde igual exista ou não uma conta com esse e-mail.
export async function requestPasswordReset(email) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  let redirectTo;
  if (globalThis.location) {
    const back = new URL(globalThis.location.href);
    back.hash = '';
    back.searchParams.set(RECOVERY_PARAM, '1');
    redirectTo = back.toString();
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw friendly(error);
}

export async function updatePassword(password) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  if (!password || password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw friendly(error);
  recovering = false;
}

// ------------------------------------------------------------------ perfil

// Troca o nome de usuário (no máximo 1 vez a cada 2 dias; o banco confere).
export async function changeUsername(username) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const name = String(username || '').trim();
  const problema = problemaNoNome(name);
  if (problema) throw new Error(problema);
  const proxima = nextUsernameChange();
  if (proxima && name.toLowerCase() !== user.username.toLowerCase()) {
    throw new Error(`Você trocou de nome há pouco. Falta${tempoAte(proxima).startsWith('1 ') ? '' : 'm'} ${tempoAte(proxima)} para poder trocar de novo.`);
  }
  const { error } = await sb.rpc('site_change_username', { name });
  if (error) throw friendly(error);
  const trocou = name.toLowerCase() !== user.username.toLowerCase();
  user = { ...user, username: name, usernameChangedAt: trocou ? new Date().toISOString() : user.usernameChangedAt };
  emit({ type: 'auth', user });
  return user;
}

// Próxima data em que o nome pode ser trocado (null = já pode).
export function nextUsernameChange() {
  if (!user?.usernameChangedAt) return null;
  const at = new Date(user.usernameChangedAt).getTime() + TROCA_NOME_DIAS * 864e5;
  return at > Date.now() ? new Date(at) : null;
}

export const TROCA_NOME_DIAS = 2;

// "1 dia e 5 horas", "3 horas e 20 minutos", "12 minutos".
export function tempoAte(data) {
  const min = Math.max(1, Math.ceil((data.getTime() - Date.now()) / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const parte = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  if (d) return h ? `${parte(d, 'dia', 'dias')} e ${parte(h, 'hora', 'horas')}` : parte(d, 'dia', 'dias');
  if (h) return m ? `${parte(h, 'hora', 'horas')} e ${parte(m, 'minuto', 'minutos')}` : parte(h, 'hora', 'horas');
  return parte(m, 'minuto', 'minutos');
}

export async function setAvatar(avatar) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { error } = await sb.rpc('site_set_avatar', { icone: avatar });
  if (error) throw friendly(error);
  user = { ...user, avatar };
  emit({ type: 'auth', user });
  return user;
}

// Conta com senha: confere a senha atual antes de trocar. Conta só do
// Google: cria uma senha (passa a poder entrar também com e-mail e senha).
export async function changePassword({ current = '', password }) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  if (!password || password.length < 6) throw new Error('A senha nova precisa ter pelo menos 6 caracteres.');
  if (user.providers.includes('email')) {
    if (!current) throw new Error('Digite a sua senha atual.');
    const { error: authError } = await sb.auth.signInWithPassword({ email: user.email, password: current });
    if (authError) throw new Error('A senha atual está incorreta.');
  }
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw friendly(error);
  if (!user.providers.includes('email')) user = { ...user, providers: [...user.providers, 'email'] };
}

// Apaga a conta e tudo dela (perfil, saves e histórico).
export async function deleteAccount() {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { error } = await sb.rpc('site_delete_account');
  if (error) throw friendly(error);
  pushTimers.forEach((t) => clearTimeout(t.id));
  pushTimers.clear();
  await sb.auth.signOut().catch(() => {});
  if (user) handleSignedOut();
}

// ------------------------------------------------------------------ apoio

// Abre o pagamento do Mercado Pago (Edge Function apoio-criar) e devolve o
// link para onde mandar a pessoa.
export async function apoiar(valor) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { data, error } = await sb.functions.invoke('apoio-criar', { body: { valor } });
  if (!error && data?.url) return data;
  // Descobre o motivo (ajuda a configurar o Mercado Pago e as Edge Functions).
  let status = error?.context?.status || 0;
  let corpo = data || {};
  try { if (error?.context?.json) corpo = await error.context.json(); } catch { /* sem corpo JSON */ }
  const codigo = corpo?.erro || '';
  const textoMp = String(corpo?.detalhe || '');
  const conhecidos = {
    valor_invalido: 'Escolha um valor entre R$ 5 e R$ 1.000.',
    nao_logado: 'Entre na sua conta para apoiar.',
    mp_nao_configurado: 'O apoio ainda não está disponível (falta o segredo MP_ACCESS_TOKEN nas Edge Functions).',
    banco: 'Erro no banco ao registrar o apoio (o 0008_apoio.sql foi rodado?).',
    mercadopago: `O Mercado Pago recusou criar o pagamento${/invalid.*token|unauthorized|401/i.test(textoMp) ? ' (Access Token inválido)' : ''}.`,
  };
  if (corpo?.detalhe) console.warn('Apoio: detalhe do erro:', corpo.detalhe);
  if (conhecidos[codigo]) throw new Error(conhecidos[codigo] + (corpo?.detalhe ? ` Detalhe: ${String(corpo.detalhe).slice(0, 160)}` : ''));
  if (status === 404) throw new Error('A função apoio-criar não foi encontrada no Supabase (o nome está certo?).');
  if (status === 401) throw new Error('O Supabase barrou a chamada: desligue a verificação de JWT ("Verify JWT") da função apoio-criar.');
  if (!status && /fetch|network|cors|failed to send/i.test(String(error?.message))) {
    throw new Error('Não foi possível falar com a função apoio-criar (ela foi publicada?).');
  }
  throw new Error(`Não foi possível abrir o pagamento agora (erro ${status || '?'}${codigo ? `, ${codigo}` : ''}). Tente de novo em instantes.`);
}

// Doações da própria conta (mais recentes primeiro).
export async function meusApoios() {
  const sb = await getClient();
  if (!sb || !user) return [];
  const { data, error } = await sb.from('site_apoios').select('id, valor, valor_pago, status, criado, atualizado')
    .eq('user_id', user.id).order('criado', { ascending: false }).limit(20);
  return error ? [] : data;
}

// Relê o total apoiado (depois de voltar do Mercado Pago).
export async function refreshApoio() {
  const sb = await getClient();
  if (!sb || !user) return user;
  const { data } = await sb.from('site_profiles').select('apoio_total').eq('id', user.id).maybeSingle();
  if (data) {
    user = { ...user, apoioTotal: Number(data.apoio_total || 0) };
    emit({ type: 'auth', user });
  }
  return user;
}

// Administrador: registra um apoio feito por fora (ex.: Pix direto).
export async function adminRegistrarApoio(nome, valor) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_registrar_apoio', { nome, quanto: valor });
  if (error) {
    if (/user_not_found/.test(error.message)) throw new Error('Não existe conta com esse nome de usuário.');
    throw new Error(/not_admin/.test(error.message) ? 'Esta conta não tem permissão para isso.' : friendly(error).message);
  }
  return data;
}

// ------------------------------------------------------------------ ranqueada

// Situação da conta na ranqueada (elo, partidas de hoje, ciclo atual).
// Também fecha os ciclos pendentes no banco.
// Começo de uma carreira ranqueável: o servidor anota o dia (horário de
// Brasília) e devolve um ingresso. Só valem as 3 primeiras carreiras
// começadas no dia, e só se terminarem no mesmo dia (ver 0010 e 0011).
// Sem conta, sem servidor ou com erro: null (a carreira não vale).
export async function rankedIniciar() {
  // Espera a sessão carregar: quem cria o jogador logo ao abrir a página não
  // pode ficar sem ingresso só porque a conta ainda não tinha sido lida.
  await init();
  const sb = await getClient();
  if (!sb || !user) return null;
  const { data, error } = await sb.rpc('site_ranked_iniciar');
  if (error || !data) {
    if (error) console.warn('Site: não deu para iniciar a ranqueada:', error.message);
    return null;
  }
  // token null: as 3 carreiras ranqueadas de hoje já foram começadas.
  return { token: data.token ?? null, dia: String(data.dia).slice(0, 10), numero: data.numero ?? null, restantes: data.restantes ?? null, limite: data.limite ?? null, banido: Boolean(data.banido) };
}

export async function rankedStatus() {
  const sb = await getClient();
  if (!sb || !user) return null;
  const { data, error } = await sb.rpc('site_ranked_meu');
  if (error) {
    console.warn('Site: ranqueada indisponível:', error.message);
    return null;
  }
  const elo = data.jogou ? data.elo : null;
  if (user && elo !== user.elo) {
    user = { ...user, elo };
    emit({ type: 'auth', user });
  }
  return data;
}

// Ranking público: 'diario', 'semanal' ou 'mensal'.
export async function ranking(periodo = 'diario') {
  await init();
  const sb = await getClient();
  if (!sb) throw unavailable();
  const { data, error } = await sb.rpc('site_ranking', { periodo });
  if (error) throw friendly(error);
  return data;
}

export async function signOut() {
  const sb = await getClient();
  await flushPushes();
  if (sb) await sb.auth.signOut();
  if (user) handleSignedOut();
}

// ------------------------------------------------------------------ estatísticas

function deviceId() {
  let id = readLS(DEVICE_KEY, null);
  if (!id) {
    id = newId();
    writeLS(DEVICE_KEY, id);
  }
  return id;
}

// Registra um evento anônimo para o painel. Nunca atrapalha o jogo: se
// falhar (sem internet, servidor fora), só avisa no console.
export async function track(kind, gameId = null, data = {}) {
  try {
    const sb = await getClient();
    if (!sb) return;
    const { error } = await sb.from('site_events').insert({ kind, game_id: gameId, device: deviceId(), data });
    if (error) console.warn('Site: estatística não enviada:', error.message);
  } catch (err) {
    console.warn('Site: estatística não enviada:', err);
  }
}

// Uma visita por navegador por dia (fuso de Brasília).
function trackVisit() {
  let today;
  try {
    today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  if (readLS(VISIT_KEY, null) === today) return;
  writeLS(VISIT_KEY, today);
  track('visit', null, { path: globalThis.location?.pathname || '' });
}

export async function isAdmin() {
  const sb = await getClient();
  if (!sb || !user) return false;
  const { data, error } = await sb.rpc('site_is_admin');
  return !error && data === true;
}

export async function adminStats(days = 30) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_stats', { days });
  if (error) throw new Error(/not_admin/.test(error.message) ? 'Esta conta não tem acesso ao painel.' : friendly(error).message);
  return data;
}

// Doações para o painel (só administradores; ver 0009_painel_apoio.sql).
export async function adminApoios(days = 30) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_apoios', { days });
  if (error) {
    if (/not_admin/.test(error.message)) throw new Error('Esta conta não tem acesso ao painel.');
    if (/site_admin_apoios/.test(error.message) || error.code === 'PGRST202') throw new Error('Rode o arquivo 0009_painel_apoio.sql no Supabase para ver as doações aqui.');
    throw friendly(error);
  }
  return data;
}

// Ranqueada no painel: carreiras com sinais de suspeita, anular partida e
// tirar/devolver jogador (só administradores; ver 0013_ranqueada_seguranca.sql).
function erroAdminRanked(error) {
  if (/not_admin/.test(error.message)) return new Error('Esta conta não tem permissão para isso.');
  if (/user_not_found/.test(error.message)) return new Error('Não existe conta com esse nome de usuário.');
  if (/site_admin_ranked/.test(error.message) || error.code === 'PGRST202') return new Error('Rode o arquivo 0013_ranqueada_seguranca.sql no Supabase para ver isto.');
  return friendly(error);
}
export async function adminRanked(days = 7) {
  const sb = await getClient();
  if (!sb) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_ranked', { days });
  if (error) throw erroAdminRanked(error);
  return data;
}
export async function adminAnularPartida(partida) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_ranked_anular', { partida });
  if (error) throw erroAdminRanked(error);
  return data;
}
export async function adminBanirRanked(nome, { motivo = null, banir = true } = {}) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { data, error } = await sb.rpc('site_admin_ranked_banir', { nome, motivo, banir });
  if (error) throw erroAdminRanked(error);
  return data;
}

// Zera a ranqueada (só administradores; ver 0007_ranqueada_pontos.sql).
export async function adminResetRanked(temporada = 1) {
  const sb = await getClient();
  if (!sb || !user) throw unavailable();
  const { data, error } = await sb.rpc('site_ranked_resetar', { nova_temporada: temporada });
  if (error) throw new Error(/not_admin/.test(error.message) ? 'Esta conta não tem permissão para isso.' : friendly(error).message);
  return data;
}

// ------------------------------------------------------------------ saves

export function loadLocalSave(gameId) {
  return readLS(SAVE_PREFIX + gameId, null)?.data ?? null;
}

// `urgent`: manda em ~1,5 s em vez de esperar a janela de 1 minuto
// (ex.: fim de carreira, que o jogador espera ver no histórico já).
export function writeSave(gameId, data, { urgent = false } = {}) {
  writeLS(SAVE_PREFIX + gameId, { data, updatedAt: new Date().toISOString(), synced: false });
  if (user) schedulePush(gameId, urgent ? URGENT_DELAY_MS : null);
}

export async function clearSave(gameId) {
  clearTimeout(pushTimers.get(gameId)?.id);
  pushTimers.delete(gameId);
  writeLS(SAVE_PREFIX + gameId, null);
  const sb = await getClient();
  if (sb && user) {
    const { error } = await sb.from('site_game_saves').delete().eq('user_id', user.id).eq('game_id', gameId);
    if (error) console.warn('Site: falha ao apagar save na nuvem:', error.message);
  }
}

// Agenda o envio. Sem `delay`, respeita o intervalo mínimo desde o último
// envio; um envio já agendado só é antecipado, nunca adiado. Na hora de
// enviar, lê o save mais recente do navegador.
function schedulePush(gameId, delay = null) {
  const since = Date.now() - (lastPushAt.get(gameId) || 0);
  const wait = delay ?? Math.max(URGENT_DELAY_MS, PUSH_INTERVAL_MS - since);
  const timer = pushTimers.get(gameId);
  if (timer && timer.due <= Date.now() + wait) return;
  clearTimeout(timer?.id);
  const id = setTimeout(() => {
    pushTimers.delete(gameId);
    pushSave(gameId);
  }, wait);
  pushTimers.set(gameId, { id, due: Date.now() + wait });
}

async function pushSave(gameId) {
  const sb = await getClient();
  const entry = readLS(SAVE_PREFIX + gameId, null);
  if (!sb || !user || !entry || entry.synced) return;
  lastPushAt.set(gameId, Date.now());
  const { error } = await sb.from('site_game_saves').upsert({
    user_id: user.id, game_id: gameId, data: entry.data, updated_at: entry.updatedAt,
  });
  if (error) {
    // Servidor ocupado ou sem internet: tenta de novo, esperando cada vez mais.
    const next = Math.min(RETRY_MAX_MS, (retryDelay.get(gameId) || RETRY_MIN_MS / 2) * 2);
    retryDelay.set(gameId, next);
    console.warn(`Site: falha ao salvar na nuvem (nova tentativa em ${Math.round(next / 1000)}s):`, error.message);
    schedulePush(gameId, next);
    return;
  }
  retryDelay.delete(gameId);
  const current = readLS(SAVE_PREFIX + gameId, null);
  if (current && current.updatedAt === entry.updatedAt) writeLS(SAVE_PREFIX + gameId, { ...current, synced: true });
}

// Envia na hora o que estiver esperando (ex.: ao sair da aba ou do site).
export async function flushPushes() {
  const ids = [...pushTimers.keys()];
  ids.forEach((id) => clearTimeout(pushTimers.get(id).id));
  pushTimers.clear();
  await Promise.all(ids.map(pushSave));
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPushes();
  });
  globalThis.addEventListener?.('pagehide', () => flushPushes());
  globalThis.addEventListener?.('online', () => flushPushes());
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
