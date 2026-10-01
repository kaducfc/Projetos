// Filtro de nomes de usuário: barra palavrões, ofensas e nomes reservados.
// Não é rigoroso demais: pega as formas mais comuns, inclusive com números
// no lugar de letras (p0rr4), letras repetidas (caralhooo) e palavras
// juntas (PutaMerda). A mesma lista está no banco (0005_perfil.sql), que
// é quem decide de verdade; aqui serve para avisar na hora.

// Aparecem dentro do nome em qualquer posição (raízes que quase nunca
// estão dentro de palavras normais).
export const PROIBIDO_TRECHO = [
  'caralh', 'buceta', 'bucet', 'porra', 'merda', 'arrombad', 'fdputa', 'filhodaputa', 'filhadaputa',
  'putaria', 'putinha', 'putona', 'fudid', 'foder', 'fodase', 'foda', 'punheta', 'xoxota', 'xereca',
  'piroca', 'boquete', 'siririca', 'vagabund', 'vadia', 'prostitut', 'viado', 'veado', 'cuzao', 'cusao',
  'babaca', 'otario', 'escroto', 'corno', 'piranha', 'rapariga', 'retardad', 'mongoloid', 'estupr',
  'pedofil', 'nazis', 'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'faggot', 'whore', 'slut',
  'pussy', 'asshole', 'retard', 'rapist', 'macaco', 'crioulo', 'tiziu', 'sapatao', 'traveco', 'bixa',
  'riftarcade', 'administrador', 'moderador',
];

// Proibidos só como palavra inteira (curtos ou que existem dentro de
// palavras normais, como "disputa" ou "cubo").
export const PROIBIDO_PALAVRA = [
  'cu', 'cus', 'puta', 'puto', 'putas', 'putos', 'fdp', 'vsf', 'vtnc', 'tnc', 'pqp', 'krl', 'crl', 'bct',
  'pau', 'rola', 'pinto', 'bosta', 'cacete', 'kct', 'pnc', 'gozo', 'gozar', 'anus', 'penis', 'vagina',
  'nazi', 'kkk', 'sex', 'sexo', 'porn', 'porno', 'dick', 'cock', 'fag',
  'admin', 'adm', 'mod', 'staff', 'suporte', 'oficial', 'riot', 'sistema',
];

const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' };

const normal = (s) => s.toLowerCase().replace(/[0-9]/g, (d) => LEET[d]);
const semRepetir = (s) => s.replace(/(.)\1+/g, '$1');

// Palavras do nome: separa por "_", "." e por maiúscula no meio (PutaMerda).
function palavras(nome) {
  return normal(nome.replace(/([a-z])([A-Z])/g, '$1 $2')).split(/[^a-z]+/).filter(Boolean);
}

// true se o nome tiver algo proibido.
export function nomeProibido(nome) {
  const s = String(nome || '');
  const junto = normal(s).replace(/[^a-z]/g, '');
  const formas = [junto, semRepetir(junto)];
  if (PROIBIDO_TRECHO.some((p) => formas.some((f) => f.includes(p) || f.includes(semRepetir(p))))) return true;
  const ps = palavras(s).flatMap((p) => [p, semRepetir(p)]);
  return PROIBIDO_PALAVRA.some((p) => ps.includes(p) || formas.includes(p));
}

export const NOME_RE = /^[A-Za-z0-9_.]{3,20}$/;

// Mensagem de erro para o nome, ou '' se estiver tudo certo.
export function problemaNoNome(nome) {
  if (!NOME_RE.test(nome || '')) return 'O nome de usuário precisa ter de 3 a 20 letras, números, "_" ou ".".';
  if (nomeProibido(nome)) return 'Esse nome de usuário não é permitido. Escolha outro.';
  return '';
}
