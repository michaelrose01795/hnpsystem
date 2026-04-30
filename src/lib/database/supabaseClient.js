// file location: src/lib/database/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// CI / Playwright stub mode.
//
// When PLAYWRIGHT_TEST_AUTH=1 is set and either Supabase env vars are missing
// or set to obvious placeholder values, we build an in-memory stub client
// instead of a real one. This keeps smoke tests independent of a live
// Supabase database while still letting page render paths execute their
// normal query code (which now silently resolves to empty results).
//
// In any other environment (real dev, real prod, real CI with secrets) the
// module fails fast on missing env so a misconfigured deployment is loud
// rather than silently broken.
const PLACEHOLDER_URL_RE = /^https?:\/\/(placeholder|example|stub)\.supabase\.co\/?$/i;
const PLACEHOLDER_KEY_RE = /^(placeholder|stub|ci-).*/i;

const isStubEnv = (() => {
  if (process.env.PLAYWRIGHT_TEST_AUTH !== "1") return false;
  if (process.env.CI_DISABLE_SUPABASE_STUB === "1") return false;
  if (!supabaseUrl || !supabaseAnonKey) return true;
  if (PLACEHOLDER_URL_RE.test(supabaseUrl)) return true;
  if (PLACEHOLDER_KEY_RE.test(supabaseAnonKey)) return true;
  return false;
})();

const buildStubBuilder = () => {
  const builder = {};
  const chainable = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "gte", "lt", "lte",
    "like", "ilike", "is", "in", "contains", "containedBy",
    "rangeGt", "rangeGte", "rangeLt", "rangeLte", "rangeAdjacent",
    "overlaps", "match", "not", "or", "filter",
    "order", "limit", "range", "abortSignal", "returns",
    "textSearch", "explain",
  ];
  for (const m of chainable) builder[m] = () => builder;

  const emptyMany = { data: [], error: null, count: 0, status: 200, statusText: "OK" };
  const emptyOne = { data: null, error: null, count: 0, status: 200, statusText: "OK" };

  builder.single = async () => emptyOne;
  builder.maybeSingle = async () => emptyOne;
  builder.csv = async () => ({ data: "", error: null });
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(emptyMany).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve(emptyMany).catch(onRejected);
  builder.finally = (onFinally) => Promise.resolve(emptyMany).finally(onFinally);

  return builder;
};

const buildStubClient = () => ({
  from: () => buildStubBuilder(),
  rpc: () => buildStubBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
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
});

if (isStubEnv) {
  if (typeof window === "undefined") {
    console.warn(
      "[supabase] PLAYWRIGHT_TEST_AUTH=1 with no real Supabase credentials — using in-memory stub client. Set CI_DISABLE_SUPABASE_STUB=1 to opt out."
    );
  }
} else {
  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Set it in .env.local for local dev or in CI secrets, or set PLAYWRIGHT_TEST_AUTH=1 to use the stub client for tests."
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Set it in .env.local for local dev or in CI secrets, or set PLAYWRIGHT_TEST_AUTH=1 to use the stub client for tests."
    );
  }
}

const stubClient = isStubEnv ? buildStubClient() : null;

const createServiceRoleClient = () => {
  if (isStubEnv) return stubClient;
  if (!supabaseServiceKey) return null;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

const supabaseServiceRole =
  typeof window === "undefined" ? createServiceRoleClient() : null;

if (!isStubEnv && typeof window === "undefined" && !supabaseServiceRole) {
  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY is missing; using anon key on server. Check Vercel environment variables."
  );
}

export const supabaseService = supabaseServiceRole;

export const supabaseClient = isStubEnv
  ? stubClient
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

export const supabase = supabaseServiceRole || supabaseClient;

export default supabase;
