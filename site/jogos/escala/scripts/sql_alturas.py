#!/usr/bin/env python3
"""Gera o SQL com as alturas da Escala para o servidor (ranqueada).

A nota da ranqueada é calculada no Supabase com as alturas de lá, então
toda vez que dados/itens.json mudar, gere um SQL novo e rode no Supabase:

  python3 scripts/sql_alturas.py ../../supabase/migrations/00XX_escala_alturas.sql

Pode rodar de novo quantas vezes quiser: ele substitui a tabela inteira.
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
itens = json.load(open(os.path.join(AQUI, '..', 'dados', 'itens.json'), encoding='utf-8'))
q = lambda s: "'" + str(s).replace("'", "''") + "'"
linhas = ',\n'.join(f"  ({q(i['id'])}, {q(i['nome'])}, {i['altura']})" for i in itens)
sql = f"""-- Alturas do Na Medida (gerado por jogos/escala/scripts/sql_alturas.py
-- a partir de jogos/escala/dados/itens.json). Pode rodar de novo sem problema.
begin;
delete from public.site_escala_itens;
insert into public.site_escala_itens (id, nome, altura) values
{linhas};
commit;
"""
destino = sys.argv[1] if len(sys.argv) > 1 else None
if destino:
    open(destino, 'w', encoding='utf-8').write(sql)
    print(f'{len(itens)} itens → {destino}')
else:
    print(sql)
