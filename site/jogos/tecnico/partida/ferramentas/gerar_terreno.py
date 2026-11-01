#!/usr/bin/env python3
"""Gera a grade de navegação e a configuração normalizada do mapa.

Entrada : mapa-fonte.json (geometria em pixels, editável) + ../../img/mapa-sr.webp
Saída   : ../config/terreno.js (grade, RLE) e ../config/mapa.js (rotas, estruturas, acampamentos, normalizados 0-1)

Terreno: árvores (verde escuro) viram paredes automaticamente; rotas, bases, acampamentos, covis e o rio são
garantidos abertos; paredes de pedra e o limite do mapa são definidos no JSON. O resultado deve ser conferido
com a ferramenta de depuração (partida/depurar.html). Ferramenta de desenvolvimento: não roda no site.

Tipos de célula: 0 parede | 1 rota | 2 selva | 3 rio | 4 base | 5 acampamento | 6 covil
"""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(AQUI, 'mapa-fonte.json')))
W, H = SRC['imagem']['largura'], SRC['imagem']['altura']
C = SRC['celula']
GW, GH = math.ceil(W / C), math.ceil(H / C)
img = np.array(Image.open(os.path.normpath(os.path.join(AQUI, SRC['imagem']['arquivo']))).convert('RGB'))[..., ::-1].copy()
assert img.shape[1] == W and img.shape[0] == H, img.shape

