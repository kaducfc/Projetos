// Supabase falso em memória, com o subconjunto usado por shared/platform.js
// e as mesmas regras de acesso (cada conta só mexe nas próprias linhas).

function avaliarPalavra(chute, resposta) {
  const g = [...chute];
  const a = [...resposta];
  const res = g.map(() => 'miss');
  const sobra = {};
  a.forEach((ch, i) => { if (g[i] === ch) res[i] = 'ok'; else sobra[ch] = (sobra[ch] || 0) + 1; });
  g.forEach((ch, i) => { if (res[i] !== 'ok' && sobra[ch]) { res[i] = 'near'; sobra[ch]--; } });
  return res;
}

export function createFakeSupabase() {
  // Contas administradoras (o teste pode incluir outras com admins.add(id)).
  const admins = new Set(['user-admin']);
  const fakeInicios = new Map(); // carreiras ranqueadas começadas hoje, por conta
  const db = { site_profiles: [], site_game_saves: [], site_game_results: [], site_events: [], site_ranked: [], site_apoios: [], site_rk: [], site_rk_lanc: [], site_rk_dia: [], site_diario: {}, diarioRespostas: { runetermo: 'GROMP', campeao: 'Ahri' } };
  // Contagem de gravações e falha simulada (servidor ocupado).
  const stats = { upserts: 0, failNextUpserts: 0 };
  const users = [];
  const callbacks = [];
  let session = null;
  let seq = 0;
  const fire = (event) => callbacks.forEach((cb) => cb(event, session));

  const auth = {
    async getSession() { return { data: { session } }; },
    onAuthStateChange(cb) { callbacks.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async signUp({ email, password, options }) {
      if (users.some((u) => u.email === email)) return { data: {}, error: { message: 'User already registered' } };
      const user = { id: `user-${++seq}`, email, password, user_metadata: options?.data || {} };
      users.push(user);
      if (user.user_metadata.username) db.site_profiles.push({ id: user.id, username: user.user_metadata.username });
      session = { user };
      fire('SIGNED_IN');
      return { data: { user, session }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) return { data: {}, error: { message: 'Invalid login credentials' } };
      session = { user };
      fire('SIGNED_IN');
      return { data: { user, session }, error: null };
    },
    _uid: () => session?.user?.id,
    async signOut() { session = null; fire('SIGNED_OUT'); return { error: null }; },
    oauthRequests: [],
    async signInWithOAuth(args) { auth.oauthRequests.push(args); return { data: {}, error: null }; },
    // Simula a volta do Google: conta nova, sem nome de usuário.
    googleReturn({ email, full_name }) {
      let user = users.find((u) => u.email === email);
      if (!user) {
        user = { id: `user-${++seq}`, email, password: null, user_metadata: { full_name } };
        users.push(user);
      }
      session = { user };
      fire('SIGNED_IN');
    },
    resetRequests: [],
    async resetPasswordForEmail(email, opts) { auth.resetRequests.push({ email, ...opts }); return { data: {}, error: null }; },
    async updateUser({ password }) {
      if (!session) return { data: {}, error: { message: 'Auth session missing!' } };
      if (session.user.password === password) {
        return { data: {}, error: { message: 'New password should be different from the old password.' } };
      }
      session.user.password = password;
      return { data: { user: session.user }, error: null };
    },
  };

  const keys = { site_game_saves: ['user_id', 'game_id'], site_game_results: ['user_id', 'client_id'], site_profiles: ['id'] };

  function from(table) {
    const q = { op: 'select', filters: [], order: null, limit: null, rows: null, opts: {} };
    const exec = async () => {
      const uid = session?.user?.id;
      let rows = db[table];
      const match = (r) => q.filters.every(([c, v]) => r[c] === v);
      if (q.op === 'select') {
        rows = rows.filter(match);
        if (table !== 'site_profiles') rows = rows.filter((r) => r.user_id === uid);
        if (q.order) {
          const [col, asc] = q.order;
          rows = rows.slice().sort((a, b) => (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1));
        }
        if (q.limit != null) rows = rows.slice(0, q.limit);
        return { data: q.single ? rows[0] ?? null : rows.map((r) => ({ ...r })), error: null };
      }
      if (q.op === 'upsert') {
        stats.upserts++;
        if (stats.failNextUpserts > 0) {
          stats.failNextUpserts--;
          return { data: null, error: { message: 'upstream request timeout' } };
        }
        const list = Array.isArray(q.rows) ? q.rows : [q.rows];
        if (list.some((r) => r.user_id !== uid)) return { data: null, error: { message: 'new row violates row-level security policy' } };
        const k = keys[table];
        for (const r of list) {
          const i = db[table].findIndex((x) => k.every((c) => x[c] === r[c]));
          if (i >= 0) { if (!q.opts.ignoreDuplicates) db[table][i] = { ...db[table][i], ...r }; } else db[table].push({ ...r });
        }
        return { data: null, error: null };
      }
      if (q.op === 'insert') {
        // Como no banco: qualquer um insere eventos, com o próprio id (ou nenhum).
        const list = Array.isArray(q.rows) ? q.rows : [q.rows];
        for (const r of list) db[table].push({ ...r, user_id: session?.user?.id ?? null });
        return { data: null, error: null };
      }
      if (q.op === 'delete') {
        db[table] = db[table].filter((r) => !(match(r) && r.user_id === uid));
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'op desconhecida' } };
    };
    const b = {
      select() { return b; },
      eq(c, v) { q.filters.push([c, v]); return b; },
      order(c, { ascending = true } = {}) { q.order = [c, ascending]; return b; },
      limit(n) { q.limit = n; return b; },
      maybeSingle() { q.single = true; return exec(); },
      upsert(rows, opts = {}) { q.op = 'upsert'; q.rows = rows; q.opts = opts; return b; },
      delete() { q.op = 'delete'; return b; },
      insert(rows) { q.op = 'insert'; q.rows = rows; return b; },
      then(res, rej) { return exec().then(res, rej); },
    };
    return b;
  }

  async function rpc(name, args) {
    if (name === 'site_username_available') {
      return { data: !db.site_profiles.some((p) => p.username.toLowerCase() === args.name.toLowerCase()), error: null };
    }
    if (name === 'site_claim_username') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      if (db.site_profiles.some((p) => p.id === uid)) return { data: null, error: { message: 'already_has_username' } };
      if (db.site_profiles.some((p) => p.username.toLowerCase() === args.name.toLowerCase())) {
        return { data: null, error: { message: 'username_taken' } };
      }
      db.site_profiles.push({ id: uid, username: args.name });
      return { data: args.name, error: null };
    }
    if (name === 'site_change_username') {
      const uid = auth._uid();
      const me = db.site_profiles.find((p) => p.id === uid);
      if (!me) return { data: null, error: { message: 'no_profile' } };
      const outro = me.username.toLowerCase() !== args.name.toLowerCase();
      if (outro && me.username_changed_at && Date.now() - Date.parse(me.username_changed_at) < 2 * 864e5) {
        return { data: null, error: { message: 'username_cooldown' } };
      }
      if (outro && db.site_profiles.some((p) => p.id !== uid && p.username.toLowerCase() === args.name.toLowerCase())) {
        return { data: null, error: { message: 'username_taken' } };
      }
      me.username = args.name;
      if (outro) me.username_changed_at = new Date().toISOString();
      return { data: args.name, error: null };
    }
    if (name === 'site_meus_selos') {
      const me = db.site_profiles.find((p) => p.id === auth._uid());
      const apoiador = (me?.apoio_total || 0) > 0;
      return { data: { apoiador, pioneiro: apoiador, posicao: apoiador ? 1 : null }, error: null };
    }
    if (name === 'site_pioneiros_vagas') return { data: 100 - db.site_profiles.filter((p) => p.apoio_total > 0).length, error: null };
    if (name === 'site_set_avatar') {
      const me = db.site_profiles.find((p) => p.id === auth._uid());
      if (args.icone && !/^(mascote|icone:[a-z0-9-]{2,30})$/.test(args.icone)) return { data: null, error: { message: 'invalid_avatar' } };
      if (['icone:apoiador', 'icone:pioneiro'].includes(args.icone) && !((me.apoio_total || 0) > 0)) return { data: null, error: { message: 'icone_bloqueado' } };
      me.avatar = args.icone;
      return { data: args.icone, error: null };
    }
    if (name === 'site_delete_account') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      users.splice(users.findIndex((u) => u.id === uid), 1);
      for (const t of ['site_profiles', 'site_game_saves', 'site_game_results']) {
        db[t] = db[t].filter((r) => (r.id ?? r.user_id) !== uid);
      }
      return { data: null, error: null };
    }
    // Ranqueada (PDR) simplificada: a escada vem de db.site_rk (o teste
    // monta), os PDR de hoje de db.site_rk_dia e db.site_rk_lanc.
    const ELO_IDS = ['ferro', 'bronze', 'prata', 'ouro', 'platina', 'esmeralda', 'diamante', 'mestre', 'grao-mestre', 'desafiante'];
    const eloDe = (r) => (!r ? 'ferro' : r.pts >= 2100 ? (r.topo || 'mestre') : ELO_IDS[Math.floor(r.pts / 300)]);
    const hojeIso = new Date().toISOString().slice(0, 10);
    if (name === 'site_rk_eu') {
      const r = db.site_rk.find((x) => x.user_id === auth._uid());
      return { data: r ? { elo: eloDe(r), nivel: ELO_IDS.indexOf(eloDe(r)), pts: r.pts } : null, error: null };
    }
    if (name === 'site_rk_iniciar') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      const k = `${uid}|${args.jogo}`;
      fakeInicios.set(k, (fakeInicios.get(k) || 0) + 1);
      const n = fakeInicios.get(k);
      if (n > 5) return { data: { token: null, dia: hojeIso, numero: null, restantes: 0, limite: 5 }, error: null };
      return { data: { token: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, dia: hojeIso, numero: n, restantes: 5 - n, limite: 5 }, error: null };
    }
    if (name === 'site_rk_meu') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      const r = db.site_rk.find((x) => x.user_id === uid);
      const hoje = db.site_rk_dia.filter((x) => x.user_id === uid && x.dia === hojeIso);
      const jogos = {};
      for (const x of hoje) {
        const j = jogos[x.jogo] || (jogos[x.jogo] = { pdr: 0, base: x.base, partidas: 0 });
        j.pdr += x.pdr; j.base = Math.max(j.base, x.base); j.partidas++;
      }
      const vagas = {};
      for (const j of ['carreira-no-rift', 'cblol']) vagas[j] = Math.min(5, fakeInicios.get(`${uid}|${j}`) || 0);
      return {
        data: {
          temporada: 1, jogou: Boolean(r), pts: r?.pts || 0, elo: eloDe(r), nivel: ELO_IDS.indexOf(eloDe(r)),
          posicao_topo: r && r.pts >= 2100 ? 1 : null, ultima_atividade: r?.ultima_atividade || hojeIso,
          hoje: {
            dia: hojeIso,
            pdr: db.site_rk_lanc.filter((x) => x.user_id === uid && x.dia === hojeIso).reduce((t, x) => t + x.delta, 0),
            jogos, vagas,
            partidas: hoje.map((x, i) => ({ jogo: x.jogo, n: x.n ?? 1, pdr: x.pdr, base: x.base, client_id: x.client_id ?? null })),
            validas: db.site_game_results.filter((x) => x.user_id === uid && x.summary?.ranked).map((x) => x.client_id),
          },
          cortes: { desafiante: null, grao_mestre: null, desafiantes: 0, grao_mestres: 0 },
          historico: db.site_rk_lanc.filter((x) => x.user_id === uid).slice().reverse(),
        },
        error: null,
      };
    }
    if (name === 'site_rk_ranking') {
      if (!['geral', 'diario', 'semanal', 'mensal'].includes(args.periodo)) return { data: null, error: { message: 'periodo_invalido' } };
      let linhas = db.site_rk.map((r) => ({ r, valor: args.periodo === 'geral' ? r.pts
        : db.site_rk_lanc.filter((x) => x.user_id === r.user_id).reduce((t, x) => t + x.delta, 0) }));
      if (args.periodo === 'geral' && args.elo) linhas = linhas.filter((x) => eloDe(x.r) === args.elo);
      linhas.sort((a, b) => b.valor - a.valor);
      const lista = linhas.map(({ r, valor }, i) => {
        const p = db.site_profiles.find((x) => x.id === r.user_id);
        return { pos: i + 1, username: p?.username, avatar: p?.avatar || null, apoiador: (p?.apoio_total || 0) > 0, elo: eloDe(r), pts: r.pts, valor, eu: r.user_id === auth._uid() };
      });
      return { data: { periodo: args.periodo, elo: args.elo || null, inicio: hojeIso, fim: hojeIso, jogadores: lista.length, lista, eu: lista.find((x) => x.eu) || null }, error: null };
    }
    if (name === 'site_rk_resetar') {
      if (!admins.has(auth._uid())) return { data: null, error: { message: 'not_admin' } };
      const n = db.site_rk.length;
      db.site_rk = [];
      return { data: { jogadores_zerados: n, inicio: hojeIso, temporada: args.nova_temporada }, error: null };
    }
    // Escala na ranqueada: rodadas em db.escalaRodadas ([{ref, alvo}]) e
    // alturas em db.escalaAlturas ({id: metros}); o teste escolhe.
    if (name === 'site_escala_abrir' || name === 'site_escala_palpite') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      db.site_escala = db.site_escala || {};
      let e = db.site_escala[uid];
      const json = () => ({
        dia: hojeIso, status: e.status, atual: e.atual, limite: 60, restante: e.status === 'jogando' ? 30 : null,
        media: e.media ?? null, base: e.base ?? null, pdr: e.pdr ?? null,
        rodadas: e.rodadas.filter((_, i) => i <= e.atual).map((r, i) => (i < e.atual
          ? { ref: r.ref, alvo: r.alvo, ref_altura: db.escalaAlturas[r.ref], alvo_altura: db.escalaAlturas[r.alvo], palpite: r.palpite, pontos: r.pontos, esgotou: false }
          : { ref: r.ref, alvo: r.alvo })),
      });
      if (name === 'site_escala_abrir') {
        if (!e) {
          if (!args.comecar) return { data: null, error: null };
          e = db.site_escala[uid] = { status: 'jogando', atual: 0, rodadas: db.escalaRodadas.map((r) => ({ ...r })) };
        }
        return { data: json(), error: null };
      }
      if (!e) return { data: null, error: { message: 'sem_partida' } };
      if (e.status !== 'jogando' || args.rodada !== e.atual) return { data: null, error: { message: 'rodada_encerrada' } };
      // db.escalaAtrasar = true simula a resposta chegando atrasada (1ª vez: recomeça).
      if (db.escalaAtrasar && !e.reinicios) {
        db.escalaAtrasar = false;
        e.reinicios = 1;
        e.rodadas[e.atual] = { ref: 'garen', alvo: 'braum' };
        return { data: { ...json(), reiniciada: true }, error: null };
      }
      const r = e.rodadas[e.atual];
      const ref = db.escalaAlturas[r.ref];
      const alvo = db.escalaAlturas[r.alvo];
      r.palpite = Math.round(args.razao * ref * 1000) / 1000;
      const razao = Math.max(ref, alvo) / Math.min(ref, alvo);
      r.pontos = Math.round(100 * Math.max(0, 1 - Math.abs(Math.log(r.palpite / alvo)) / (Math.log(3) * (1 + 0.35 * Math.log(razao)))));
      e.atual += 1;
      if (e.atual >= 5) {
        e.status = 'terminou';
        e.media = e.rodadas.reduce((t, x) => t + x.pontos, 0) / 5;
        e.base = e.media >= 45 ? Math.round(5 + (e.media - 45) * 33 / 55) : -Math.round(2 + (45 - e.media) * 23 / 45);
        e.pdr = e.base;
        db.site_rk_dia.push({ user_id: uid, dia: hojeIso, jogo: 'escala', pdr: e.pdr, base: e.base });
        db.site_rk_lanc.push({ user_id: uid, dia: hojeIso, jogo: 'escala', motivo: 'partida', delta: e.pdr });
      }
      return { data: json(), error: null };
    }
    if (name === 'site_diario_hoje') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      const out = {};
      for (const [k, d] of Object.entries(db.site_diario)) {
        if (!k.startsWith(`${uid}|`)) continue;
        out[d.jogo] = { status: d.status, chutes: d.chutes.length, tentativas: d.chutes.length + (d.jogo === 'campeao' ? d.dicas.length : 0), pdr: d.pdr ?? null };
      }
      const e = db.site_escala?.[uid];
      if (e) out.escala = { status: e.status, rodadas: e.atual, media: e.media ?? null, pdr: e.pdr ?? null };
      return { data: out, error: null };
    }
    // Jogos diários conferidos no "servidor": a resposta vem de
    // db.diarioRespostas (o teste escolhe) e o PDR é o de tabela.
    if (name === 'site_diario_abrir' || name === 'site_diario_chute' || name === 'site_diario_dica') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      const jogo = name === 'site_diario_dica' ? 'campeao' : args.jogo;
      const k = `${uid}|${jogo}`;
      let d = db.site_diario[k];
      if (!d) {
        if (name !== 'site_diario_abrir') return { data: null, error: { message: 'sem_partida' } };
        d = db.site_diario[k] = { jogo, resposta: db.diarioRespostas[jogo], chutes: [], dicas: [], status: 'novo', max: jogo === 'runetermo' ? 6 : 8 };
      }
      const fim = () => ['ganhou', 'perdeu'].includes(d.status);
      if (name === 'site_diario_chute') {
        if (fim()) return { data: null, error: { message: 'partida_encerrada' } };
        const c = jogo === 'runetermo' ? String(args.chute).toUpperCase() : args.chute;
        if (d.chutes.includes(c) && jogo === 'campeao') return { data: null, error: { message: 'chute_repetido' } };
        d.chutes.push(c);
        d.status = 'jogando';
        if (c === d.resposta) d.status = 'ganhou';
        else if (d.chutes.length + d.dicas.length >= d.max) d.status = 'perdeu';
        if (fim()) d.pdr = d.status === 'ganhou' ? [35, 28, 22, 16, 11, 6][d.chutes.length - 1] : -20;
      }
      if (name === 'site_diario_dica') {
        if (fim() || d.dicas.length >= 1) return { data: null, error: { message: 'sem_dica' } };
        d.dicas.push('genero');
        d.status = 'jogando';
      }
      const avaliar = (c) => (jogo === 'runetermo' ? avaliarPalavra(c, d.resposta) : Array.from({ length: 7 }, () => ({ state: c === d.resposta ? 'ok' : 'miss' })));
      return {
        data: {
          jogo, status: d.status, tamanho: jogo === 'runetermo' ? d.resposta.length : undefined, max_tentativas: d.max, max_dicas: 1,
          pdr: d.pdr ?? null, categoria: null,
          chutes: d.chutes.map((c) => ({ chute: c, resultado: avaliar(c) })),
          dicas: d.dicas.map((key) => ({ key, valor: 'F' })),
          resposta: fim() ? (jogo === 'runetermo' ? { chave: d.resposta, palavra: d.resposta } : { nome: d.resposta }) : null,
        },
        error: null,
      };
    }
    if (name === 'site_is_admin') return { data: admins.has(auth._uid()), error: null };
    if (name === 'site_admin_stats') {
      if (!admins.has(auth._uid())) return { data: null, error: { message: 'not_admin' } };
      return { data: { dias: args.days, eventos: db.site_events.length }, error: null };
    }
    if (name === 'site_admin_ranked') {
      if (!admins.has(auth._uid())) return { data: null, error: { message: 'not_admin' } };
      return { data: { dias: args.days, partidas: db.site_ranked_partidas || [], banidos: db.site_ranked_banidos || [] }, error: null };
    }
    if (name === 'site_admin_ranked_anular' || name === 'site_admin_ranked_banir') {
      if (!admins.has(auth._uid())) return { data: null, error: { message: 'not_admin' } };
      if (name === 'site_admin_ranked_anular') {
        db.site_ranked_partidas = (db.site_ranked_partidas || []).filter((x) => x.id !== args.partida);
        return { data: { anuladas: 1 }, error: null };
      }
      const p = db.site_profiles.find((x) => x.username.toLowerCase() === args.nome.toLowerCase());
      if (!p) return { data: null, error: { message: 'user_not_found' } };
      db.site_ranked_banidos = (db.site_ranked_banidos || []).filter((b) => b.username !== p.username);
      if (args.banir) {
        db.site_ranked_banidos.push({ username: p.username, motivo: args.motivo, criado: new Date().toISOString() });
        db.site_ranked_partidas = (db.site_ranked_partidas || []).filter((x) => x.username !== p.username);
      }
      return { data: { username: args.nome, banido: args.banir }, error: null };
    }
    // Painel de apoio simplificado (mesmo formato do 0009_painel_apoio.sql).
    if (name === 'site_admin_apoios') {
      if (!admins.has(auth._uid())) return { data: null, error: { message: 'not_admin' } };
      const quanto = (a) => Number(a.valor_pago ?? a.valor);
      const desde = Date.now() - args.days * 864e5;
      const nome = (id) => db.site_profiles.find((p) => p.id === id)?.username ?? null;
      const ok = db.site_apoios.filter((a) => a.status === 'aprovado');
      const per = db.site_apoios.filter((a) => Date.parse(a.criado) >= desde);
      const okp = per.filter((a) => a.status === 'aprovado');
      const soma = (l) => l.reduce((s, a) => s + quanto(a), 0);
      const resumo = (l) => ({ arrecadado: soma(l), doacoes: l.length, apoiadores: new Set(l.map((a) => a.user_id)).size,
        ticket_medio: l.length ? soma(l) / l.length : null, maior: l.length ? Math.max(...l.map(quanto)) : null });
      const status = {};
      for (const a of per) status[a.status] = (status[a.status] || 0) + 1;
      const porUser = new Map();
      for (const a of ok) porUser.set(a.user_id, [...(porUser.get(a.user_id) || []), a]);
      const dia = (k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10);
      return {
        data: {
          dias: args.days,
          total: { ...resumo(ok), estornado: soma(db.site_apoios.filter((a) => a.status === 'estornado')) },
          hoje: { arrecadado: soma(ok.filter((a) => a.criado.slice(0, 10) === dia(0))), doacoes: ok.filter((a) => a.criado.slice(0, 10) === dia(0)).length },
          periodo: { ...resumo(okp), novos: 0, tentativas: per.length, conversao_pct: null, status, origem: {}, faixas: [] },
          por_dia: Array.from({ length: args.days }, (_, i) => {
            const d = dia(args.days - 1 - i);
            const l = ok.filter((a) => a.criado.slice(0, 10) === d);
            return { dia: d, valor: soma(l), doacoes: l.length };
          }),
          top: [...porUser].map(([id, l]) => ({ username: nome(id), avatar: null, total: soma(l), doacoes: l.length,
            desde: l[0].criado, ultima: l.at(-1).criado })).sort((a, b) => b.total - a.total),
          lista: per.slice().sort((a, b) => b.criado.localeCompare(a.criado)).map((a) => ({ ...a, username: nome(a.user_id) })),
        },
        error: null,
      };
    }
    return { data: null, error: { message: 'rpc desconhecida' } };
  }

  // Edge Functions: só a apoio-criar (devolve um link de pagamento falso).
  const functions = {
    async invoke(nome, { body } = {}) {
      if (nome !== 'apoio-criar') return { data: null, error: { message: 'função desconhecida' } };
      if (!auth._uid()) return { data: { erro: 'nao_logado' }, error: { message: 'non-2xx' } };
      if (!(body?.valor >= 5 && body?.valor <= 1000)) return { data: { erro: 'valor_invalido' }, error: { message: 'non-2xx' } };
      return { data: { url: `https://mercadopago.test/checkout?valor=${body.valor}`, apoio: 'a1' }, error: null };
    },
  };

  return { auth, from, rpc, db, stats, functions, admins };
}

// localStorage em memória para rodar no Node.
export function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return globalThis.localStorage;
}
