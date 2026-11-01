#!/usr/bin/env python3
"""Gera supabase/migrations/0017_diarios_dados.sql com as respostas do
Runetermo (jogos/runetermo/dados/palavras.json) e os campeões do Campeão
Oculto (jogos/campeao/dados/campeoes.json), para o servidor sortear e conferir.

Uso: python3 supabase/scripts/gerar_diarios_dados.py  (depois rode o .sql gerado no Supabase)
"""
import json, os

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', '..')
q = lambda s: "'" + str(s).replace("'", "''") + "'"

pal = json.load(open(os.path.join(SITE, 'jogos/runetermo/dados/palavras.json'), encoding='utf-8'))['respostas']
camp = json.load(open(os.path.join(SITE, 'jogos/campeao/dados/campeoes.json'), encoding='utf-8'))['campeoes']
CHAVES = ['ano', 'genero', 'regioes', 'posicoes', 'classes', 'especies', 'alcance']

linhas = [
    '-- GERADO por supabase/scripts/gerar_diarios_dados.py: não edite à mão.',
    '-- Respostas do Runetermo e campeões do Campeão Oculto (para o servidor).',
    '-- Como aplicar: cole no SQL Editor do Supabase e clique em Run (depois do 0016).',
    '-- Rodar de novo atualiza a lista; palavras que saíram deixam de ser sorteadas.',
    '',
    'begin;',
    'delete from public.site_diario_palavras;',
    'insert into public.site_diario_palavras (chave, palavra, categoria) values',
    ',\n'.join(f"  ({q(p['chave'])}, {q(p['palavra'])}, {q(p['categoria'])})" for p in pal) + ';',
    'delete from public.site_diario_campeoes;',
    'insert into public.site_diario_campeoes (nome, dados) values',
    ',\n'.join(f"  ({q(c['nome'])}, {q(json.dumps({k: c[k] for k in CHAVES}, ensure_ascii=False))}::jsonb)" for c in camp) + ';',
    'commit;',
    '',
]
saida = os.path.join(SITE, 'supabase/migrations/0017_diarios_dados.sql')
open(saida, 'w', encoding='utf-8').write('\n'.join(linhas))
print(f'{len(pal)} palavras, {len(camp)} campeões → {saida}')
