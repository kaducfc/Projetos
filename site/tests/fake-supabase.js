// Supabase falso em memória, com o subconjunto usado por shared/platform.js
// e as mesmas regras de acesso (cada conta só mexe nas próprias linhas).

export function createFakeSupabase() {
  const db = { site_profiles: [], site_game_saves: [], site_game_results: [], site_events: [], site_ranked: [] };
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
    if (name === 'site_set_avatar') {
      const me = db.site_profiles.find((p) => p.id === auth._uid());
      if (args.icone && !/^(mascote|champ:[A-Za-z]{2,20})$/.test(args.icone)) return { data: null, error: { message: 'invalid_avatar' } };
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
    // Ranqueada simplificada: as 3 primeiras carreiras de hoje (pela ordem de
    // chegada) valem; o elo vem de db.site_ranked.
    if (name === 'site_ranked_meu') {
      const uid = auth._uid();
      if (!uid) return { data: null, error: { message: 'not_authenticated' } };
      const hoje = new Date().toISOString().slice(0, 10);
      const validas = db.site_game_results.filter((r) => r.user_id === uid && r.game_id === 'carreira-no-rift'
        && r.score != null && String(r.played_at).slice(0, 10) === hoje).slice(0, 3);
      const melhor = validas.length ? Math.max(...validas.map((r) => r.score)) : null;
      const meu = db.site_ranked.find((r) => r.user_id === uid);
      return {
        data: {
          elo: meu?.elo || 'bronze', jogou: Boolean(meu || validas.length), temporada: 1,
          hoje: { dia: hoje, partidas: validas.length, melhor, validas: validas.map((r) => r.client_id) },
          ciclo: { numero: 0, inicio: hoje, fim: hoje, atualiza: hoje, dias: [{ dia: hoje, melhor }], media: (melhor || 0) / 3 },
          proximo: { elo: 'prata', media: 500 }, desafiantes: 0, vagas: 100, historico: [],
        },
        error: null,
      };
    }
    if (name === 'site_ranking') {
      if (!['diario', 'semanal', 'mensal'].includes(args.periodo)) return { data: null, error: { message: 'periodo_invalido' } };
      const pts = new Map();
      for (const r of db.site_game_results.filter((x) => x.game_id === 'carreira-no-rift' && x.score != null)) {
        pts.set(r.user_id, Math.max(pts.get(r.user_id) || 0, r.score));
      }
      const lista = [...pts].sort((a, b) => b[1] - a[1]).map(([id, p], i) => ({
        pos: i + 1, username: db.site_profiles.find((x) => x.id === id)?.username, avatar: null,
        elo: db.site_ranked.find((x) => x.user_id === id)?.elo || 'bronze', pontos: p, dias: 1, eu: id === auth._uid(),
      }));
      const hoje = new Date().toISOString().slice(0, 10);
      return { data: { periodo: args.periodo, inicio: hoje, fim: hoje, jogadores: lista.length, lista, eu: lista.find((x) => x.eu) || null }, error: null };
    }
    if (name === 'site_is_admin') return { data: auth._uid() === 'user-admin', error: null };
    if (name === 'site_admin_stats') {
      if (auth._uid() !== 'user-admin') return { data: null, error: { message: 'not_admin' } };
      return { data: { dias: args.days, eventos: db.site_events.length }, error: null };
    }
    return { data: null, error: { message: 'rpc desconhecida' } };
  }

  return { auth, from, rpc, db, stats };
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
