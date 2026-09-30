#!/usr/bin/env python3
"""Gera dados/times.json (times, jogadores, técnicos e OVRs) a partir de
dados-brutos/cblol-leaguepedia.json (Leaguepedia, CC BY-SA 3.0).

Cada "edição" é um split (fase de pontos + playoffs juntos). Cada time de
cada edição vira um time sorteável, com os jogadores por rota, reservas e
técnico. Uso: python3 scripts/gerar.py
"""
import collections, hashlib, json, math, os, re, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
ENTRADA = os.path.join(RAIZ, 'dados-brutos', 'cblol-leaguepedia.json')
SAIDA = os.path.join(AQUI, '..', 'dados', 'times.json')

ROLES = {'Top': 'top', 'Jungle': 'jungle', 'Mid': 'mid', 'Bot': 'adc', 'Support': 'sup'}

# Organizações que mudaram de nome: o dado bônus trata como o mesmo time.
ORG = {
    'Keyd Stars': 'Keyd', 'Vivo Keyd': 'Keyd', 'Vivo Keyd Stars': 'Keyd',
    'Flamengo Esports': 'Flamengo', 'Flamengo Los Grandes': 'Flamengo', 'Los Grandes': 'Flamengo',
    'Fluxo': 'Fluxo', 'Fluxo W7M': 'Fluxo',
    'FURIA': 'FURIA', 'FURIA Uppercut': 'FURIA',
    'INTZ': 'INTZ', 'INTZ Red': 'INTZ',
    'KaBuM! Esports': 'KaBuM!', 'KaBuM! Black': 'KaBuM!', 'KaBuM! Orange': 'KaBuM!',
    'Isurus': 'Isurus', 'Isurus Estral': 'Isurus',
    'Vorax': 'Liberty', 'Vorax Liberty': 'Liberty', 'Liberty': 'Liberty',
    'Netshoes Miners': 'Miners', 'Miners': 'Miners',
}

# Pesos de cada estatística por rota (somam 1; se faltar uma estatística
# naquele ano, os pesos das outras são redistribuídos).
PESOS = {
    'top':    {'wr': .25, 'kda': .20, 'kp': .15, 'csm': .15, 'dmg': .15, 'dth': .10},
    'jungle': {'wr': .25, 'kp': .25, 'kda': .20, 'obj': .15, 'dth': .10, 'vis': .05},
    'mid':    {'wr': .25, 'dmg': .20, 'kda': .20, 'kp': .15, 'csm': .15, 'dth': .05},
    'adc':    {'wr': .25, 'dmg': .20, 'kda': .20, 'csm': .15, 'ksh': .15, 'dth': .05},
    'sup':    {'wr': .25, 'kp': .25, 'vis': .15, 'apm': .15, 'kda': .10, 'dth': .10},
}
AMOSTRA = 6  # jogos: com poucos jogos o desempenho é puxado para a média

def limpa(nome):
    return re.sub(r'\s*\(.*?\)\s*$', '', nome or '').strip()

def chave_nome(nome):
    """Mesma pessoa com grafias diferentes (TaeYeon/Taeyeon, Céos/Ceos) vira uma chave só."""
    sem_acento = unicodedata.normalize('NFD', nome).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', sem_acento.lower())

# Mesma grafia (ignorando maiúsculas), mas pessoas diferentes: não juntar.
NOMES_SEPARADOS = {'stepz'}  # Stepz (ADC 2020) ≠ STEPZ (jungle 2026)

