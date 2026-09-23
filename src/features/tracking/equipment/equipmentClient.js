// file location: src/features/tracking/equipment/equipmentClient.js
//
// Browser-side calls to /api/tracking/equipment. The register list request is
// shared for a few seconds, so /tracking/Equipment-Tools can start it on mount
// and the panel picks the same promise up rather than fetching twice.

const BASE = "/api/tracking/equipment";

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "The equipment request failed.");
  }
  return payload;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

// /tracking/Equipment-Tools starts the list on mount, in parallel with the
// panel chunk, and the panel's own mount call must pick that request up —
// whichever of the two runs first (on a return visit the cached chunk mounts the
// panel before the page's effect). An in-flight request is always shared, and a
// finished one for a few seconds after it lands (the chunk can arrive after the
// data on a slow connection); a later visit fetches again.
const LIST_REUSE_MS = 5000;
let listPromise = null;
let listSettledAt = null; // null while the request is in flight

export function prefetchEquipmentList() {
  const stale = listSettledAt !== null && Date.now() - listSettledAt > LIST_REUSE_MS;
  if (!listPromise || stale) {
    listSettledAt = null;
    const pending = request(BASE).then(
      (payload) => {
        if (listPromise === pending) listSettledAt = Date.now();
        return payload;
      },
      (error) => {
        if (listPromise === pending) listPromise = null; // let the next caller retry
        throw error;
      }
    );
    listPromise = pending;
  }
  return listPromise;
}

export async function fetchEquipmentList({ force = false } = {}) {
  if (force) listPromise = null;
  return prefetchEquipmentList();
}

export const fetchEquipmentDetail = (reference) =>
  request(`${BASE}/${encodeURIComponent(reference)}`).then((payload) => payload.data);

export const saveEquipment = (asset) =>
  request(BASE, json(asset.id ? "PUT" : "POST", asset)).then((payload) => payload.data);

export const changeEquipmentStatus = (id, status, reason) =>
  request(`${BASE}/${encodeURIComponent(id)}`, json("PATCH", { status, reason })).then((payload) => payload.data);

export const logEquipmentChecks = (body) =>
  request(`${BASE}/checks`, json("POST", body)).then((payload) => payload.data);

export const reportEquipmentFault = (body) =>
  request(`${BASE}/faults`, json("POST", body)).then((payload) => payload.data);

export const updateEquipmentFault = (body) =>
  request(`${BASE}/faults`, json("PATCH", body)).then((payload) => payload.data);

export const saveEquipmentChecklist = (checklist) =>
  request(`${BASE}/checklists`, json("POST", checklist)).then((payload) => payload.data);

export function uploadEquipmentDocument({ equipmentId, file, docType, title, expiresAt, checkId, faultId }) {
  const form = new FormData();
  form.append("equipmentId", equipmentId);
  form.append("docType", docType || "other");
  if (title) form.append("title", title);
  if (expiresAt) form.append("expiresAt", expiresAt);
  if (checkId) form.append("checkId", checkId);
  if (faultId) form.append("faultId", faultId);
  form.append("file", file);
  return request(`${BASE}/documents`, { method: "POST", body: form }).then((payload) => payload.data);
}

export const openEquipmentDocument = (documentId, { download = false } = {}) =>
  request(`${BASE}/documents?id=${encodeURIComponent(documentId)}${download ? "&download=1" : ""}`).then(
    (payload) => payload.data.url
  );

export const removeEquipmentDocument = (documentId) =>
  request(`${BASE}/documents?id=${encodeURIComponent(documentId)}`, { method: "DELETE" });

// Upload several photos against a check or fault; failures are collected
// rather than thrown so one bad file never loses the check it belongs to.
export async function uploadEvidencePhotos(files = [], { equipmentId, checkId, faultId }) {
  const failures = [];
  for (const file of files) {
    try {
      await uploadEquipmentDocument({ equipmentId, file, docType: "photo", checkId, faultId });
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }
  }
  return failures;
}
