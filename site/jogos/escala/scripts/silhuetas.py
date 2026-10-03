#!/usr/bin/env python3
"""Gera as silhuetas da Escala de Runeterra a partir dos modelos 3D do jogo.

Lê dados/itens.json (a tabela de alturas, editada à mão) e, para cada item,
baixa o modelo do CommunityDragon (raw.communitydragon.org), desenha a
silhueta de frente e salva em dados/silhuetas/<id>.webp (branca com fundo
transparente; a cor entra pelo CSS). Também grava dados/silhuetas.json com a
proporção (largura / altura) de cada uma.

A silhueta só dá a forma: o tamanho no jogo vem da "altura" da tabela, do pé
ao ponto mais alto.

Opções por item na tabela:
  imagem  usa um PNG em vez do modelo 3D (ex.: "originais/teemo.png"). O
          fundo pode ser transparente ou de uma cor só (sai sozinho).
  modelo  pasta do personagem no jogo (ex.: "garen")
  yaw     ângulo da câmera em graus (0 = de frente)
  fora    peças do modelo que não entram (ex.: ["Book_Cover"])
  mais    peças escondidas por padrão que devem entrar
  comp    qual pedaço manter: 1 = o maior (padrão), 2 = o segundo maior...

Uso: pip install numpy scipy pillow; python3 scripts/silhuetas.py [ids...]
Os modelos baixados ficam em $ESCALA_CACHE (padrão /tmp/escala-modelos).
"""
import json, math, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')
CACHE = os.environ.get('ESCALA_CACHE', '/tmp/escala-modelos')
BASE = 'https://raw.communitydragon.org/latest/game/'
UA = {'User-Agent': 'Mozilla/5.0 rift-arcade'}
ALTURA_PX = 420  # altura da imagem final


def abrir(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)


def listar(url):
    try:
        html = abrir(url).read().decode()
    except Exception:
        return []
    return [x for x in re.findall(r'href="([^"?#][^"]*)"', html) if not x.startswith(('http', '/', '../'))]


def baixar(url, destino):
    if not os.path.exists(destino):
        dados = abrir(url).read()
        with open(destino, 'wb') as f:
            f.write(dados)
    return destino


def pecas(modelo):
    """Arquivos .obj do skin padrão e as peças escondidas no início."""
    pasta = os.path.join(CACHE, modelo)
    os.makedirs(pasta, exist_ok=True)
    skin = json.load(open(baixar(f'{BASE}data/characters/{modelo}/skins/skin0.bin.json', os.path.join(pasta, 'skin0.json'))))
    chave = next(k for k in skin if re.fullmatch(r'Characters/[^/]+/Skins/Skin0', k, re.I))
    props = skin[chave].get('skinMeshProperties', {})
    escondidas = [x.lower() for x in re.split(r'[\s,]+', props.get('initialSubmeshToHide') or '') if x]
    skn = props['simpleSkin']
    url = BASE + os.path.dirname(skn).lower() + '/' + os.path.basename(skn).lower()[:-4] + '/'
    objs = [baixar(url + o, os.path.join(pasta, o)) for o in listar(url) if o.endswith('.obj')]
    return objs, escondidas


def ler_obj(caminhos):
    V, F = [], []
    for c in caminhos:
        base = len(V)
        for linha in open(c):
            if linha.startswith('v '):
                V.append([float(x) for x in linha.split()[1:4]])
            elif linha.startswith('f '):
                idx = [int(t.split('/')[0]) for t in linha.split()[1:]]
                for i in range(1, len(idx) - 1):
                    F.append((base + idx[0] - 1, base + idx[i] - 1, base + idx[i + 1] - 1))
    return np.array(V), F


