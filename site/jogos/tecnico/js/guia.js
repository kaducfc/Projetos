// Guia do jogo: páginas por tema, em linguagem simples. Só texto (nada aqui chama o servidor); o estado é só a página aberta.
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const caixa = (tipo, t) => `<p class="gd-caixa ${tipo}"><b>${tipo === 'dica' ? 'Dica' : tipo === 'atencao' ? 'Atenção' : 'Exemplo'}</b> ${t}</p>`;
const lista = (...it) => `<ul class="gd-lista">${it.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const passos = (...it) => `<ol class="gd-passos">${it.map((x) => `<li>${x}</li>`).join('')}</ol>`;
const tabela = (cab, ...linhas) => `<div class="gd-tab"><table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const faq = (...qa) => `<div class="gd-faq">${qa.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;

export const PAGINAS = [
  { id: 'inicio', t: 'Primeiros passos', r: 'O que é o jogo e como começar', cor: '#f5cf5a', corpo: () => `
    <p>Você é o <b>técnico de uma organização de League of Legends</b>. Monta o time de 5 jogadores, treina, contrata, disputa campeonatos e ganha créditos para crescer.</p>
    <h4>Como começar</h4>
    ${passos('<b>Crie a organização:</b> nome, sigla e o ícone (um símbolo com as suas cores, ou só a escrita do nome).', '<b>Escolha os 5 primeiros jogadores:</b> 1 de cada posição entre 15 opções. Eles vêm com contrato de cortesia de 12 semanas.', '<b>Jogue a primeira liga:</b> você entra direto na <b>Liga Academy</b>.')}
    <h4>Rotina do dia</h4>
    ${lista('Veja o <b>Início</b>: a partida do dia e o que aconteceu.', '<b>Jogue a partida</b> do campeonato (2 por dia, de segunda a sexta).', 'Faça <b>amistosos</b> e <b>treinos</b> para evoluir os jogadores.', 'Passe no <b>Marketing</b> para resgatar a renda que acumulou.', 'Use o <b>Mercado</b> e os <b>baús</b> para melhorar o elenco.')}
