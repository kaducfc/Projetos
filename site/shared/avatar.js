// Ícones de perfil: o mascote do site ou uma das artes do Rift Arcade
// (shared/assets/icones). Guardado no perfil como 'mascote' ou 'icone:<id>'.
// Dois são especiais, de apoiador: só o servidor deixa usar (0014_icones.sql).

import { srcMoldura } from './molduras.js';

const MASCOTE = '/shared/assets/marca/mascote-120.png?v=2';
const PASTA = '/shared/assets/icones';

export const ICONES = [
  { id: 'arqueira-do-gelo', nome: 'Arqueira do Gelo' },
  { id: 'espadachim-errante', nome: 'Espadachim Errante' },
  { id: 'raposa-encantada', nome: 'Raposa Encantada' },
  { id: 'irmas-rebeldes', nome: 'Irmãs Rebeldes' },
  { id: 'curandeira-estelar', nome: 'Curandeira Estelar' },
  { id: 'fera-das-cavernas', nome: 'Fera das Cavernas' },
  { id: 'canhao-tubarao', nome: 'Canhão Tubarão' },
  { id: 'chapeu-do-mago', nome: 'Chapéu do Mago' },
  { id: 'cogumelo-magico', nome: 'Cogumelo Mágico' },
  { id: 'brasao-sombrio', nome: 'Brasão Sombrio' },
  { id: 'cidade-subterranea', nome: 'Cidade Subterrânea' },
  { id: 'ilhas-sombrias', nome: 'Ilhas Sombrias' },
  { id: 'terras-flutuantes', nome: 'Terras Flutuantes' },
];

// Especiais: `selo` diz o que libera (ver platform.meusSelos()).
export const ESPECIAIS = [
  { id: 'apoiador', nome: 'Obrigado!', selo: 'apoiador', regra: 'Para quem apoiou o site com qualquer valor.' },
  { id: 'pioneiro', nome: '100 primeiros', selo: 'pioneiro', regra: 'Só para os 100 primeiros apoiadores do site.' },
];

// Exclusivos: só quem ganhou (resgatando um código) vê e usa; o servidor confere
// (0034_codigos_recompensa.sql). O id sempre começa com 'exc-' e a arte fica em
// shared/assets/icones/<id>.webp. Para criar um: coloque a arte, acrescente aqui
// { id: 'exc-nome', nome: 'Nome' } e crie um código com essa recompensa no painel.
export const EXCLUSIVOS = [
  { id: 'exc-streamer', nome: 'Streamer' },
];

// Em teste: só o painel (aba Teste) mostra. Para lançar, mover para EXCLUSIVOS.
export const EXCLUSIVOS_TESTE = [
  { id: 'exc-halloween-2026', nome: 'Halloween 2026' },
  { id: 'exc-poro-assombrado', nome: 'Poro Assombrado' },
];

export const AVATARES = ['mascote', ...ICONES.map((i) => `icone:${i.id}`)];
export const AVATARES_ESPECIAIS = ESPECIAIS.map((i) => `icone:${i.id}`);

const TODOS = new Map([...ICONES, ...ESPECIAIS, ...EXCLUSIVOS, ...EXCLUSIVOS_TESTE].map((i) => [`icone:${i.id}`, i]));

export const nomeAvatar = (id) => (id === 'mascote' ? 'Mascote do Rift Arcade' : TODOS.get(id)?.nome || '');

// Endereço da imagem ('' para ícone que não existe mais, ex.: os antigos de campeão).
const srcDe = (id) => (id === 'mascote' ? MASCOTE : TODOS.has(id) ? `${PASTA}/${id.slice(6)}.webp` : '');

// <img> do ícone. Sem ícone escolhido (ou com um que não existe mais),
// mostra a inicial do nome.
export function avatarHtml(avatar, nome = '', size = 32, extra = '', moldura = '') {
  const miolo = avatarMiolo(avatar, nome, size, extra);
  const src = srcMoldura(moldura);
  if (!src) return miolo;
  return `<span class="av-wrap" style="width:${size}px;height:${size}px">${miolo}<img class="av-moldura" src="${src}" alt="" decoding="async" onerror="this.remove()" /></span>`;
}

function avatarMiolo(avatar, nome, size, extra) {
  const inicial = (nome || '?').trim().charAt(0).toUpperCase();
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px`;
  const src = avatar ? srcDe(avatar) : '';
  if (!src) return `<span class="avatar avatar-letra ${extra}" style="${style}" aria-hidden="true">${inicial}</span>`;
  return `<span class="avatar ${extra}" style="${style}" aria-hidden="true" data-letra="${inicial}">`
    + `<img alt="" src="${src}" width="${size}" height="${size}" decoding="async" loading="lazy" onerror="this.remove()" /></span>`;
}

// Mantida por compatibilidade (as imagens agora são do próprio site).
export async function hydrateAvatars() {}
