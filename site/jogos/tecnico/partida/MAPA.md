# Mapa de Summoner's Rift usado na simulação

Imagem: `jogos/tecnico/img/mapa-sr.webp` (1487 × 1058 px, vista de cima, **sem estruturas desenhadas**). A orientação é a clássica:
base azul no canto inferior esquerdo, base vermelha no canto superior direito, rota do topo pela borda esquerda e superior, rota de baixo pela
borda inferior e direita, rota do meio na diagonal, rio em diagonal cruzando o meio com o covil do Barão no lado superior esquerdo e o do Dragão no inferior direito.

## Como o mapa foi mapeado

| O quê | Como foi feito | Onde fica |
|---|---|---|
| Terreno (parede × caminhável) | Árvores (verde escuro) viram parede por análise de cor; o limite externo, as paredes de pedra das bases e as áreas garantidamente abertas (rotas, bases, acampamentos, covis) são definidos à mão | `ferramentas/mapa-fonte.json` → `config/terreno.js` |
| Rotas (3) | Linhas centrais conferidas sobre a imagem, com largura de 76 px | `rotas` em `mapa-fonte.json` |
| Bases | Polígonos das áreas de pedra; paredes com torcha formam as aberturas (3 por base: topo, meio, baixo) | `bases` e `paredes` |
| Estruturas | A imagem não as tem. Posições calculadas pela distância ao longo da linha da rota, com proporções do jogo real (T1, T2, T3 e inibidor por rota; 2 torres do Nexus) | `estruturas` |
| Acampamentos e covis | Posicionados pela correspondência com o layout real de Summoner's Rift e ajustados aos "bolsões" visíveis na imagem | `acampamentos` e `covis` (marcados com `ajustar: true`) |

**Itens estimados** (marcados `ajustar` e com ⚠ na ferramenta): todos os acampamentos e os dois covis. A imagem não tem marcações desses pontos; eles foram
colocados nos bolsões mais plausíveis e conferidos para serem alcançáveis. Se algum parecer fora do lugar, edite `mapa-fonte.json` e rode:

```
python3 jogos/tecnico/partida/ferramentas/gerar_terreno.py   # precisa de opencv-python, numpy e pillow
```

## Coordenadas

- **Normalizadas** (`config/mapa.js`): x e y de 0 a 1 sobre a imagem. Formato dos dados de configuração.
- **Mundo** (`nucleo/coord.js`): unidades de jogo, 10 por pixel da imagem (mapa de 14 870 × 10 580). Espaço da simulação, isotrópico.
- **Tela**: pixels do canvas, só na renderização. `mundoParaTela` / `telaParaMundo` convertem.

## Grade de navegação

186 × 133 células de 8 px (80 unidades). Tipos: `0` parede, `1` rota, `2` selva, `3` rio, `4` base, `5` acampamento, `6` covil.
Cada categoria de unidade só pisa o que lhe cabe: **campeão** em qualquer região aberta; **minion** só em rota e base; **monstro** só em selva, rio, acampamento e covil.

## Ferramenta de depuração

Abra `jogos/tecnico/partida/depurar.html` (precisa de um servidor local). Mostra a grade, as paredes, as rotas e seus pontos, as estruturas, os acampamentos, os covis e as bases por cima
da imagem, com as coordenadas normalizadas, do mundo e a região sob o mouse. Clique em dois pontos para ver o caminho calculado pelo A* para cada perfil de unidade.
Durante uma partida, a tela da simulação oferece as camadas de caminhos, destinos, alcances, áreas de aquisição e regiões de combate.

## Moitas, fog e wards

- **Moitas** são uma camada à parte do terreno (`AJUSTES.moitas`, lista de células `"cx,cy"`; podem ficar sobre rota, selva ou rio). Células vizinhas formam uma moita (id > 0).
  Para marcar: abra `depurar.html` (só administradores), modo **Pintar terreno**, pincel **Moita (adicionar/remover)**, depois **Exportar ajustes** e cole o resultado em `config/ajustes.js`.
- **Visão** (`motor/visao.js`): quem está dentro de uma moita só é visto por inimigos dentro da mesma moita (campeão, minion ou ward). Atacar ou lançar habilidade revela o campeão por 1 s.
  Fora das moitas a visão é a de antes (raio das fontes: campeões, minions, torres e wards). Não é possível atacar quem não se vê (ataque básico e habilidades de alvo); habilidades em área ainda acertam.
- **Wards** (`motor/wards.js`, regras em `config/regras.js` → `wards`): totem amarelo (2 cargas, recarga de 240 s a 120 s conforme o nível, dura de 90 a 120 s, cai com 3 golpes) e Ward de Controle
  (75 de ouro, uma por campeão, dura até ser destruída, cai com 4 golpes, revela wards inimigas no raio de 900). Destruir uma ward dá 30 de ouro. A IA compra, coloca (centro das moitas e entradas dos covis) e destrói wards reveladas.
- **Tela**: o fog mostra a visão do time do técnico (seletor "Visão": meu time, time adversário ou tudo).
