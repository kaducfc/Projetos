// Reexecuta um mapa com a mesma semente, as mesmas escalações e as mesmas regras e compara com o resultado registrado.
// Serve para auditar resultados enviados pelo navegador (o motor é determinístico). Uso:
//   node auditar.mjs arquivo.json
// arquivo.json: { "azul": [jogadores], "vermelho": [jogadores], "semente": 123, "vencedor": "azul", "duracao": 1830 }
// (as escalações são as devolvidas por tc_partida_elencos; "vencedor" e "duracao" vêm do resultado gravado)
import { readFileSync } from 'node:fs';
import { Partida } from '../motor/partida.js';

const aqui = new URL('.', import.meta.url);
const catalogo = JSON.parse(readFileSync(new URL('../../../campeao/dados/campeoes.json', aqui), 'utf8')).campeoes.map((c) => ({ ...c, id: c.nome }));
const arq = process.argv[2];
if (!arq) { console.error('uso: node auditar.mjs arquivo.json'); process.exit(2); }
const dados = JSON.parse(readFileSync(arq, 'utf8'));
const P = new Partida({ azul: dados.azul, vermelho: dados.vermelho, semente: dados.semente, catalogo });
const r = P.executarAteFim();
const igualVencedor = r.vencedor === dados.vencedor; const igualDuracao = Math.abs(r.duracao - dados.duracao) <= 1;
console.log(JSON.stringify({ reexecutado: { vencedor: r.vencedor, duracao: r.duracao }, registrado: { vencedor: dados.vencedor, duracao: dados.duracao }, confere: igualVencedor && igualDuracao }));
process.exit(igualVencedor && igualDuracao ? 0 : 1);
