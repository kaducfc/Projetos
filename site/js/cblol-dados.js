// Baixa da Leaguepedia (API pública "cargoquery") todos os dados do CBLOL
// necessários para o jogo do CBLOL e gera um arquivo JSON para download.
// Roda no navegador de quem abre a página; nada é enviado ao nosso servidor.
import { mountSiteBar } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

const API = 'https://lol.fandom.com/api.php';
const PAGE = 500; // máximo de linhas por pedido
const PAUSE_MS = 700; // intervalo entre pedidos, para não sobrecarregar a wiki
const logEl = document.getElementById('log');
const btn = document.getElementById('go');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  logEl.textContent += `${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// Um pedido à API, com novas tentativas em caso de erro ou limite de uso.
async function cargo(params, attempt = 1) {
  const url = new URL(API);
  const q = { action: 'cargoquery', format: 'json', origin: '*', limit: String(PAGE), ...params };
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`${json.error.code}: ${json.error.info}`);
    return (json.cargoquery || []).map((r) => r.title);
  } catch (err) {
    if (attempt >= 6) throw err;
    const wait = 2000 * attempt;
    log(`  ! ${err.message}. Tentando de novo em ${wait / 1000}s…`);
    await sleep(wait);
    return cargo(params, attempt + 1);
  }
}

// Todas as páginas de um pedido (offset de 500 em 500).
async function cargoAll(params, label) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const part = await cargo({ ...params, offset: String(offset) });
    rows.push(...part);
    if (label) log(`  ${label}: ${rows.length} linhas`);
    if (part.length < PAGE) return rows;
    await sleep(PAUSE_MS);
  }
}

const esc = (s) => s.replace(/'/g, "''");
const inList = (field, pages) => `${field} IN (${pages.map((p) => `'${esc(p)}'`).join(',')})`;
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

async function perTournament(table, fields, pages, label, orderBy) {
  const out = [];
  for (const group of chunks(pages, 6)) {
    const rows = await cargoAll({ tables: table, fields, where: inList(`${table}.OverviewPage`, group), order_by: orderBy }, null);
    out.push(...rows);
    log(`  ${label}: ${out.length} linhas (${group[0]}…)`);
    await sleep(PAUSE_MS);
  }
  return out;
}

async function run() {
  btn.disabled = true;
  logEl.textContent = '';
  const started = Date.now();
  try {
    log('1/5 Torneios do CBLOL…');
    const tournaments = (await cargoAll({
      tables: 'Tournaments',
      fields: 'Tournaments.Name=Name,Tournaments.OverviewPage=OverviewPage,Tournaments.DateStart=DateStart,Tournaments.Date=Date,Tournaments.League=League,Tournaments.Region=Region,Tournaments.Year=Year,Tournaments.Split=Split,Tournaments.SplitNumber=SplitNumber,Tournaments.IsQualifier=IsQualifier,Tournaments.IsPlayoffs=IsPlayoffs,Tournaments.TournamentLevel=TournamentLevel,Tournaments.EventType=EventType',
      where: "(Tournaments.League LIKE '%Brasileiro%' OR Tournaments.OverviewPage LIKE 'CBLOL%') AND Tournaments.OverviewPage NOT LIKE '%Academy%'",
      order_by: 'Tournaments.DateStart',
    }, 'torneios'));
    // Só a liga principal: sem qualificatórias, promoção nem torneios à parte.
    const main = tournaments.filter((t) => t.IsQualifier !== '1' && !/qualif|promo|academy|circuito|desafiante|all.?star|showmatch/i.test(`${t.Name} ${t.OverviewPage}`));
    log(`  ${main.length} torneios da liga principal:`);
    for (const t of main) log(`   · ${t.OverviewPage} (${t.DateStart || t.Date || '?'})`);
    const pages = main.map((t) => t.OverviewPage);
    if (!pages.length) throw new Error('Nenhum torneio encontrado.');

    log('2/5 Estatísticas dos jogadores por jogo…');
    const players = await perTournament('ScoreboardPlayers',
      'ScoreboardPlayers.OverviewPage=OverviewPage,ScoreboardPlayers.GameId=GameId,ScoreboardPlayers.Link=Link,ScoreboardPlayers.Name=Name,ScoreboardPlayers.Team=Team,ScoreboardPlayers.Role=Role,ScoreboardPlayers.Champion=Champion,ScoreboardPlayers.Kills=Kills,ScoreboardPlayers.Deaths=Deaths,ScoreboardPlayers.Assists=Assists,ScoreboardPlayers.CS=CS,ScoreboardPlayers.Gold=Gold,ScoreboardPlayers.DamageToChampions=DamageToChampions,ScoreboardPlayers.VisionScore=VisionScore,ScoreboardPlayers.TeamKills=TeamKills,ScoreboardPlayers.TeamGold=TeamGold,ScoreboardPlayers.PlayerWin=PlayerWin',
      pages, 'jogadores', 'ScoreboardPlayers.GameId');

    log('3/5 Jogos (objetivos e duração)…');
    const games = await perTournament('ScoreboardGames',
      'ScoreboardGames.OverviewPage=OverviewPage,ScoreboardGames.GameId=GameId,ScoreboardGames.Team1=Team1,ScoreboardGames.Team2=Team2,ScoreboardGames.WinTeam=WinTeam,ScoreboardGames.Gamelength_Number=Gamelength,ScoreboardGames.Team1Kills=Team1Kills,ScoreboardGames.Team2Kills=Team2Kills,ScoreboardGames.Team1Dragons=Team1Dragons,ScoreboardGames.Team2Dragons=Team2Dragons,ScoreboardGames.Team1Barons=Team1Barons,ScoreboardGames.Team2Barons=Team2Barons,ScoreboardGames.Team1Towers=Team1Towers,ScoreboardGames.Team2Towers=Team2Towers,ScoreboardGames.Team1RiftHeralds=Team1Heralds,ScoreboardGames.Team2RiftHeralds=Team2Heralds,ScoreboardGames.Team1VoidGrubs=Team1Grubs,ScoreboardGames.Team2VoidGrubs=Team2Grubs,ScoreboardGames.Team1Gold=Team1Gold,ScoreboardGames.Team2Gold=Team2Gold',
      pages, 'jogos', 'ScoreboardGames.GameId');

    log('4/5 Elencos (titulares, reservas e técnicos)…');
    const rosters = await perTournament('TournamentRosters',
      'TournamentRosters.OverviewPage=OverviewPage,TournamentRosters.Team=Team,TournamentRosters.RosterLinks=RosterLinks,TournamentRosters.Roles=Roles,TournamentRosters.IsUsed=IsUsed',
      pages, 'elencos', 'TournamentRosters.Team');
    const players2 = await perTournament('TournamentPlayers',
      'TournamentPlayers.OverviewPage=OverviewPage,TournamentPlayers.Team=Team,TournamentPlayers.Link=Link,TournamentPlayers.Role=Role',
      pages, 'jogadores inscritos', 'TournamentPlayers.Team');

    log('5/5 Colocações…');
    const results = await perTournament('TournamentResults',
      'TournamentResults.OverviewPage=OverviewPage,TournamentResults.Team=Team,TournamentResults.Place=Place,TournamentResults.Place_Number=PlaceNumber,TournamentResults.Phase=Phase',
      pages, 'colocações', 'TournamentResults.Place_Number');

    const data = {
      fonte: 'Leaguepedia (lol.fandom.com), licença CC BY-SA 3.0',
      baixadoEm: new Date().toISOString(),
      torneios: main, jogadores: players, jogos: games, elencos: rosters, inscritos: players2, colocacoes: results,
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cblol-leaguepedia.json';
    a.click();
    log(`\nPronto em ${Math.round((Date.now() - started) / 1000)}s: ${(blob.size / 1e6).toFixed(1)} MB.`);
    log('O arquivo cblol-leaguepedia.json foi baixado. Envie-o para a pasta "dados-brutos" do projeto no GitHub.');
  } catch (err) {
    log(`\nERRO: ${err.message}\nTire um print desta tela e mande no chat.`);
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', run);
