// Gera barao-banco/perguntas.sql a partir de perguntas.mjs.
//   node barao-banco/gerar-sql.mjs
// Depois, rodar o perguntas.sql no SQL Editor do Supabase (pode rodar de novo a cada
// edição: atualiza as perguntas que mudaram e apaga as que saíram).
// ATENÇÃO: esta pasta fica FORA de site/ de propósito: as respostas certas não podem
// ficar em nenhum arquivo servido pelo site.
import { writeFileSync } from 'node:fs';
import { BANCO } from './perguntas.mjs';

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const linhas = [];
for (const [faixa, lista] of Object.entries(BANCO)) {
  for (const p of lista) {
    linhas.push(`  (${faixa}, ${lit(p.cat)}, ${lit(p.q)}, array[${p.a.map(lit).join(', ')}])`);
  }
}
const sql = `-- Perguntas do Show do Barão (${linhas.length}). Gerado por barao-banco/gerar-sql.mjs; não editar à mão.
-- Rodar depois da 0066_barao_servidor.sql. Pode rodar de novo: atualiza o que mudou e apaga o que saiu.
-- A primeira alternativa de cada pergunta é a certa.
create temporary table _barao_novas (faixa int, cat text, q text, a text[]) on commit drop;
insert into _barao_novas (faixa, cat, q, a) values
${linhas.join(',\n')};
insert into public.site_barao_perguntas (faixa, cat, q, a)
select faixa, cat, q, a from _barao_novas
on conflict (q) do update set faixa = excluded.faixa, cat = excluded.cat, a = excluded.a;
delete from public.site_barao_perguntas where q not in (select q from _barao_novas);
`;
writeFileSync(new URL('./perguntas.sql', import.meta.url), `begin;\n${sql}commit;\n`);
console.log(`${linhas.length} perguntas em barao-banco/perguntas.sql`);
