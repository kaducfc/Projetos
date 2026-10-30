// Gera supabase/migrations/0076_conexoes_grupos.sql a partir da biblioteca de grupos do jogo
// (jogos/conexoes/js/grupos.js). Rodar sempre que mexer nos grupos:  node scripts/conexoes-sql.mjs
// Depois rode o arquivo gerado no SQL Editor do Supabase (ele apaga e recarrega a tabela; rodar de novo é seguro).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GRUPOS, FAMILIAS_CAMPEAO, norm } from '../jogos/conexoes/js/grupos.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (l) => `array[${l.map(q).join(', ')}]::text[]`;

export function gerarSql() {
  const linhas = GRUPOS.map((g) => `  (${g.id}, ${g.dif}, ${q(g.fam)}, ${q(g.tit)}, ${FAMILIAS_CAMPEAO.has(g.fam)}, ${arr(g.p)}, ${arr(g.p.map(norm))})`);
  return `-- Grupos do Conexões do League (${GRUPOS.length}) para o sorteio no servidor. GERADO por scripts/conexoes-sql.mjs: não editar à mão.
-- Rodar depois da 0075. Rodar de novo é seguro (apaga e recarrega a tabela).

begin;
delete from public.site_conexoes_grupos;
insert into public.site_conexoes_grupos (id, dif, fam, tit, campeao, p, chaves) values
${linhas.join(',\n')};
commit;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destino = new URL('../supabase/migrations/0076_conexoes_grupos.sql', import.meta.url);
  writeFileSync(destino, gerarSql());
  console.log(`${GRUPOS.length} grupos gravados em supabase/migrations/0076_conexoes_grupos.sql`);
}
