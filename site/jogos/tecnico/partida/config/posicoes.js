// Posições padrão ajustadas à mão para a SIMULAÇÃO DA PARTIDA (sala de testes e escolha automática de campeões).
// O servidor tem a mesma lista em supabase/migrations/0093_tecnico_posicoes.sql: mantenha as duas iguais
// (um teste confere). Aqui os nomes são os do catálogo do jogo Campeão e as posições são
// 'Top', 'Jungle', 'Mid', 'ADC' ou 'Suporte'. Campeão que não está aqui usa a posição do catálogo.
export const POSICOES = {
  Naafiri: ['Jungle'],
};