def estavel(*partes):
    """Número estável 0..1 a partir de um texto (mesmo resultado a cada geração)."""
    h = hashlib.md5('|'.join(map(str, partes)).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF

def edicao_de(page):
    base = re.sub(r'(/| )Playoffs$', '', page)
    ano = int(re.search(r'(20\d\d)', base).group(1))
    rot = base.split('/')[-1].replace(' Season', '')
    rot = {'Champions Series': 'Split único', 'Regional Finals': 'Final Regional', 'Post-Season': 'Pós-temporada', 'Cup': 'Copa'}.get(rot, rot)
    liga = 'LTA Sul' if base.startswith('LTA South') else 'CBLOL'
    return base, ano, f'{liga} {ano} · {rot}'

def main():
    d = json.load(open(ENTRADA, encoding='utf-8'))
    pages = [t['OverviewPage'] for t in d['torneios']]
    ed = {p: edicao_de(p) for p in pages if re.search(r'20(1[4-9]|2\d)', p)}

    # Grafia oficial de cada pessoa: a mais usada nos jogos (depois nos elencos).
    grafias = collections.defaultdict(collections.Counter)
    for r in d['jogadores']:
        n = limpa(r['Link'] or r['Name'])
        grafias[chave_nome(n)][n] += 1000
    for e in d['elencos']:
        for n in (e['RosterLinks'] or '').split(';;'):
            n = limpa(n)
            if n:
                grafias[chave_nome(n)][n] += 1
    canon = {c: g.most_common(1)[0][0] for c, g in grafias.items()}

    def nome_de(n):
        n = limpa(n)
        c = chave_nome(n)
        return n if not n or c in NOMES_SEPARADOS else canon.get(c, n)

    # ---------------------------------------------------------------- jogos
    jogo = {g['GameId']: g for g in d['jogos']}
    # Totais do time por jogo (abates e dano), calculados das linhas dos jogadores.
    tot = collections.defaultdict(lambda: {'k': 0, 'dmg': 0, 'n': 0})
    for r in d['jogadores']:
        t = tot[(r['GameId'], r['Team'])]
        t['k'] += r['Kills'] or 0
        t['dmg'] += r['DamageToChampions'] or 0
        t['n'] += 1

    def objetivos(g, team):
        lado = '1' if g['Team1'] == team else '2'
        vals = [g.get(f'Team{lado}{k}') for k in ('Dragons', 'Barons', 'Heralds', 'Grubs')]
        if vals[0] is None:
            return None
        return (vals[0] or 0) + 2 * (vals[1] or 0) + (vals[2] or 0) + 0.3 * (vals[3] or 0)

    # --------------------------------------------------- estatísticas por jogador
    acc = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in d['jogadores']:
        if r['OverviewPage'] not in ed or r['Role'] not in ROLES:
            continue
        base = ed[r['OverviewPage']][0]
        key = (base, r['Team'], nome_de(r['Link'] or r['Name']), ROLES[r['Role']])
        a = acc[key]
        g = jogo.get(r['GameId'], {})
        mins = g.get('Gamelength') or 30
        t = tot[(r['GameId'], r['Team'])]
        a['n'] += 1
        a['w'] += 1 if r['PlayerWin'] == 'Yes' else 0
        a['k'] += r['Kills'] or 0
        a['d'] += r['Deaths'] or 0
        a['a'] += r['Assists'] or 0
        a['min'] += mins
        a['tk'] += t['k']
        if r['CS'] is not None:
            a['cs'] += r['CS']; a['cs_min'] += mins
        if r['DamageToChampions'] is not None and t['dmg']:
            a['dmg'] += r['DamageToChampions']; a['tdmg'] += t['dmg']
        if r['VisionScore'] is not None:
            a['vis'] += r['VisionScore']; a['vis_min'] += mins
        o = objetivos(g, r['Team']) if g else None
        if o is not None:
            a['obj'] += o; a['obj_n'] += 1

    def metricas(a):
        m = {
            'wr': a['w'] / a['n'],
            'kda': (a['k'] + a['a']) / max(1, a['d']),
            'kp': (a['k'] + a['a']) / a['tk'] if a['tk'] else None,
            'ksh': a['k'] / a['tk'] if a['tk'] else None,
            'dth': -a['d'] / a['n'],
            'apm': a['a'] / a['min'],
            'csm': a['cs'] / a['cs_min'] if a['cs_min'] else None,
            'dmg': a['dmg'] / a['tdmg'] if a['tdmg'] else None,
            'vis': a['vis'] / a['vis_min'] if a['vis_min'] else None,
            'obj': a['obj'] / a['obj_n'] if a['obj_n'] else None,
        }
        return {k: v for k, v in m.items() if v is not None}

    M = {k: metricas(a) for k, a in acc.items()}

    # Normalização: diferença para a média da rota na mesma edição (eras
    # comparáveis), dividida pelo desvio dessas diferenças em toda a história.
    por_ed_role = collections.defaultdict(list)
    for (base, team, name, role), m in M.items():
        if acc[(base, team, name, role)]['n'] >= 3:
            por_ed_role[(base, role)].append(m)
    media = {}
    for key, lista in por_ed_role.items():
        media[key] = {s: sum(m[s] for m in lista if s in m) / max(1, sum(1 for m in lista if s in m))
                      for s in {s for m in lista for s in m}}
    difs = collections.defaultdict(list)
    for (base, team, name, role), m in M.items():
        if acc[(base, team, name, role)]['n'] < 3:
            continue
        for s, v in m.items():
            ref = media.get((base, role), {}).get(s)
            if ref is not None:
                difs[(role, s)].append(v - ref)
    desvio = {k: (sum(x * x for x in v) / len(v)) ** 0.5 or 1 for k, v in difs.items()}

    def score(key):
        base, team, name, role = key
        m = M[key]
        pesos = {s: w for s, w in PESOS[role].items() if s in m and s in media.get((base, role), {})}
        tot_w = sum(pesos.values())
        if not tot_w:
            return 0.0
        z = sum(w * (m[s] - media[(base, role)][s]) / desvio[(role, s)] for s, w in pesos.items()) / tot_w
        n = acc[key]['n']
        return z * n / (n + AMOSTRA)

    # O score combinado tem desvio menor que 1 (média de várias estatísticas):
    # padroniza por rota para a escala de OVR ficar parecida em todas.
    brutos = collections.defaultdict(list)
    for key in M:
        if acc[key]['n'] >= 3:
            brutos[key[3]].append(score(key))
    esc_role = {r: (sum(v) / len(v), (sum(x * x for x in v) / len(v) - (sum(v) / len(v)) ** 2) ** 0.5 or 1) for r, v in brutos.items()}

    def z_final(key):
        mu, sd = esc_role[key[3]]
        return (score(key) - mu) / sd

    # ---------------------------------------------------------------- colocações
    lugar = {}
    for c in d['colocacoes']:
        if c['OverviewPage'] not in ed or not c['PlaceNumber']:
            continue
        base = ed[c['OverviewPage']][0]
        k = (base, c['Team'])
        # Nos playoffs a colocação vale mais que a da fase de pontos.
        playoff = c['OverviewPage'] != base
        atual = lugar.get(k)
        if atual is None or (playoff and not atual[1]) or (playoff == atual[1] and c['PlaceNumber'] < atual[0]):
            lugar[k] = (c['PlaceNumber'], playoff)

    # OVR: média 75; ~90% entre 62 e 89. Acima de 92 e abaixo de 60 a escala
    # comprime, então 95+ e 55- só para quem ficou muito longe da média.
    def ovr_de(s, bonus=0):
        v = 75 + 8.5 * s + bonus
        if v > 92: v = 92 + (v - 92) * 0.5
        if v > 95: v = 95 + (v - 95) * 0.35
        if v < 60: v = 60 - (60 - v) * 0.5
        return max(50, min(98, round(v)))

    # ---------------------------------------------------------------- times
    elencos = collections.defaultdict(lambda: {'pessoas': [], 'tecnicos': []})
    for e in d['elencos']:
        if e['OverviewPage'] not in ed:
            continue
        base = ed[e['OverviewPage']][0]
        el = elencos[(base, e['Team'])]
        for link, role in zip((e['RosterLinks'] or '').split(';;'), (e['Roles'] or '').split(';;')):
            link = nome_de(link)
            if not link:
                continue
            prim = role.split(',')[0].strip()
            if prim == 'Coach':
                if link not in el['tecnicos']:
                    el['tecnicos'].append(link)
            elif prim in ROLES and (link, ROLES[prim]) not in el['pessoas']:
                el['pessoas'].append((link, ROLES[prim]))

    times = []
    teams_ed = sorted({(k[0], k[1]) for k in acc} | set(elencos))
    for base, team in teams_ed:
        if base not in {v[0] for v in ed.values()}:
            continue
        _, ano, rotulo = next(v for v in ed.values() if v[0] == base)
        jogs = {}
        for key, a in acc.items():
            if key[0] == base and key[1] == team:
                jogs[(key[2], key[3])] = {'nome': key[2], 'rota': key[3], 'jogos': int(a['n']), 's': z_final(key)}
        for link, role in elencos.get((base, team), {'pessoas': []})['pessoas']:
            jogs.setdefault((link, role), {'nome': link, 'rota': role, 'jogos': 0, 's': None})
        if not jogs:
            continue
        # Quem jogou em mais de uma rota no split aparece uma vez só: na rota
        # em que mais jogou (a outra só fica se for a única opção da rota).
        for nome in {j['nome'] for j in jogs.values()}:
            entradas = sorted((j for j in jogs.values() if j['nome'] == nome), key=lambda j: -j['jogos'])
            for extra in entradas[1:]:
                if any(j['rota'] == extra['rota'] and j['nome'] != nome for j in jogs.values()):
                    del jogs[(extra['nome'], extra['rota'])]
        place = lugar.get((base, team), (None, False))[0]
        bonus = {1: 2, 2: 1}.get(place, 0)
        # Titular de cada rota: quem mais jogou.
        tit = {}
        for j in jogs.values():
            if j['rota'] not in tit or j['jogos'] > tit[j['rota']]['jogos']:
                tit[j['rota']] = j
        for j in jogs.values():
            if j['s'] is not None:
                j['ovr'] = ovr_de(j['s'], bonus)
        for j in jogs.values():
            if j['s'] is None:  # reserva que não jogou: um pouco abaixo do titular
                ref = tit.get(j['rota'], {}).get('ovr', 70)
                j['ovr'] = max(50, ref - 4 - int(estavel(base, team, j['nome']) * 5))
        if len(tit) < 5:
            continue
        jogos_time = sum(1 for g in d['jogos'] if g['OverviewPage'] in ed and ed[g['OverviewPage']][0] == base and team in (g['Team1'], g['Team2']))
        vit_time = sum(1 for g in d['jogos'] if g['OverviewPage'] in ed and ed[g['OverviewPage']][0] == base and g['WinTeam'] == team)
        wr = vit_time / jogos_time if jogos_time else 0.5
        tecnicos = elencos.get((base, team), {'tecnicos': []})['tecnicos']
        n_times = len({t for (b, t) in teams_ed if b == base})
        if place:
            frac = (place - 1) / max(1, n_times - 1)
            coach = 90 - 25 * frac
        else:
            coach = 72
        coach = max(55, min(95, round(coach + (wr - 0.5) * 10)))
        pessoas = sorted(jogs.values(), key=lambda j: (list(ROLES.values()).index(j['rota']), -j['jogos']))
        times.append({
            'id': f"{base}|{team}",
            'time': team, 'org': ORG.get(team, team), 'ano': ano, 'edicao': rotulo, 'ordem': base,
            'colocacao': place, 'vitorias': vit_time, 'jogos': jogos_time,
            'jogadores': [{'nome': j['nome'], 'rota': j['rota'], 'ovr': j['ovr'], 'jogos': j['jogos'],
                           'titular': tit.get(j['rota']) is j} for j in pessoas],
            'tecnico': {'nome': tecnicos[0], 'ovr': coach} if tecnicos else None,
        })

    for t in times:
        tit = [j['ovr'] for j in t['jogadores'] if j['titular']]
        t['ovr'] = round(sum(tit) / len(tit), 1)
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    json.dump({'fonte': d['fonte'], 'times': times}, open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    todos = [j['ovr'] for t in times for j in t['jogadores'] if j['jogos'] >= 3]
    todos.sort()
    q = lambda p: todos[int(p * (len(todos) - 1))]
    print(f"{len(times)} times, {sum(len(t['jogadores']) for t in times)} jogadores, "
          f"{sum(1 for t in times if t['tecnico'])} com técnico")
    print(f"OVR (quem jogou 3+): min {todos[0]} p5 {q(.05)} p25 {q(.25)} p50 {q(.5)} p75 {q(.75)} p95 {q(.95)} max {todos[-1]}")
    print(f"acima de 95: {sum(1 for x in todos if x > 95)} · abaixo de 55: {sum(1 for x in todos if x < 55)} de {len(todos)}")

if __name__ == '__main__':
    main()