def desenhar(V, F, yaw=0.0, comp=1):
    a = math.radians(yaw)
    R = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    P = V @ R.T
    x, y = P[:, 0], P[:, 1]
    chao = max(0.0, y.min())  # o que fica abaixo do chão não aparece
    H = ALTURA_PX * 3  # desenha maior e reduz no fim (bordas suaves)
    s = (H - 4) / max(y.max() - chao, 1e-6)
    W = min(int((x.max() - x.min()) * s) + 4, H * 6)
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    X = (x - x.min()) * s + 2
    Y = H - 2 - (y - chao) * s
    for f in F:
        d.polygon([(X[i], Y[i]) for i in f], fill=255)
    # Tira linhas e pontos soltos.
    im = im.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    # Só a figura principal (armas e bichos parados longe do corpo saem).
    m = np.array(im) > 127
    lab, n = ndimage.label(m)
    if n > 1:
        tam = ndimage.sum(m, lab, range(1, n + 1))
        ordem = np.argsort(-tam)
        m = lab == (1 + int(ordem[min(comp, n) - 1]))
    im = Image.fromarray((m * 255).astype('uint8'))
    im = im.crop(im.getbbox())
    alt = ALTURA_PX
    larg = max(1, round(im.width * alt / im.height))
    im = im.resize((larg, alt), Image.LANCZOS)
    out = Image.new('RGBA', im.size, (255, 255, 255, 0))
    out.putalpha(im)
    return out


def de_imagem(caminho):
    """Silhueta a partir de um PNG: o que não é fundo vira figura."""
    im = Image.open(caminho).convert('RGBA')
    a = np.array(im)
    if (a[:, :, 3] < 250).mean() > 0.02:  # tem transparência: usa ela
        m = a[:, :, 3] > 100
    else:  # fundo de uma cor: a cor dos cantos, ligada às bordas
        rgb = a[:, :, :3].astype(int)
        cantos = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
        fundo = np.median(cantos, axis=0)
        parecido = np.abs(rgb - fundo).sum(axis=2) < 60
        lab, _ = ndimage.label(parecido)
        borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        m = ~np.isin(lab, list(borda))
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if n > 1:  # só a figura principal
        tam = ndimage.sum(m, lab, range(1, n + 1))
        m = lab == (1 + int(np.argmax(tam)))
    mask = Image.fromarray((m * 255).astype('uint8'))
    mask = mask.crop(mask.getbbox())
    larg = max(1, round(mask.width * ALTURA_PX / mask.height))
    mask = mask.resize((larg, ALTURA_PX), Image.LANCZOS)
    out = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    out.putalpha(mask)
    return out


def gerar(item):
    if item.get('imagem'):
        im = de_imagem(os.path.join(DADOS, item['imagem']))
        im.save(os.path.join(DADOS, 'silhuetas', f"{item['id']}.webp"), 'WEBP', quality=90)
        return item['id'], round(im.width / im.height, 4)
    objs, escondidas = pecas(item.get('modelo', item['id']))
    fora = {p.lower() for p in item.get('fora', [])}
    mais = {p.lower() for p in item.get('mais', [])}
    nome = lambda o: os.path.basename(o)[:-4].lower()
    usar = [o for o in objs if (nome(o) not in escondidas or nome(o) in mais) and nome(o) not in fora]
    V, F = ler_obj(usar)
    im = desenhar(V, F, item.get('yaw', 0), item.get('comp', 1))
    im.save(os.path.join(DADOS, 'silhuetas', f"{item['id']}.webp"), 'WEBP', quality=90)
    return item['id'], round(im.width / im.height, 4)


def main():
    itens = json.load(open(os.path.join(DADOS, 'itens.json'), encoding='utf-8'))
    so = set(sys.argv[1:])
    alvo = [i for i in itens if not so or i['id'] in so]
    os.makedirs(os.path.join(DADOS, 'silhuetas'), exist_ok=True)
    caminho = os.path.join(DADOS, 'silhuetas.json')
    props = json.load(open(caminho)) if os.path.exists(caminho) else {}
    with ThreadPoolExecutor(6) as ex:
        for ident, prop in ex.map(gerar, alvo):
            props[ident] = prop
            print(ident, prop)
    ids = {i['id'] for i in itens}
    props = {k: v for k, v in sorted(props.items()) if k in ids}
    json.dump(props, open(caminho, 'w'), indent=1)
    print(f'{len(alvo)} silhuetas geradas')


if __name__ == '__main__':
    main()
