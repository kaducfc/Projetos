#!/usr/bin/env python3
"""Gera dados/campeoes.json a partir de scripts/campeoes.txt.

A ordem dos dias fica em "ordem": campeões que já estavam mantêm a posição,
os novos entram embaralhados no fim (a fila recomeça quando acaba).
Uso: python3 scripts/gerar.py
"""
import json, os, random, re

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', 'dados', 'campeoes.json')
CAMPOS = ['ano', 'genero', 'regioes', 'posicoes', 'classes', 'especies', 'alcance']
POSICOES = {'Top', 'Jungle', 'Mid', 'ADC', 'Suporte'}
# Nome do arquivo de imagem (id do Data Dragon) quando não é só tirar os símbolos.
IMG = {'Wukong': 'MonkeyKing', 'Renata Glasc': 'Renata', 'Nunu e Willump': 'Nunu', 'LeBlanc': 'Leblanc',
       "Bel'Veth": 'Belveth', "Cho'Gath": 'Chogath', "Kai'Sa": 'Kaisa', "Kha'Zix": 'Khazix', "Vel'Koz": 'Velkoz'}

def img_id(nome):
    return IMG.get(nome) or re.sub(r"[^A-Za-z]", '', nome)

def ler():
    out = []
    for linha in open(os.path.join(AQUI, 'campeoes.txt'), encoding='utf-8'):
        if not linha.strip() or linha.startswith('#'):
            continue
        c = [x.strip() for x in linha.split('|')]
        assert len(c) == 8, linha
        lista = lambda s: [x.strip() for x in s.split(',') if x.strip()]
        item = {
            'nome': c[0], 'img': img_id(c[0]), 'ano': int(c[1]), 'genero': c[2],
            'regioes': lista(c[3]), 'posicoes': lista(c[4]), 'classes': lista(c[5]),
            'especies': lista(c[6]), 'alcance': lista(c[7]),
        }
        assert set(item['posicoes']) <= POSICOES, (c[0], item['posicoes'])
        assert item['genero'] in ('M', 'F', 'Outro'), c[0]
        out.append(item)
    nomes = [x['nome'] for x in out]
    assert len(nomes) == len(set(nomes)), 'nome repetido'
    return out

def main():
    campeoes = ler()
    nomes = {c['nome'] for c in campeoes}
    antiga = json.load(open(SAIDA, encoding='utf-8'))['ordem'] if os.path.exists(SAIDA) else []
    ordem = [n for n in antiga if n in nomes]
    novos = sorted(nomes - set(ordem))
    random.Random(f'campeao-{len(ordem)}').shuffle(novos)
    ordem += novos
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    json.dump({'ordem': ordem, 'campeoes': sorted(campeoes, key=lambda c: c['nome'])},
              open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(campeoes)} campeões ({len(novos)} novos na fila)')

if __name__ == '__main__':
    main()
