// Conversão dos atributos do simulador de técnico em parâmetros de combate. Função única e configurável (REGRAS.atributos).
// A Fama não entra: não aumenta dano nem vida. Os atributos influenciam, mas não substituem, a simulação de combate.
const lerp = (par, t) => par[0] + (par[1] - par[0]) * Math.min(1, Math.max(0, t));

export function parametrosDeAtributos(atr, regras) {
  const c = regras.atributos;
  const n = (v) => Math.min(1, Math.max(0, ((v ?? 50) - 1) / 99));
  const geral = (n(atr.mec) * 25 + n(atr.rotas) * 20 + n(atr.macro) * 20 + n(atr.tf) * 20 + n(atr.mental) * 15) / 100; // mesmo peso do Poder do técnico (sem Fama)
  return {
    forca: lerp(c.forca, geral),                  // desempenho geral: multiplicador do dano causado por campeões
    execDano: lerp(c.mec.dano, n(atr.mec)),       // multiplicador do dano das habilidades
    execAcerto: lerp(c.mec.acerto, n(atr.mec)),   // chance de acertar habilidades de projétil
    farm: lerp(c.rotas.farm, n(atr.rotas)),       // chance de conseguir o último golpe
    troca: lerp(c.rotas.troca, n(atr.rotas)),     // qualidade das trocas de dano na rota (só no começo)
    decisaoIntervalo: lerp(c.macro.decisao, n(atr.macro)),
    ruido: lerp(c.macro.ruido, n(atr.macro)),
    luta: lerp(c.tf.luta, n(atr.tf)),
    erro: lerp(c.mental.erro, n(atr.mental)),
    tilt: c.mental.tilt * (1 - n(atr.mental)),
    macro: n(atr.macro), mental: n(atr.mental), tf: n(atr.tf), mec: n(atr.mec), rotas: n(atr.rotas),
  };
}
