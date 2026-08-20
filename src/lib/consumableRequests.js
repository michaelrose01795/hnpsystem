// Canonical request status and tracker-link helpers for consumable workflows.

const REQUEST_STATUS_ALIASES = {
  approved: "ordered",
  completed: "arrived",
  fulfilled: "arrived",
  received: "arrived",
};

export const normalizeConsumableKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, "");

export const normalizeConsumableRequestStatus = (value) => {
  const normalized = String(value || "pending").trim().toLowerCase();
  return REQUEST_STATUS_ALIASES[normalized] || normalized || "pending";
};

export function findConsumableForRequest(request, consumables = []) {
  if (!request) return null;

  if (request.consumableId) {
    const linked = consumables.find((item) => item.id === request.consumableId);
    if (linked) return linked;
  }

  const requestKey = normalizeConsumableKey(request.itemName || request.item_name);
  if (!requestKey) return null;
  const matches = consumables.filter((item) => normalizeConsumableKey(item.name) === requestKey);
  return matches.length === 1 ? matches[0] : null;
}

export function groupConsumableRequests(requests = [], consumables = []) {
  const groups = new Map();

  requests.forEach((request) => {
    const consumable = findConsumableForRequest(request, consumables);
    const nameKey = normalizeConsumableKey(request.itemName || request.item_name);
    const key = consumable?.id ? `consumable:${consumable.id}` : `name:${nameKey}`;
    if (!nameKey && !consumable?.id) return;

    const existing = groups.get(key) || {
      key,
      consumableId: consumable?.id || request.consumableId || null,
      itemName: consumable?.name || request.itemName || request.item_name,
      totalQuantity: 0,
      activeQuantity: 0,
      fulfilledQuantity: 0,
      requests: [],
      latestRequestAt: null,
    };
    const quantity = Number(request.quantity) || 0;
    const status = normalizeConsumableRequestStatus(request.status);

    existing.totalQuantity += quantity;
    if (["pending", "urgent", "ordered"].includes(status)) existing.activeQuantity += quantity;
    if (status === "arrived") existing.fulfilledQuantity += quantity;
    existing.requests.push({ ...request, status });

    const requestDate = request.requestedAt || request.requested_at;
    if (requestDate && (!existing.latestRequestAt || new Date(requestDate) > new Date(existing.latestRequestAt))) {
      existing.latestRequestAt = requestDate;
    }
    groups.set(key, existing);
  });

  return Array.from(groups.values()).sort(
    (a, b) => b.activeQuantity - a.activeQuantity || b.totalQuantity - a.totalQuantity
  );
}
