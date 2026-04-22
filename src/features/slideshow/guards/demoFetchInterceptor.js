// Installs a window.fetch wrapper while the slideshow is active so that
// Supabase REST calls and /api/* requests are answered with canned demo data
// instead of reaching the real backend. When uninstalled, the original fetch
// is restored.

let originalFetch = null;

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body ?? []), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function routeSupabaseRest(url, data) {
  // URL shape: {supabaseUrl}/rest/v1/{table}?...
  const match = url.match(/\/rest\/v1\/([^?#/]+)/);
  if (!match) return jsonResponse([]);
  const table = match[1];
  switch (table) {
    case "jobs":
    case "job_cards":
    case "service_jobs":
      return jsonResponse(data.jobs);
    case "customers":
      return jsonResponse(data.customers);
    case "vehicles":
      return jsonResponse(data.vehicles);
    case "parts":
    case "parts_requests":
    case "parts_orders":
      return jsonResponse(data.parts);
    case "appointments":
      return jsonResponse(data.appointments);
    default:
      return jsonResponse([]);
  }
}

function routeApi(url, data) {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  if (path.includes("/jobs") || path.includes("/job-cards")) return jsonResponse(data.jobs);
  if (path.includes("/customers")) return jsonResponse(data.customers);
  if (path.includes("/vehicles")) return jsonResponse(data.vehicles);
  if (path.includes("/parts")) return jsonResponse(data.parts);
  if (path.includes("/appointments")) return jsonResponse(data.appointments);
  return jsonResponse([]);
}

export function installDemoFetchInterceptor(data) {
  if (typeof window === "undefined") return;
  if (originalFetch) return; // already installed
  originalFetch = window.fetch.bind(window);

  window.fetch = async function demoFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";

    if (url.includes("/rest/v1/") || url.includes("supabase.co")) {
      return routeSupabaseRest(url, data);
    }
    if (url.startsWith("/api/") || url.includes("/api/")) {
      return routeApi(url, data);
    }
    // Static asset / NextJS internal — allow through.
    return originalFetch(input, init);
  };
}

export function uninstallDemoFetchInterceptor() {
  if (typeof window === "undefined") return;
  if (!originalFetch) return;
  window.fetch = originalFetch;
  originalFetch = null;
}
