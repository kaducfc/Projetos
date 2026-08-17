// Nick + ícone de perfil (ver systems/profile.js) e as opções de Som/Música
// do menu de Perfil (ver ui/render.js profileModalHtml) — áudio ainda não
// está implementado de verdade (sem <audio>/Web Audio no jogo ainda), só o
// on/off persistido em state.settings pra já existir quando o sistema de
// som entrar.

export const DEFAULT_PLAYER_NAME = 'Caçador';
export const MIN_PLAYER_NAME_LENGTH = 3;
export const MAX_PLAYER_NAME_LENGTH = 16;

// Custo em Esmeralda de cada troca de nick a partir da 2ª (a 1ª é sempre
// grátis, ver systems/profile.js isFirstNameChangeFree).
export const NAME_CHANGE_COST = 20;

// Catálogo de ícones de perfil — hoje só o do Caçador (padrão, já
// desbloqueado pra todo mundo). Mais entradas aqui viram selecionáveis
// automaticamente assim que forem adicionadas a
// state.unlockedProfileIconIds (ver eventos/recompensas futuras) — a UI
// (profileModalHtml) já mostra qualquer ícone daqui, bloqueado com um
// cadeado até ser desbloqueado.
export const PROFILE_ICONS = [
  { id: 'hunter', name: 'Caçador', image: 'assets/ui/hero-life-icon.png' },
];

export const DEFAULT_PROFILE_ICON_ID = 'hunter';

export function getProfileIcon(iconId) {
  return PROFILE_ICONS.find((i) => i.id === iconId) || PROFILE_ICONS[0];
}
