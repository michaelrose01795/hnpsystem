// file location: src/features/websiteManager/websiteApi.js
//
// Thin client-side fetch wrapper for the /api/website/* endpoints used by the
// staff Website Manager. Keeps the UI free of fetch boilerplate and centralises
// the error-handling pattern (toast / console — currently console only).

const json = async (res, label) => {
  let payload = null;
  try {
    payload = await res.json();
  } catch (_) {
    // ignore parse failures - we'll fall through to the !ok check below
  }
  if (!res.ok || payload?.success === false) {
    const message = payload?.message || `${label} failed (${res.status})`;
    // eslint-disable-next-line no-console
    console.error(`[websiteApi] ${label}:`, message);
    throw new Error(message);
  }
  return payload?.data ?? null;
};

/* ----------------------- content (bundle) ---------------------- */

export const fetchWebsiteContent = async () => {
  const res = await fetch("/api/website/content", { credentials: "same-origin" });
  return json(res, "GET /api/website/content");
};

/* ----------------------- sections (per-section CRUD) ----------- */

export const fetchSection = async (section) => {
  const res = await fetch(`/api/website/sections/${section}`, {
    credentials: "same-origin",
  });
  return json(res, `GET /api/website/sections/${section}`);
};

export const patchSingleton = async (section, body) => {
  const res = await fetch(`/api/website/sections/${section}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return json(res, `PATCH /api/website/sections/${section}`);
};

export const createRow = async (section, row) => {
  const res = await fetch(`/api/website/sections/${section}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(row),
  });
  return json(res, `POST /api/website/sections/${section}`);
};

export const patchRow = async (section, id, body) => {
  const res = await fetch(`/api/website/sections/${section}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return json(res, `PATCH /api/website/sections/${section}/${id}`);
};

export const deleteRowApi = async (section, id) => {
  const res = await fetch(`/api/website/sections/${section}/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  return json(res, `DELETE /api/website/sections/${section}/${id}`);
};

export const reorderSection = async (section, ids) => {
  const res = await fetch(`/api/website/sections/${section}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ids }),
  });
  return json(res, `POST /api/website/sections/${section}/reorder`);
};

/* ----------------------- pages ---------------------------------- */

export const fetchPages = async () => {
  const res = await fetch("/api/website/pages", { credentials: "same-origin" });
  return json(res, "GET /api/website/pages");
};

export const setPageStatusApi = async (pageKey, status) => {
  const res = await fetch(`/api/website/pages/${pageKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  return json(res, `PATCH /api/website/pages/${pageKey}`);
};

/* ----------------------- SEO ------------------------------------ */

export const fetchSeo = async () => {
  const res = await fetch("/api/website/seo", { credentials: "same-origin" });
  return json(res, "GET /api/website/seo");
};

export const updateSeoApi = async (pageKey, patch) => {
  const res = await fetch(`/api/website/seo/${pageKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(patch),
  });
  return json(res, `PATCH /api/website/seo/${pageKey}`);
};

/* ----------------------- media ---------------------------------- */

export const fetchMedia = async () => {
  const res = await fetch("/api/website/media", { credentials: "same-origin" });
  return json(res, "GET /api/website/media");
};

export const saveMedia = async (asset) => {
  const res = await fetch("/api/website/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(asset),
  });
  return json(res, "POST /api/website/media");
};

export const deleteMediaApi = async (id) => {
  const res = await fetch(`/api/website/media/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  return json(res, `DELETE /api/website/media/${id}`);
};

/* ----------------------- activity log --------------------------- */

export const fetchActivity = async () => {
  const res = await fetch("/api/website/activity", { credentials: "same-origin" });
  return json(res, "GET /api/website/activity");
};
