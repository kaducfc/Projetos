// Cole este script no Console do navegador com a Leaguepedia aberta
// (https://lol.fandom.com). Ele usa o exportador interno da wiki, que devolve
// milhares de linhas por pedido, e baixa o arquivo cblol-leaguepedia.json.
(async () => {
  const PAUSE = 3000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (m) => console.log(`%c[CBLOL] ${m}`, 'color:#d9a82b;font-weight:bold');
  const esc = (s) => s.replace(/'/g, "''");

  async function exportar(tables, fields, where, orderBy, tries = 1) {
    const u = new URL('/wiki/Special:CargoExport', location.origin);
    u.searchParams.set('tables', tables);
    u.searchParams.set('fields', fields);
    u.searchParams.set('where', where);
    if (orderBy) u.searchParams.set('order by', orderBy);
    u.searchParams.set('limit', '20000');
    u.searchParams.set('format', 'json');
    try {
      const res = await fetch(u, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      try { return JSON.parse(txt); } catch { throw new Error(`resposta inesperada: ${txt.slice(0, 120)}`); }
    } catch (err) {
      if (tries >= 8) throw err;
      const wait = Math.min(120000, 15000 * tries);
      say(`${err.message}. Tentando de novo em ${wait / 1000}s…`);
      await sleep(wait);
      return exportar(tables, fields, where, orderBy, tries + 1);
    }
  }

  // Uma consulta por ano (evita respostas grandes demais).
  async function porAno(table, fields, pages, orderBy) {
    const anos = [...new Set(pages.map((p) => (p.match(/(20\d\d)/) || [])[1]).filter(Boolean))].sort();
    const out = [];
    for (const ano of anos) {
      const lista = pages.filter((p) => p.includes(ano));
      const where = `${table}.OverviewPage IN (${lista.map((p) => `'${esc(p)}'`).join(',')})`;
      const rows = await exportar(table, fields, where, orderBy);
      out.push(...rows);
      say(`${table} ${ano}: ${rows.length} linhas (total ${out.length})`);
      await sleep(PAUSE);
    }
    return out;
  }

  try {
    const t0 = Date.now();
    say('1/5 Torneios do CBLOL (e da LTA Sul em 2025)…');
    const torneios = await exportar('Tournaments',
      'Tournaments.Name=Name,Tournaments.OverviewPage=OverviewPage,Tournaments.DateStart=DateStart,Tournaments.Date=Date,Tournaments.League=League,Tournaments.Region=Region,Tournaments.Year=Year,Tournaments.Split=Split,Tournaments.SplitNumber=SplitNumber,Tournaments.IsQualifier=IsQualifier,Tournaments.IsPlayoffs=IsPlayoffs,Tournaments.TournamentLevel=TournamentLevel,Tournaments.EventType=EventType',
      "(Tournaments.League LIKE '%Brasileiro%' OR Tournaments.OverviewPage LIKE 'CBLOL%' OR Tournaments.League LIKE 'LTA South%' OR Tournaments.OverviewPage LIKE 'LTA South%') AND Tournaments.OverviewPage NOT LIKE '%Academy%'",
      'Tournaments.DateStart');
    const principais = torneios.filter((t) => !(t.IsQualifier === true || t.IsQualifier === 1 || t.IsQualifier === '1')
      && !/qualif|promo|academy|circuito|desafiante|all.?star|showmatch/i.test(`${t.Name} ${t.OverviewPage}`));
    const pages = principais.map((t) => t.OverviewPage);
    say(`${pages.length} torneios: ${pages.join(' | ')}`);
    if (!pages.length) throw new Error('Nenhum torneio encontrado.');

    say('2/5 Estatísticas dos jogadores por jogo…');
    const jogadores = await porAno('ScoreboardPlayers',
      'ScoreboardPlayers.OverviewPage=OverviewPage,ScoreboardPlayers.GameId=GameId,ScoreboardPlayers.Link=Link,ScoreboardPlayers.Name=Name,ScoreboardPlayers.Team=Team,ScoreboardPlayers.Role=Role,ScoreboardPlayers.Champion=Champion,ScoreboardPlayers.Kills=Kills,ScoreboardPlayers.Deaths=Deaths,ScoreboardPlayers.Assists=Assists,ScoreboardPlayers.CS=CS,ScoreboardPlayers.Gold=Gold,ScoreboardPlayers.DamageToChampions=DamageToChampions,ScoreboardPlayers.VisionScore=VisionScore,ScoreboardPlayers.TeamKills=TeamKills,ScoreboardPlayers.TeamGold=TeamGold,ScoreboardPlayers.PlayerWin=PlayerWin',
      pages, 'ScoreboardPlayers.GameId');

    say('3/5 Jogos (objetivos e duração)…');
    const jogos = await porAno('ScoreboardGames',
      'ScoreboardGames.OverviewPage=OverviewPage,ScoreboardGames.GameId=GameId,ScoreboardGames.Team1=Team1,ScoreboardGames.Team2=Team2,ScoreboardGames.WinTeam=WinTeam,ScoreboardGames.Gamelength_Number=Gamelength,ScoreboardGames.Team1Kills=Team1Kills,ScoreboardGames.Team2Kills=Team2Kills,ScoreboardGames.Team1Dragons=Team1Dragons,ScoreboardGames.Team2Dragons=Team2Dragons,ScoreboardGames.Team1Barons=Team1Barons,ScoreboardGames.Team2Barons=Team2Barons,ScoreboardGames.Team1Towers=Team1Towers,ScoreboardGames.Team2Towers=Team2Towers,ScoreboardGames.Team1RiftHeralds=Team1Heralds,ScoreboardGames.Team2RiftHeralds=Team2Heralds,ScoreboardGames.Team1VoidGrubs=Team1Grubs,ScoreboardGames.Team2VoidGrubs=Team2Grubs,ScoreboardGames.Team1Gold=Team1Gold,ScoreboardGames.Team2Gold=Team2Gold',
      pages, 'ScoreboardGames.GameId');

    say('4/5 Elencos (titulares, reservas e técnicos)…');
    const elencos = await porAno('TournamentRosters',
      'TournamentRosters.OverviewPage=OverviewPage,TournamentRosters.Team=Team,TournamentRosters.RosterLinks=RosterLinks,TournamentRosters.Roles=Roles,TournamentRosters.IsUsed=IsUsed',
      pages, 'TournamentRosters.Team');
    const inscritos = await porAno('TournamentPlayers',
      'TournamentPlayers.OverviewPage=OverviewPage,TournamentPlayers.Team=Team,TournamentPlayers.Link=Link,TournamentPlayers.Role=Role',
      pages, 'TournamentPlayers.Team');

    say('5/5 Colocações…');
    const colocacoes = await porAno('TournamentResults',
      'TournamentResults.OverviewPage=OverviewPage,TournamentResults.Team=Team,TournamentResults.Place=Place,TournamentResults.Place_Number=PlaceNumber,TournamentResults.Phase=Phase',
      pages, 'TournamentResults.Place_Number');

    const data = {
      fonte: 'Leaguepedia (lol.fandom.com), licença CC BY-SA 3.0',
      baixadoEm: new Date().toISOString(),
      torneios: principais, jogadores, jogos, elencos, inscritos, colocacoes,
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cblol-leaguepedia.json';
    document.body.append(a);
    a.click();
    say(`Pronto em ${Math.round((Date.now() - t0) / 1000)}s (${(blob.size / 1e6).toFixed(1)} MB). O arquivo cblol-leaguepedia.json foi baixado.`);
  } catch (err) {
    say(`ERRO: ${err.message}. Tire um print do Console e mande no chat.`);
  }
})();
