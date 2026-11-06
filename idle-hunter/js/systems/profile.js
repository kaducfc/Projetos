import {
  DEFAULT_PLAYER_NAME, MIN_PLAYER_NAME_LENGTH, MAX_PLAYER_NAME_LENGTH, NAME_CHANGE_COST,
  PLAYER_NAME_PATTERN, PROFILE_ICONS, DEFAULT_PROFILE_ICON_ID, getProfileIcon,
} from '../data/profile.js';

export function getPlayerName(state) {
  return state.playerName || DEFAULT_PLAYER_NAME;
}

/// A 1ª troca de nick é sempre grátis — só a partir da 2ª cobra
/// NAME_CHANGE_COST em Esmeralda (ver data/profile.js).
export function isFirstNameChangeFree(state) {
  return (state.nameChangesUsed || 0) === 0;
}

export function nameChangeCost(state) {
  return isFirstNameChangeFree(state) ? 0 : NAME_CHANGE_COST;
}

export function canAffordNameChange(state) {
  return isFirstNameChangeFree(state) || state.cash >= NAME_CHANGE_COST;
}

/// Formato (comprimento + charset) — não checa duplicidade, que depende do
/// Supabase (ver isNickAvailable em systems/pvp.js, assíncrono).
export function isValidPlayerName(rawName) {
  const trimmed = (rawName || '').trim();
  return trimmed.length >= MIN_PLAYER_NAME_LENGTH
    && trimmed.length <= MAX_PLAYER_NAME_LENGTH
    && PLAYER_NAME_PATTERN.test(trimmed);
}

/// Cobra a Esmeralda (se não for a 1ª troca) e só then aplica o nick novo —
/// nome inválido, sem saldo, ou igual ao nick atual (nada a trocar, não
/// cobra por não-mudança) tudo retorna false sem mexer em state.
export function setPlayerName(state, rawName) {
  const name = (rawName || '').trim();
  if (!isValidPlayerName(name)) return false;
  if (name === getPlayerName(state)) return false;
  if (!isFirstNameChangeFree(state) && state.cash < NAME_CHANGE_COST) return false;

  if (!isFirstNameChangeFree(state)) state.cash -= NAME_CHANGE_COST;
  state.playerName = name;
  state.nameChangesUsed = (state.nameChangesUsed || 0) + 1;
  return true;
}

export function getSelectedProfileIcon(state) {
  return getProfileIcon(state.profileIconId || DEFAULT_PROFILE_ICON_ID);
}

export function isProfileIconUnlocked(state, iconId) {
  return (state.unlockedProfileIconIds || [DEFAULT_PROFILE_ICON_ID]).includes(iconId);
}

export function selectProfileIcon(state, iconId) {
  if (!PROFILE_ICONS.some((i) => i.id === iconId)) return false;
  if (!isProfileIconUnlocked(state, iconId)) return false;
  state.profileIconId = iconId;
  return true;
}

// ---------------------------------------------------------------
// Som/Música: só o on/off persistido por enquanto (ver comentário em
// data/profile.js) — nenhum player de áudio de verdade ainda.
// ---------------------------------------------------------------

export function isSoundOn(state) {
  return !!(state.settings && state.settings.soundOn);
}

export function isMusicOn(state) {
  return !!(state.settings && state.settings.musicOn);
}

export function toggleSound(state) {
  state.settings = state.settings || {};
  state.settings.soundOn = !state.settings.soundOn;
  return state.settings.soundOn;
}

export function toggleMusic(state) {
  state.settings = state.settings || {};
  state.settings.musicOn = !state.settings.musicOn;
  return state.settings.musicOn;
}

// ---------------------------------------------------------------
// Idioma: 'pt' (padrão) ou 'en'. Ver js/i18n.js pra tradução de fato.
// ---------------------------------------------------------------

export function getLanguage(state) {
  return (state.settings && state.settings.language) || 'pt';
}

export function setLanguage(state, lang) {
  if (lang !== 'pt' && lang !== 'en') return getLanguage(state);
  state.settings = state.settings || {};
  state.settings.language = lang;
  return lang;
}
