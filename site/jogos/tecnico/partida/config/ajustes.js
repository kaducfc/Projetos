// Ajustes MANUAIS do mapa, aplicados por cima da geometria gerada (mapa.js / terreno.js). Edite com a ferramenta depurar.html (modo "Mover" e "Pintar")
// e cole aqui o que ela exportar. Não é apagado quando o terreno é gerado de novo.
//   estruturas / acampamentos / covis: { "id": [x, y] } em coordenadas normalizadas (0 a 1)
//   celulas: { "coluna,linha": tipo } com tipo 0 parede | 1 rota | 2 selva | 3 rio | 4 base | 5 acampamento | 6 covil
export const AJUSTES = { versao: 1, estruturas: {}, acampamentos: {}, covis: {}, celulas: {} };