` },

  { id: 'moedas', t: 'Créditos, RC e fragmentos', r: 'As três moedas do jogo', cor: '#4ade80', corpo: () => `
    <p>Existem <b>três tipos de “dinheiro”</b>. Cada um serve para uma coisa.</p>
    ${tabela(['Moeda', 'Para que serve', 'De onde vem'],
    ['<b>Créditos</b><br><small>moeda do clube</small>', 'Contratar jogadores, pagar salários, treinar, melhorar o marketing e contratar patrocínios.', 'Prêmios de campeonatos, partidas, patrocinadores e a renda do Marketing. Você começa com <b>600.000</b>.'],
    ['<b>Rift Coins (RC)</b><br><small>moeda do site</small>', 'Baús de recrutamento, mercado entre usuários e trocar o nome do time (200 RC).', 'Da sua carteira do site. O saldo aparece no topo do jogo.'],
    ['<b>Fragmentos</b><br><small>de jogador</small>', 'Subir as estrelas dos jogadores.', 'Ao demitir jogadores (veja “Estrelas e fragmentos”).'])}
    ${faq(['Preciso gastar RC para jogar?', 'Não. Dá para jogar tudo só com créditos. O RC acelera: baús com jogadores Legados e compras entre usuários.'], ['Os créditos acabam?', 'Salários e contratos custam créditos toda semana. Mantenha a renda do Marketing e os prêmios em dia e não contrate acima do que o clube aguenta.'])}` },

  { id: 'elenco', t: 'Elenco e posições', r: 'Titulares, reservas e quem joga onde', cor: '#60a5fa', corpo: () => `
    <p>O time tem <b>5 titulares</b>, um por posição: <b>Topo, Selva, Meio, Atirador e Suporte</b>. O resto fica como <b>reserva</b> no inventário, que cabe até <b>50 jogadores</b>.</p>
    ${lista('Para colocar alguém como titular, ele precisa ter um <b>contrato ativo</b> (1 semana ou 1 temporada).', 'Em <b>Meu elenco</b> você troca titulares e reservas e abre a <b>ficha</b> de cada jogador.', 'Cada jogador mostra posição, idade, região, atributos, <b>Poder</b>, potencial, estrelas e os <b>idiomas</b> que fala.')}
    ${caixa('atencao', 'Jogador <b>fora da posição</b> rende só <b>75%</b> do Poder. Alguns jogadores têm uma posição secundária e jogam nela sem perder.')}
    ${faq(['Quantos reservas posso ter?', 'O inventário comporta até 50 jogadores no total. Titulares + reservas contam no mesmo limite.'], ['O que são os atributos?', 'Mecânica, Fase de rotas, Macro, Teamfight e Mental (e Fama, que só mexe no preço e na audiência). O Poder vem deles.'], ['Posso vender ou demitir?', 'Sim. Reservas podem ser demitidos (viram fragmentos) ou anunciados no mercado entre usuários.'])}` },

  { id: 'poder', t: 'Poder e eficiência', r: 'O que faz o time ficar forte', cor: '#f472b6', corpo: () => `
    <p>O <b>Poder</b> é o número que resume a força de um jogador. É uma média dos 5 atributos.</p>
    <h4>Os atributos</h4>
    ${tabela(['Atributo', 'O que representa'], ['Mecânica', 'Habilidade com o campeão: acertar skills, trocar golpes, reflexo.'], ['Fase de rotas', 'Desempenho nos primeiros minutos: farm, trocas e vantagem na lane.'], ['Macro', 'Leitura de jogo: objetivos, rotação, mapa e tomada de decisão.'], ['Teamfight', 'Posicionamento e execução nas lutas em equipe.'], ['Mental', 'Frieza sob pressão e consistência.'], ['Fama', 'Só mexe no preço e na audiência; não muda o Poder.'])}
    ${tabela(['Poder', 'Escudo'], ['95 ou mais', 'Challenger'], ['90 a 94', 'Diamante'], ['80 a 89', 'Platina'], ['70 a 79', 'Ouro'], ['abaixo de 70', 'Prata'])}
    <h4>O Poder do time em campo</h4>
    <p>É a média do Poder dos 5 titulares <b>na posição em que jogam</b>, e mais alguns bônus:</p>
    ${lista('<b>Estrelas:</b> +5% de eficiência por estrela (até 10 estrelas).', '<b>Comunicação (idiomas):</b> quando os titulares falam o mesmo idioma, o time rende mais e a sinergia sobe.', '<b>Sinergia:</b> cresce com o tempo jogando juntos e cai quando você troca titulares (no máximo +3 de Poder).', '<b>Maestria:</b> jogador com campeão favorito de maestria alta ganha Poder com aquele campeão.')}
    ${caixa('dica', 'A barra de Poder pode passar de 100 por causa das estrelas e dos bônus. O teto é <b>125</b>.')}
    ${faq(['O que é “eficiência”?', 'É o bônus percentual em cima do Poder dentro da partida. Estrelas dão +5% cada.'], ['Como funciona a comunicação?', 'Jogadores com o mesmo idioma nativo se entendem melhor; idiomas em comum (inclusive o inglês) também ajudam, um pouco menos. A tela Início mostra o idioma de cada titular com cores: verde, amarelo e vermelho.'])}` },

  { id: 'jogadores', t: 'Jogadores e raridades', r: 'Comuns, Legados e como obtê-los', cor: '#c084fc', corpo: () => `
    <p>Há dois tipos de jogador:</p>
    ${lista('<b>Comuns:</b> atletas fictícios, com Poder de até <b>80</b>. Aparecem no mercado oficial.', '<b>Legados:</b> <b>110 jogadores reais</b> (Faker, Chovy, Caps...). Têm raridade, retrato e são a elite do jogo.')}
    ${tabela(['Raridade', 'Quantidade'], ['Mítico', '10 jogadores'], ['Lendário', '20 jogadores'], ['Épico', '20 jogadores'], ['Raro', '30 jogadores'], ['Comum', '30 jogadores'])}
    <p>Treinando, jogadores comuns podem ganhar até <b>+10 de Poder</b> e os Legados até <b>+15</b>.</p>
    ${faq(['Como consigo um Legado?', 'Principalmente pelos <b>baús</b> (Recrutar) e pelo <b>mercado entre usuários</b>, comprando de outros técnicos com RC.'], ['Tirei um Legado repetido. E agora?', 'Ele vira uma <b>cópia</b> do mesmo jogador, usada para subir as estrelas dele.'])}` },

  { id: 'estrelas', t: 'Estrelas e fragmentos', r: 'Como evoluir um jogador sem trocar de jogador', cor: '#f5cf5a', corpo: () => `
    <p>Cada jogador tem de <b>0 a 10 estrelas</b>. Cada estrela dá <b>+5% de eficiência</b> em campo (não muda o Poder do cartão).</p>
    <h4>Como subir de estrela</h4>
    ${lista('<b>Legado:</b> usando <b>cópias repetidas</b> (para a estrela N, N cópias) ou <b>fragmentos</b>.', '<b>Comum:</b> usando <b>fragmentos</b>. Quanto mais forte o jogador, mais caro.')}
    <h4>Como conseguir fragmentos</h4>
    <p>Demitindo jogadores que você não usa:</p>
    ${tabela(['Jogador demitido', 'Fragmentos'], ['Comum (Poder até 50 / 70 / 80 / acima)', '5 / 10 / 15 / 20'], ['Legado Comum / Raro / Épico / Lendário / Mítico', '30 / 40 / 60 / 80 / 125'])}
    ${caixa('atencao', 'Quem tem estrelas ou fragmentos investidos recebe <b>metade</b> do que gastou de volta ao demitir. A tela de demissão mostra o valor antes de confirmar.')}
    ${faq(['Vale a pena demitir um Legado?', 'Só se ele for repetido ou você precisar muito de fragmentos. Legados são raros e mantêm valor no mercado entre usuários.'])}` },

  { id: 'treino', t: 'Treinamento e XP', r: 'Evoluir os atributos dos jogadores', cor: '#2dd4bf', corpo: () => `
    <p>Treinar sobe os atributos de um jogador. Para isso ele precisa de <b>XP</b>.</p>
    ${lista('O XP vem de <b>partidas oficiais</b> (mais na vitória) e de <b>amistosos</b>.', 'Cada treino custa <b>créditos</b> e dura algumas horas. Você pode treinar <b>até 5 jogadores ao mesmo tempo</b>.', 'Só os <b>titulares</b> aparecem abertos na tela; reservas ficam recolhidos até você abrir o cartão.')}
    ${caixa('atencao', 'Há um <b>limite de treino</b>: jogadores comuns sobem até +10 acima do Poder inicial; Legados, até <b>+15</b>. Quando chega no limite o treino é bloqueado.')}
    ${faq(['Por que o botão de treinar está cinza?', 'Ou o jogador chegou ao limite de treino, ou ainda não tem XP suficiente (a barra no cartão mostra quanto falta), ou você já tem 5 treinos em andamento.'], ['Posso acelerar?', 'Jogue mais partidas e amistosos: eles geram XP.'])}` },

  { id: 'amistoso', t: 'Amistosos e maestria', r: 'Treino de combate e campeões favoritos', cor: '#fb923c', corpo: () => `
    <p><b>Amistosos</b> são partidas contra outras equipes que não valem campeonato: servem para ganhar <b>XP</b> e <b>maestria</b> sem arriscar nada.</p>
    ${lista('Escolha um adversário da lista e jogue a partida normalmente (draft e mapa).', 'Os primeiros amistosos do dia rendem XP; depois você ainda ganha maestria.')}
    <h4>Maestria</h4>
    <p>Cada jogador acumula <b>pontos de maestria</b> com cada campeão: 30 por vitória e 15 por derrota. São 6 níveis, e o bônus de Poder vai de <b>+3% a +18%</b>.</p>
    ${lista('Cada jogador pode ter até <b>5 campeões favoritos</b>.', 'O bônus só vale quando ele joga com o campeão da maestria.', 'Os campeões da maestria aparecem na ficha do jogador.')}
    ${faq(['Perder no amistoso tem custo?', 'Não. Só vale XP e maestria.'])}` },

  { id: 'mercado', t: 'Mercado e contratos', r: 'Contratar, pagar salário e vender', cor: '#60a5fa', corpo: () => `
    <h4>Mercado oficial</h4>
    ${lista('Mostra de 7 a 10 jogadores comuns, que <b>muda a cada 12 horas</b>.', 'Os jogadores têm Poder próximo ao do seu time. Se o seu Poder for muito alto, o mercado mostra os melhores jogadores comuns (até 80).', 'Preços em <b>créditos</b>. Contratar leva o jogador para o inventário.')}
    <h4>Contratos e salários</h4>
    ${lista('Para escalar um jogador como titular, efetive um <b>contrato</b>: <b>1 semana</b> ou <b>1 temporada</b> (4 semanas, <b>20% mais barato</b>).', 'O salário é pago <b>adiantado</b> ao assinar.', 'Se encerrar o contrato antes do fim, você recebe <b>50% do que sobrou</b>.', 'Renove antes de acabar: jogador com contrato vencendo não pode ser anunciado.')}
    <h4>Mercado entre usuários</h4>
    ${lista('Você anuncia um jogador seu por um preço em <b>RC</b>; outro técnico compra.', 'O vendedor paga <b>5% de taxa</b> sobre o preço.', 'Há limites contra abuso: a conta precisa ter mais de 7 dias, são até 5 compras por dia, e quem vendeu um jogador não pode comprar o mesmo de volta por 14 dias.')}
    ${faq(['Por que um jogador sumiu do mercado?', 'A rotação acontece a cada 12 horas. Quem foi contratado por outro técnico também sai da lista.'], ['Cancelei um anúncio, posso anunciar de novo?', 'Sim. Você pode ter até 5 anúncios abertos ao mesmo tempo.'])}` },

  { id: 'recrutar', t: 'Recrutar (baús)', r: 'Como ganhar jogadores Legados', cor: '#f5cf5a', corpo: () => `
    <p>Os <b>baús</b> entregam Legados (e cópias). Pagos em <b>RC</b>.</p>
    ${tabela(['Baú', 'Preço', 'Chances'], ['<b>Básico</b>', '500 RC', 'Comum 55% · Raro 30% · Épico 12% · Lendário 2,7% · Mítico 0,3%'], ['<b>Premium</b>', '1.000 RC', 'Comum 20% · Raro 38% · Épico 28% · Lendário 11% · Mítico 3%'])}
    ${lista('Dá para abrir <b>5 de uma vez</b> com <b>15% de desconto</b>.', 'Tem uma <b>garantia</b>: depois de 10 baús sem nada de Épico para cima, o próximo vem garantido com pelo menos Épico.', 'O jogador novo vem com contrato de cortesia de 12 semanas. Repetido vira <b>cópia</b> para estrelas.', 'A janela de abertura mostra os jogadores um por um, com som (dá para desligar em Configuração).')}
    ${caixa('atencao', 'O inventário precisa ter espaço (limite de 50 jogadores) para a quantidade de baús que você abrir.')}
    ${faq(['Quais são as chances de cada raridade?', 'Estão na tabela acima, que usa os mesmos números do jogo.'])}` },

  { id: 'campeonatos', t: 'Campeonatos e temporada', r: 'Ligas, Copa, Mundial e prêmios', cor: '#fbbf24', corpo: () => `
    <p>A <b>temporada tem 4 semanas</b>:</p>
    ${tabela(['Semana', 'Competição'], ['1', 'Liga (Academy ou Nacional)'], ['2', 'Copa Internacional'], ['3', 'Liga'], ['4', 'Campeonato Mundial'])}
    <h4>Como é a liga da semana</h4>
    ${lista('Você e <b>7 equipes do sistema</b>: 8 times no total. Os técnicos só se enfrentam nos campeonatos internacionais.', '<b>Segunda a sexta:</b> 2 jogos por dia (MD1, 1 mapa), vitória = 1 ponto.', '<b>Sábado:</b> semifinais dos 4 melhores (MD3). <b>Domingo:</b> final (MD5).', '<b>Empate de pontos:</b> o técnico (você) tem prioridade e avança.')}
    ${caixa('atencao', 'Se você <b>não jogar a partida do dia até a meia-noite</b>, ela conta como <b>derrota por W.O.</b> (e fica indicada no histórico).')}
    <h4>Promoção e vagas</h4>
    ${lista('Os <b>2 primeiros da Liga Academy sobem</b> para a Liga Nacional.', 'Os <b>2 primeiros da Nacional</b> ganham vaga nos torneios internacionais (Copa e Mundial). Não existe rebaixamento.', 'Quem está na Copa ou no Mundial naquela semana não joga a liga.')}
    <h4>Prêmios em créditos</h4>
    ${tabela(['Competição', '1º', '2º', '3º'], ['Liga Academy', '60.000', '40.000', '28.000'], ['Liga Nacional', '150.000', '100.000', '70.000'], ['Copa Internacional', '300.000', '150.000', '60.000'], ['Mundial', '1.000.000', '500.000', '250.000'])}
    ${faq(['Criei a conta no meio da semana. E agora?', 'De segunda a sexta, sua liga começa hoje e os jogos que restam até sexta são feitos normalmente; sábado e domingo você entra nas fases finais se se classificar. Se criou no fim de semana, espere a segunda-feira.'], ['Perdi na semifinal. Perdi a semana?', 'Você ainda ganha o que a classificação da fase de pontos garantiu. Na semana seguinte tudo recomeça normalmente.'])}` },

  { id: 'partidas', t: 'Partidas e draft', r: 'Como se joga uma partida', cor: '#ef4444', corpo: () => `
    <p>Em cada confronto você joga <b>no navegador</b>:</p>
    ${passos('<b>Escolha de lado</b> (quando for sua vez): quem escolhe o lado decide quem começa os picks.', '<b>Draft:</b> bans e picks de campeões. Cada jogador rende mais com um campeão da posição dele e, melhor ainda, com um favorito de maestria.', '<b>Partida:</b> acompanhe o mapa, os objetivos e a estratégia do time.', '<b>Resultado:</b> quadro final com abates, dano, ouro, itens e visão.')}
    ${lista('<b>MD1</b> = 1 mapa (fase de pontos); <b>MD3</b> = melhor de 3 (semifinais); <b>MD5</b> = melhor de 5 (final).', 'Cada jogador compra itens pensando no time inimigo: tanques fazem mais resistência contra o dano que mais sofrem; ADCs e magos buscam penetração contra muitos tanques.', 'Um campeão fora da posição do jogador perde eficiência.')}
    ${caixa('dica', 'A partida é decidida pelo <b>Poder do time</b>, pelo <b>draft</b> e pela <b>estratégia</b>. Times mais fortes vencem mais, mas zebras acontecem.')}
    ${faq(['Posso sair da partida no meio?', 'Se você não terminar até a meia-noite do dia da partida, ela conta como derrota por W.O. Jogue com tempo.'])}` },

  { id: 'marketing', t: 'Marketing e patrocínios', r: 'Renda passiva em créditos', cor: '#a78bfa', corpo: () => `
    <p>O Marketing gera <b>créditos mesmo quando você está fora</b>. A renda fica guardada num “cofre” (até <b>8 horas</b>) até você apertar <b>Resgatar</b>.</p>
    ${lista('<b>Fama:</b> sobe com vitórias, títulos, boa colocação e astros no elenco; abre patrocínios melhores.', '<b>Nível de marketing:</b> aumenta o bônus na renda e quantos patrocínios você pode ter ao mesmo tempo.', '<b>Audiência:</b> vem da fama dos jogadores (titulares contam inteiros, reservas contam menos) e aumenta a renda.', '<b>Patrocinadores:</b> contratos de marcas que pagam créditos fixos por minuto.', '<b>Campanhas:</b> multiplicam <b>toda a renda</b> por algumas horas. Confira o lucro estimado antes de ativar.')}
    ${caixa('dica', 'Entre todos os dias, resgate antes de dormir ou antes de sair: o cofre enche e para de acumular.')}
    ${faq(['Quanto eu ganho por hora?', 'A tela de Marketing mostra a renda por minuto, por hora e em 24 horas.'], ['Vale a pena ativar campanha?', 'Depende da sua renda: a tela mostra o lucro ou prejuízo estimado de cada campanha.'], ['Posso voltar ao visual antigo?', 'Sim, em Configuração → Visual do Marketing.'])}` },

  { id: 'rank', t: 'Rank, histórico e mais', r: 'Onde ver o que aconteceu', cor: '#94a3b8', corpo: () => `
    ${lista('<b>Rank:</b> lista dos técnicos por Poder da equipe, com títulos. Clique numa linha para ver o time titular.', '<b>Histórico:</b> partidas e resultados anteriores, com o quadro completo.', '<b>Calendário:</b> as semanas da temporada e as datas de cada competição.', '<b>Avisos:</b> novidades, resultados e o que precisa da sua atenção (o sino).', '<b>Personalizar:</b> nome, símbolo, cores e estilo do time.', '<b>Configuração:</b> sons, animações, trocar o nome do time (200 RC) e o visual do Marketing.')}
    ${faq(['Posso mudar o nome do time?', 'Sim, em Configuração. Custa 200 RC e o novo nome precisa ser único.'], ['Como mudo o símbolo ou as cores?', 'Em Personalizar. É grátis e não muda a força do time.'])}` },

  { id: 'duvidas', t: 'Dúvidas rápidas', r: 'Respostas curtas para o que mais perguntam', cor: '#f5cf5a', corpo: () => faq(
    ['Por onde começo?', 'Jogue a partida do dia, depois faça amistosos e treinos. Resgate o Marketing e veja o Mercado.'],
    ['Quanto tempo leva uma temporada?', 'Quatro semanas: liga, Copa Internacional, liga e Campeonato Mundial.'],
    ['Esqueci de jogar a partida.', 'Passou da meia-noite? Conta como derrota por W.O. Fica no histórico. Na próxima não esqueça.'],
    ['Por que não consigo escalar um jogador?', 'Ele precisa de contrato ativo. Abra a ficha e efetive um contrato de 1 semana ou 1 temporada.'],
    ['O que é “fora de posição”?', 'Jogador em vaga que não é a dele (nem a posição secundária) rende 75% do Poder.'],
    ['Qual a diferença entre créditos e RC?', 'Créditos são do clube (salários, contratos, treino). RC é da sua conta (baús, mercado entre usuários, nome do time).'],
    ['Como consigo um Legado?', 'Pelos baús ou comprando de outro técnico no mercado entre usuários.'],
    ['O que fazer com jogador repetido?', 'Legado repetido vira cópia para estrelas. Os outros podem ser demitidos para virar fragmentos.'],
    ['Por que meu treino está bloqueado?', 'Limite de treino atingido, XP insuficiente, ou 5 treinos já em andamento.'],
    ['Como a sinergia funciona?', 'Sobe com o tempo jogando com os mesmos titulares e cai quando você troca. O bônus é pequeno (até +3 de Poder).'],
    ['Perdi o acesso à partida no meio.', 'Abra de novo a aba Início e clique em “Jogar a partida”: o progresso volta de onde estava.'],
    ['Como sei se estou subindo de divisão?', 'Na Liga Academy, os 2 primeiros sobem para a Liga Nacional ao final da semana.'],
    ['Posso desligar os sons?', 'Sim, em Configuração → Efeitos sonoros.']) },
];

export const paginaPor = (id) => PAGINAS.find((p) => p.id === id);

// Estado: S.guia = { pag: id | null, busca: '' }
export function viewGuia(S) {
  const g = S.guia || (S.guia = { pag: null, busca: '' });
  const p = g.pag ? paginaPor(g.pag) : null;
  if (!p) {
    const q = g.busca.trim().toLowerCase();
    const lista = PAGINAS.filter((x) => !q || `${x.t} ${x.r} ${x.corpo().replace(/<[^>]+>/g, ' ')}`.toLowerCase().includes(q));
    return `<div class="gd"><header class="gd-topo"><div><p class="tc-eyebrow">Guia do jogo</p><h1>Tudo para jogar bem</h1><p class="tc-mudo">Escolha um tema. Cada página é curta e tem as dúvidas mais comuns no final.</p></div>
      <input class="tc-input gd-busca" type="search" name="guia_busca" data-guia-busca placeholder="Buscar no guia (ex.: salário, baú, W.O.)" value="${esc(g.busca)}" aria-label="Buscar no guia" /></header>
      <div class="gd-grade">${lista.map((x, i) => `<button type="button" class="gd-tema" style="--c:${x.cor}" data-act="guia-pag" data-id="${x.id}"><small>${String(PAGINAS.indexOf(x) + 1).padStart(2, '0')}</small><b>${esc(x.t)}</b><span>${esc(x.r)}</span></button>`).join('') || '<p class="tc-mudo">Nada encontrado. Tente outra palavra.</p>'}</div></div>`;
  }
  const i = PAGINAS.indexOf(p); const ant = PAGINAS[i - 1]; const prox = PAGINAS[i + 1];
  return `<div class="gd gd-pag" style="--c:${p.cor}"><button type="button" class="tc-btn peq" data-act="guia-pag" data-id="">← Todos os temas</button>
    <article class="gd-art"><p class="tc-eyebrow">Tema ${String(i + 1).padStart(2, '0')} de ${PAGINAS.length}</p><h1>${esc(p.t)}</h1><p class="gd-sub">${esc(p.r)}</p>${p.corpo()}</article>
    <nav class="gd-nav">${ant ? `<button type="button" class="tc-btn" data-act="guia-pag" data-id="${ant.id}">← ${esc(ant.t)}</button>` : '<span></span>'}${prox ? `<button type="button" class="tc-btn ouro" data-act="guia-pag" data-id="${prox.id}">${esc(prox.t)} →</button>` : '<span></span>'}</nav></div>`;
}
