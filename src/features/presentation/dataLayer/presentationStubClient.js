// Chainable supabase-like client used when isPresentationMode() is true.
// Each call records a query descriptor; the terminator (.then, .single,
// .maybeSingle, await) calls into queryRouter to read from per-table mock
// data. Mirrors the Playwright stub shape in supabaseClient.js but routes
// through real per-table fixtures instead of always returning [].

import { routeSupabaseQuery } from "./queryRouter";

function buildBuilder({ table, op, payload }) {
  const descriptor = {
    table,
    op: op || "select",
    payload,
    filters: [],
    orderBy: [],
    limit: null,
    range: null,
    single: false,
    maybeSingle: false,
  };

  const builder = {};
  const passthrough = () => builder;

  // Read setters
  builder.select = (_cols, opts) => {
    if (opts && typeof opts === "object" && "count" in opts) descriptor.wantCount = opts.count;
    return builder;
  };

  // Write setters — capture payload and operation
  builder.insert = (rows) => { descriptor.op = "insert"; descriptor.payload = rows; return builder; };
  builder.update = (patch) => { descriptor.op = "update"; descriptor.payload = patch; return builder; };
  builder.upsert = (rows) => { descriptor.op = "upsert"; descriptor.payload = rows; return builder; };
  builder.delete = () => { descriptor.op = "delete"; return builder; };

  // Filters
  const filterOps = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "containedBy", "overlaps", "match", "filter"];
  for (const kind of filterOps) {
    builder[kind] = (column, value) => {
      descriptor.filters.push({ kind, column, value });
      return builder;
    };
  }
  builder.or = passthrough;
  builder.not = (column, opOrValue, value) => {
    descriptor.filters.push({ kind: "not", column, value: { op: opOrValue, value } });
    return builder;
  };
  builder.textSearch = passthrough;

  builder.order = (column, opts = {}) => {
    descriptor.orderBy.push({ column, ascending: opts.ascending !== false });
    return builder;
  };
  builder.limit = (n) => { descriptor.limit = n; return builder; };
  builder.range = (from, to) => { descriptor.range = [from, to]; return builder; };
  builder.abortSignal = passthrough;
  builder.returns = passthrough;
  builder.explain = passthrough;

  // Terminators
  builder.single = async () => { descriptor.single = true; return routeSupabaseQuery(descriptor); };
  builder.maybeSingle = async () => { descriptor.maybeSingle = true; return routeSupabaseQuery(descriptor); };
  builder.csv = async () => ({ data: "", error: null });

  // Thenable so `await supabase.from(...).select(...)` resolves
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(routeSupabaseQuery(descriptor)).then(onFulfilled, onRejected);
  builder.catch = (onRejected) =>
    Promise.resolve(routeSupabaseQuery(descriptor)).catch(onRejected);
  builder.finally = (onFinally) =>
    Promise.resolve(routeSupabaseQuery(descriptor)).finally(onFinally);

  return builder;
}

function getDemoIdentity() {
  if (typeof window === "undefined") return null;
  try {
    const key = window.sessionStorage.getItem("presentation:activeRoleKey");
    if (!key) return null;
    return { id: `demo-${key}`, email: `${key}@demo.hnp.example`, role: key };
  } catch {
    return null;
  }
}

export function buildPresentationStubClient() {
  return {
    from: (table) => buildBuilder({ table }),
    rpc: () => buildBuilder({ table: null }),
    auth: {
      getSession: async () => {
        const user = getDemoIdentity();
        return { data: { session: user ? { user } : null }, error: null };
      },
      getUser: async () => {
        const user = getDemoIdentity();
        return { data: { user }, error: null };
      },
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    channel: () => {
      const ch = {
        on: () => ch,
        subscribe: () => ({ unsubscribe: () => {} }),
        unsubscribe: () => {},
      };
      return ch;
    },
    removeChannel: () => {},
    removeAllChannels: () => {},
  };
}

let cached = null;
export function getPresentationStubClient() {
  if (!cached) cached = buildPresentationStubClient();
  return cached;
}
