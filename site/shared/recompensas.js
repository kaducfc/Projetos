// Recompensas de código (ícones exclusivos, efeitos no nome…): como cada uma
// aparece para o jogador. A arte e o efeito entram no site; o código só libera.
import { EXCLUSIVOS, EXCLUSIVOS_TESTE } from './avatar.js';
import { EFEITOS, EFEITOS_TESTE } from './efeitos.js';

const humano = (chave) => String(chave || '').replace(/^exc-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function nomeRecompensa(tipo, chave) {
  if (tipo === 'icone') return [...EXCLUSIVOS, ...EXCLUSIVOS_TESTE].find((i) => i.id === chave)?.nome || humano(chave);
  if (tipo === 'efeito') return [...EFEITOS, ...EFEITOS_TESTE].find((e) => e.id === chave)?.nome || humano(chave);
  return humano(chave);
}

export const tipoTexto = (tipo) => (tipo === 'icone' ? 'Ícone' : tipo === 'efeito' ? 'Efeito no nome' : 'Recompensa');

// "AA85E49665234D6A" → "AA85-E496-6523-4D6A" (só para mostrar).
export const codigoBonito = (c) => String(c || '').replace(/(.{4})(?=.)/g, '$1-');