# ------------------------------------------------------------------ árvores (parede automática)
f = cv2.GaussianBlur(img, (0, 0), 2).astype(np.float32)
b, g, r = f[..., 0], f[..., 1], f[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
tree = (g >= r * 0.95) & (g >= b * 1.05) & (lum < 64)
dark = lum < 38
agua = (b > r + 14) & (b >= g * 0.8) & (lum >= 30)
bloq = ((tree | dark) & ~agua).astype(np.uint8)
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
bloq = cv2.morphologyEx(bloq, cv2.MORPH_CLOSE, k)
bloq = cv2.morphologyEx(bloq, cv2.MORPH_OPEN, k)

def poly_mask(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m

def line_mask(pts, esp):
    m = np.zeros((H, W), np.uint8)
    cv2.polylines(m, [np.array(pts, np.int32)], False, 1, int(esp), cv2.LINE_8)
    return m

def circ_mask(c, r):
    m = np.zeros((H, W), np.uint8)
    cv2.circle(m, (int(c[0]), int(c[1])), int(r), 1, -1)
    return m

# ------------------------------------------------------------------ camadas em pixel
tipo = np.zeros((H, W), np.uint8)  # 0 parede
dentro = poly_mask(SRC['limite'])
aberto = ((bloq == 0) & (dentro == 1))
tipo[aberto] = 2
tipo[aberto & agua] = 3
# base
for lado, bs in SRC['bases'].items():
    m = poly_mask(bs['poligono']).astype(bool)
    tipo[m] = 4
# rotas
for nome, rt in SRC['rotas'].items():
    m = line_mask(rt['pts'], rt['largura']).astype(bool) & (dentro == 1)
    sel = m & (tipo != 4)
    tipo[sel] = 1
# acampamentos e covis (garante abertura)
for a in SRC['acampamentos']:
    m = circ_mask(a['pos'], a['raio']).astype(bool) & (dentro == 1)
    tipo[m & (tipo != 1) & (tipo != 4)] = 5
for c in SRC['covis']:
    m = circ_mask(c['pos'], c['raio']).astype(bool) & (dentro == 1)
    tipo[m & (tipo != 1) & (tipo != 4)] = 6
# ajustes manuais
for p in SRC['ajustes']['liberar']:
    tipo[poly_mask(p).astype(bool) & (dentro == 1) & (tipo == 0)] = 2
for p in SRC['ajustes']['bloquear']:
    tipo[poly_mask(p).astype(bool)] = 0
# paredes de pedra por cima de tudo (não cortam as rotas: elas só ficam fora das aberturas)
for p in SRC['paredes']:
    tipo[line_mask(p['pts'], p['espessura']).astype(bool)] = 0

# ------------------------------------------------------------------ grade (célula bloqueada se > 50% parede)
grade = np.zeros((GH, GW), np.uint8)
for cy in range(GH):
    for cx in range(GW):
        blk = tipo[cy * C:(cy + 1) * C, cx * C:(cx + 1) * C]
        if blk.size == 0:
            continue
        vals, cnt = np.unique(blk, return_counts=True)
        if cnt[vals == 0].sum() * 2 > blk.size:
            grade[cy, cx] = 0
        else:
            nz = [(c_, v_) for v_, c_ in zip(vals, cnt) if v_ != 0]
            # tipo predominante entre as células abertas, com prioridade para rota/base/covil/acampamento
            pri = {6: 5, 5: 4, 4: 3, 1: 2, 3: 1, 2: 0}
            grade[cy, cx] = max(nz, key=lambda t: (pri[t[1]] * 100000 + t[0]))[1]

# ------------------------------------------------------------------ conectividade: todo ponto de interesse alcançável
def vizinhos(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < GW and 0 <= ny < GH:
            yield nx, ny, (1.414 if dx and dy else 1.0)

def componentes():
    lab = np.zeros((GH, GW), np.int32); n = 0
    for y in range(GH):
        for x in range(GW):
            if grade[y, x] and not lab[y, x]:
                n += 1; pilha = [(x, y)]; lab[y, x] = n
                while pilha:
                    cx, cy = pilha.pop()
                    for nx, ny, _ in vizinhos(cx, cy):
                        if grade[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; pilha.append((nx, ny))
    return lab, n

import heapq
def abrir_corredor(origem, destino_lab, lab, alvo):
    """Dijkstra atravessando paredes (custo alto) até alcançar o componente principal; abre o caminho (3 células de largura)."""
    sx, sy = origem
    dist = {(sx, sy): 0.0}; prev = {}; fila = [(0.0, sx, sy)]
    while fila:
        d, x, y = heapq.heappop(fila)
        if d > dist.get((x, y), 1e18): continue
        if lab[y, x] == alvo:
            cam = []; cur = (x, y)
            while cur in prev: cam.append(cur); cur = prev[cur]
            return cam
        for nx, ny, w in vizinhos(x, y):
            custo = w * (1 if grade[ny, nx] else 7)
            nd = d + custo
            if nd < dist.get((nx, ny), 1e18):
                dist[(nx, ny)] = nd; prev[(nx, ny)] = (x, y); heapq.heappush(fila, (nd, nx, ny))
    return []

relatorio = []
lab, n = componentes()
# componente principal = o da rota do meio
mx, my = SRC['rotas']['meio']['pts'][3]
principal = lab[int(my // C), int(mx // C)]
pontos = [(a['id'], a['pos']) for a in SRC['acampamentos']] + [(c['id'], c['pos']) for c in SRC['covis']]
for pid, (px, py) in pontos:
    x, y = int(px // C), int(py // C)
    if lab[y, x] != principal:
        cam = abrir_corredor((x, y), None, lab, principal)
        for (cx, cy) in cam:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < GW and 0 <= ny < GH and grade[ny, nx] == 0 and dentro[min(ny * C, H - 1), min(nx * C, W - 1)]:
                        grade[ny, nx] = 2
        relatorio.append(f'{pid}: corredor aberto ({len(cam)} células)')
        lab, n = componentes()
        principal = lab[int(my // C), int(mx // C)]
# remove ilhas pequenas sem ponto de interesse
tam = np.bincount(lab.ravel())
for i in range(1, n + 1):
    if i != principal and tam[i] < 40:
        grade[lab == i] = 0
lab, n = componentes()
principal = lab[int(my // C), int(mx // C)]
tam = np.bincount(lab.ravel())
for i in range(1, n + 1):
    if i != principal and tam[i] >= 40:
        relatorio.append(f'AVISO: região aberta isolada #{i} com {tam[i]} células')
for nome, rt in SRC['rotas'].items():
    for (px, py) in rt['pts']:
        x, y = int(px // C), int(py // C)
        if not grade[y, x] or lab[y, x] != principal:
            relatorio.append(f'AVISO: ponto da rota {nome} em ({px},{py}) fora da região navegável principal')
for lado, bs in SRC['bases'].items():
    x, y = int(bs['nexus'][0] // C), int(bs['nexus'][1] // C)
    if lab[y, x] != principal: relatorio.append(f'AVISO: nexus {lado} isolado')

# ------------------------------------------------------------------ saídas
def rle(gr):
    out = []
    for y in range(GH):
        row = gr[y]; i = 0; parts = []
        while i < GW:
            j = i
            while j < GW and row[j] == row[i]: j += 1
            parts.append(f'{row[i]}{j - i}' if j - i > 1 else f'{row[i]}')
            i = j
        out.append(','.join(parts))
    return out

# a codificação usa "tipo:contagem" para evitar ambiguidade: cada token = tipo + 'x' + contagem
def rle2(gr):
    linhas = []
    for y in range(GH):
        row = gr[y]; i = 0; t = []
        while i < GW:
            j = i
            while j < GW and row[j] == row[i]: j += 1
            t.append(f'{row[i]}x{j - i}')
            i = j
        linhas.append(' '.join(t))
    return linhas

with open(os.path.join(AQUI, '..', 'config', 'terreno.js'), 'w') as fh:
    fh.write('// GERADO por ferramentas/gerar_terreno.py a partir de mapa-fonte.json e da imagem. Não edite à mão: edite o JSON e gere de novo.\n')
    fh.write('// Tipos de célula: 0 parede | 1 rota | 2 selva | 3 rio | 4 base | 5 acampamento | 6 covil\n')
    fh.write(f'export const TERRENO = {{ colunas: {GW}, linhas: {GH}, celulaPx: {C}, largura: {W}, altura: {H},\n  rle: [\n')
    fh.write(',\n'.join('    ' + json.dumps(l) for l in rle2(grade)))
    fh.write('\n  ] };\n')

def n(x, y): return [round(x / W, 5), round(y / H, 5)]
def lista(pts): return [n(*p) for p in pts]

def dist_ao_longo(pts, d):
    """ponto a `d` pixels do início da polilinha"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        if d <= seg:
            t = d / seg if seg else 0
            return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        d -= seg
    return pts[-1]

def comprimento(pts): return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))

estruturas = []
for nome, rt in SRC['rotas'].items():
    L = comprimento(rt['pts'])
    for t in SRC['estruturas']['torres']:
        if t['rota'] != nome: continue
        estruturas.append({'id': f'torre_{nome}_{t["nivel"]}_azul', 'tipo': 'torre', 'nivel': t['nivel'], 'rota': nome, 'equipe': 'azul', 'pos': n(*dist_ao_longo(rt['pts'], t['dist']))})
        estruturas.append({'id': f'torre_{nome}_{t["nivel"]}_vermelho', 'tipo': 'torre', 'nivel': t['nivel'], 'rota': nome, 'equipe': 'vermelho', 'pos': n(*dist_ao_longo(rt['pts'], L - t['dist']))})
    for ib in SRC['estruturas']['inibidores']:
        if ib['rota'] != nome: continue
        estruturas.append({'id': f'inibidor_{nome}_azul', 'tipo': 'inibidor', 'rota': nome, 'equipe': 'azul', 'pos': n(*dist_ao_longo(rt['pts'], ib['dist']))})
        estruturas.append({'id': f'inibidor_{nome}_vermelho', 'tipo': 'inibidor', 'rota': nome, 'equipe': 'vermelho', 'pos': n(*dist_ao_longo(rt['pts'], L - ib['dist']))})
for lado, bs in SRC['bases'].items():
    estruturas.append({'id': f'nexus_{lado}', 'tipo': 'nexus', 'equipe': lado, 'pos': n(*bs['nexus'])})
    for i, p in enumerate(bs['torresNexus']):
        estruturas.append({'id': f'torre_nexus_{i + 1}_{lado}', 'tipo': 'torre', 'nivel': 4, 'rota': 'nexus', 'equipe': lado, 'pos': n(*p)})

mapa = {
    'imagem': {'arquivo': 'img/mapa-sr.webp', 'largura': W, 'altura': H},
    'mundo': {'unidadesPorPixel': SRC['unidadesPorPixel'], 'largura': W * SRC['unidadesPorPixel'], 'altura': H * SRC['unidadesPorPixel']},
    'bases': {l: {'nexus': n(*b['nexus']), 'fonte': n(*b['fonte']), 'poligono': lista(b['poligono'])} for l, b in SRC['bases'].items()},
    'rotas': {k: {'nome': v['nome'], 'largura': round(v['largura'] / W, 5), 'pts': lista(v['pts']), 'comprimentoPx': round(comprimento(v['pts']))} for k, v in SRC['rotas'].items()},
    'estruturas': estruturas,
    'acampamentos': [{**{k: v for k, v in a.items() if k not in ('pos', 'raio')}, 'pos': n(*a['pos']), 'raio': round(a['raio'] / W, 5)} for a in SRC['acampamentos']],
    'covis': [{**{k: v for k, v in c.items() if k not in ('pos', 'raio')}, 'pos': n(*c['pos']), 'raio': round(c['raio'] / W, 5)} for c in SRC['covis']],
}
with open(os.path.join(AQUI, '..', 'config', 'mapa.js'), 'w') as fh:
    fh.write('// GERADO por ferramentas/gerar_terreno.py a partir de mapa-fonte.json. Coordenadas normalizadas: x e y de 0 a 1 sobre a imagem.\n')
    fh.write('export const MAPA = ' + json.dumps(mapa, ensure_ascii=False, indent=1) + ';\n')

print('terreno', GW, 'x', GH, '| células abertas:', int((grade > 0).sum()))
for l in relatorio: print(' ', l)
# imagem de conferência
ov = img.copy()
for cy in range(GH):
    for cx in range(GW):
        t = grade[cy, cx]
        cor = {0: (0, 0, 255), 1: (255, 200, 0), 2: (0, 200, 0), 3: (255, 120, 0), 4: (200, 200, 200), 5: (255, 0, 255), 6: (0, 255, 255)}[int(t)]
        y0, y1, x0, x1 = cy * C, min(H, (cy + 1) * C), cx * C, min(W, (cx + 1) * C)
        a = 0.55 if t == 0 else 0.25
        ov[y0:y1, x0:x1] = (ov[y0:y1, x0:x1] * (1 - a) + np.array(cor) * a).astype(np.uint8)
cv2.imwrite('/tmp/map/terreno_ov.png', ov)
