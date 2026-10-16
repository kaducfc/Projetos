// Resultado oficial da partida (derivado do estado do motor). É o objeto entregue ao sistema de campeonatos.
export function construirResultado(P) {
  const eq = (e) => {
    const E = P.equipes[e]; const cs = P.campeoes.filter((c) => c.equipe === e);
    const estr = P.estruturas.filter((x) => x.equipe === e);
    return {
      abates: E.abates, mortes: E.mortes, ouro: Math.round(cs.reduce((s, c) => s + c.ouroTotal, 0)),
      torresPerdidas: estr.filter((x) => x.subtipo === 'torre' && x.morto).length,
      inibidoresPerdidos: estr.filter((x) => x.subtipo === 'inibidor' && (x.morto || x.destruidaEm != null)).length,
      dragoes: E.pilhasDragao, nivelMedio: Math.round(cs.reduce((s, c) => s + c.nivel, 0) / Math.max(1, cs.length) * 10) / 10,
      baroes: P.eventos.filter((v) => v.tipo === 'objetivo_abatido' && v.objetivo === 'barao' && v.equipe === e).length,
      arautos: P.eventos.filter((v) => v.tipo === 'objetivo_abatido' && v.objetivo === 'arauto' && v.equipe === e).length,
      aldeias: undefined,
    };
  };
  const jogadores = P.campeoes.map((c) => ({
    id: c.jogadorId, nome: c.nome, equipe: c.equipe, pos: c.pos, campeao: c.campeao, nivel: c.nivel, abates: c.estat.abates, mortes: c.estat.mortes, assistencias: c.estat.assist,
    cs: c.estat.cs + c.estat.csSelva, ouro: Math.round(c.ouroTotal), dano: Math.round(c.estat.dano), danoSofrido: Math.round(c.estat.danoSofrido), torres: c.estat.torres, objetivos: c.estat.objetivos, itens: [...c.itens], ganks: c.ganks,
  }));
  const f = P.fim || {};
  const tipos = {}; for (const v of P.eventos) tipos[v.tipo] = (tipos[v.tipo] || 0) + 1;
  // melhor desempenho: participação em abates, dano e objetivos (só para destaque na interface)
  const nota = (j) => j.abates * 3 + j.assistencias * 1.5 - j.mortes * 1.5 + j.dano / 2500 + j.objetivos * 2 + j.torres * 1.5;
  const mvp = [...jogadores].filter((j) => !f.vencedor || j.equipe === f.vencedor).sort((a, b) => nota(b) - nota(a))[0] || null;
  return {
    versaoRegras: P.regras.versao, semente: P.semente, duracao: Math.round(f.duracao || P.t), vencedor: f.vencedor || null, perdedor: f.perdedor || null, motivo: f.motivo || null, interrompida: !!f.interrompida,
    equipes: { azul: eq('azul'), vermelho: eq('vermelho') }, jogadores, mvp: mvp ? { id: mvp.id, nome: mvp.nome, campeao: mvp.campeao } : null,
    eventosPorTipo: tipos, eventos: P.eventos.filter((v) => ['abate', 'torre_destruida', 'inibidor_destruido', 'objetivo_abatido', 'nexus_destruido', 'primeiro_abate', 'gank_resultado', 'fim'].includes(v.tipo)),
    diagnostico: { presos: P.diag.presos, presosGraves: P.diag.presosGraves, erros: P.diag.erros.length },
  };
}
