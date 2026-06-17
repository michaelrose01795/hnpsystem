// file location: src/lib/database/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { getPresentationStubClient } from "@/features/presentation/dataLayer/presentationStubClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Wraps a real Supabase client so that, when /presentation/* routes are
// active, every property access (.from, .rpc, .auth, .storage, .channel)
// routes to the in-memory presentation stub instead. Real (non-presentation)
// routes are unaffected — the Proxy resolves to the real client on each call,
// so there is no cross-contamination between mock and live data. This avoids
// having to rewrite the 27 files under src/lib/database/* that already do
// `const supabase = getDatabaseClient(); await supabase.from(...)...`.
function wrapWithPresentationProxy(realClient) {
  if (!realClient) return realClient;
  return new Proxy(realClient, {
    get(target, prop, receiver) {
      if (isPresentationMode()) {
        const stub = getPresentationStubClient();
        const value = stub[prop];
        if (typeof value === "function") return value.bind(stub);
        return value;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") return value.bind(target);
      return value;
    },
  });
}

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

// Network resilience wrapper.
//
// Some environments (notably local dev behind antivirus/firewall TLS
// inspection or a flaky link) have a slow, unreliable outbound HTTPS path:
// TLS handshakes intermittently take many seconds or fail outright with
// `TypeError: fetch failed` before any response is received. Each page fires
// many sequential Supabase queries, so a single dropped connection surfaces as
// a 500. We wrap fetch so that:
//   1. Each attempt has a hard timeout — a hung connection fails fast and is
//      retried instead of stalling 30s+ behind the default socket timeout.
//   2. Transient connection failures are retried with exponential backoff.
//      Connectivity itself works (calls succeed, just slowly), so a retry
//      almost always lands.
// We only retry idempotent requests (GET/HEAD). A write (POST/PATCH/DELETE)
// that throws may have reached the server before the response was lost, so it
// is never retried automatically — the caller's error handling stays in charge.
const FETCH_ATTEMPT_TIMEOUT_MS = 15000;
const FETCH_MAX_RETRIES = 2;
const FETCH_RETRY_BASE_DELAY_MS = 300;

const isRetriableMethod = (method) => {
  const m = String(method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resilientFetch = async (input, init = {}) => {
  const method =
    init?.method || (typeof input === "object" && input?.method) || "GET";
  const maxAttempts = isRetriableMethod(method) ? FETCH_MAX_RETRIES + 1 : 1;
  const callerSignal = init?.signal;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort(callerSignal.reason);
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    const timer = setTimeout(
      () => controller.abort(new Error("Supabase fetch timed out")),
      FETCH_ATTEMPT_TIMEOUT_MS
    );

    try {
      // Any HTTP response (including 4xx/5xx) is a success at the transport
      // layer — only thrown errors (network failure / abort) are retried.
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      // Caller-initiated abort: propagate immediately, never retry.
      if (callerSignal?.aborted) throw error;
      if (attempt === maxAttempts - 1) break;
      await delay(FETCH_RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }

  throw lastError;
};

const createServiceRoleClient = () => {
  if (isStubEnv) return stubClient;
  if (!supabaseServiceKey) return null;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { fetch: resilientFetch },
  });
};

const supabaseServiceRole =
  typeof window === "undefined" ? createServiceRoleClient() : null;

if (!isStubEnv && typeof window === "undefined" && !supabaseServiceRole) {
  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY is missing; using anon key on server. Check Vercel environment variables."
  );
}

export const supabaseService = wrapWithPresentationProxy(supabaseServiceRole);

const rawSupabaseClient = isStubEnv
  ? stubClient
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: { fetch: resilientFetch },
    });

export const supabaseClient = wrapWithPresentationProxy(rawSupabaseClient);

export const supabase = wrapWithPresentationProxy(supabaseServiceRole || rawSupabaseClient);

export default supabase;
