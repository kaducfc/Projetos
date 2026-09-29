#!/usr/bin/env python3
"""Gera os dados do jogo da palavra.

- dados/palavras.json: as respostas, na ordem dos dias. Palavras já
  existentes mantêm a posição; as novas entram embaralhadas no fim.
- dados/dicionario.txt: palavras aceitas como tentativa (português comum,
  5 a 10 letras), além das palavras do jogo.

Uso: python3 scripts/gerar.py [caminho/words.json do pacote an-array-of-portuguese-words]
O dicionário só é refeito quando o caminho do words.json é informado
(npm pack an-array-of-portuguese-words; licença MIT).
"""
import json, os, random, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, '..', 'dados')
MIN, MAX = 5, 10
TOP_FREQUENTES = 110_000  # palavras mais comuns da lista (o fim tem muito ruído)

# Termos do universo aceitos como tentativa, mas que não viram resposta.
SO_TENTATIVA = ['MasterYi', 'XinZhao', 'LeeSin', 'DrMundo', 'TahmKench', 'Yunara', 'JarvanIV',
                'Hextech', 'Worlds', 'Baron', 'Dragon', 'Poros', 'Lobos', 'Raptores', 'Arauto']

def chave(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in s.upper() if 'A' <= c <= 'Z')

def ler_palavras():
    out = []
    for linha in open(os.path.join(AQUI, 'palavras.txt'), encoding='utf-8'):
        linha = linha.strip()
        if not linha or linha.startswith('#'):
            continue
        nome, cat = [x.strip() for x in linha.split('|')]
        k = chave(nome)
        assert MIN <= len(k) <= MAX, f'{nome}: {len(k)} letras'
        out.append({'palavra': nome, 'chave': k, 'categoria': cat})
    chaves = [p['chave'] for p in out]
    dup = {k for k in chaves if chaves.count(k) > 1}
    assert not dup, f'repetidas: {dup}'
    return out

def main():
    os.makedirs(DADOS, exist_ok=True)
    novas = ler_palavras()
    caminho = os.path.join(DADOS, 'palavras.json')
    antigas = json.load(open(caminho, encoding='utf-8'))['respostas'] if os.path.exists(caminho) else []
    por_chave = {p['chave']: p for p in novas}
    ordem = [por_chave.get(p['chave'], p) for p in antigas]  # mantém as já sorteadas
    vistas = {p['chave'] for p in ordem}
    resto = [p for p in novas if p['chave'] not in vistas]
    random.Random(f'rift-{len(ordem)}').shuffle(resto)
    ordem += resto
    json.dump({'respostas': ordem, 'extras': sorted({chave(x) for x in SO_TENTATIVA if MIN <= len(chave(x)) <= MAX})},
              open(caminho, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'{len(ordem)} respostas ({len(resto)} novas)')

    if len(sys.argv) > 1:
        lista = json.load(open(sys.argv[1], encoding='utf-8'))[:TOP_FREQUENTES]
        vistos, palavras = set(), []
        for w in lista:
            w = w.strip().lower()
            if not w.isalpha():
                continue
            k = chave(w)
            if not (MIN <= len(k) <= MAX) or k in vistos:
                continue
            vistos.add(k)
            palavras.append(w)
        palavras.sort(key=chave)
        open(os.path.join(DADOS, 'dicionario.txt'), 'w', encoding='utf-8').write('\n'.join(palavras) + '\n')
        from collections import Counter
        print('dicionário:', len(palavras), dict(sorted(Counter(len(chave(w)) for w in palavras).items())))

if __name__ == '__main__':
    main()
