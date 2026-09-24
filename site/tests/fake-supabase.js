// Supabase falso em memória, com o subconjunto usado por shared/platform.js
// e as mesmas regras de acesso (cada conta só mexe nas próprias linhas).

export function createFakeSupabase() {
  const db = { site_profiles: [], site_game_saves: [], site_game_results: [] };
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
    async signOut() { session = null; fire('SIGNED_OUT'); return { error: null }; },
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
        const list = Array.isArray(q.rows) ? q.rows : [q.rows];
        if (list.some((r) => r.user_id !== uid)) return { data: null, error: { message: 'new row violates row-level security policy' } };
        const k = keys[table];
        for (const r of list) {
          const i = db[table].findIndex((x) => k.every((c) => x[c] === r[c]));
          if (i >= 0) { if (!q.opts.ignoreDuplicates) db[table][i] = { ...db[table][i], ...r }; } else db[table].push({ ...r });
        }
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
      then(res, rej) { return exec().then(res, rej); },
    };
    return b;
  }

  async function rpc(name, args) {
    if (name === 'site_username_available') {
      return { data: !db.site_profiles.some((p) => p.username.toLowerCase() === args.name.toLowerCase()), error: null };
    }
    return { data: null, error: { message: 'rpc desconhecida' } };
  }

  return { auth, from, rpc, db };
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
