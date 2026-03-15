// file location: src/lib/prePickLocations.js

export const normalizePrePickLocation = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeLinkedPartRow = (row = {}, resolveCanonicalVhcId = null) => {
  const rawVhcItemId =
    row?.vhcItemId ??
    row?.vhc_item_id ??
    null;
  const resolvedVhcItemId =
    typeof resolveCanonicalVhcId === "function" && rawVhcItemId !== null && rawVhcItemId !== undefined
      ? resolveCanonicalVhcId(rawVhcItemId)
      : rawVhcItemId;

  return {
    id: row?.id ?? null,
    requestId:
      row?.allocatedToRequestId ??
      row?.allocated_to_request_id ??
      row?.requestId ??
      row?.request_id ??
      null,
    vhcItemId: resolvedVhcItemId ?? null,
    prePickLocation: normalizePrePickLocation(
      row?.prePickLocation ??
      row?.pre_pick_location ??
      null
    ),
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
  };
};

export const collectLinkedPartRows = ({
  parts = [],
  requestId = null,
  vhcItemId = null,
  resolveCanonicalVhcId = null,
} = {}) => {
  const normalizedRequestId =
    requestId === null || requestId === undefined || requestId === ""
      ? null
      : String(requestId).trim();
  const normalizedVhcItemId = normalizePrePickLocation(
    typeof resolveCanonicalVhcId === "function" ? resolveCanonicalVhcId(vhcItemId) : vhcItemId
  );

  const rows = Array.isArray(parts) ? parts : [];
  const seen = new Set();

  return rows
    .map((row) => normalizeLinkedPartRow(row, resolveCanonicalVhcId))
    .filter((row) => {
      const rowRequestId =
        row.requestId === null || row.requestId === undefined || row.requestId === ""
          ? null
          : String(row.requestId).trim();
      const rowVhcItemId = normalizePrePickLocation(row.vhcItemId);
      const matchesRequest = normalizedRequestId && rowRequestId === normalizedRequestId;
      const matchesVhc = normalizedVhcItemId && rowVhcItemId === normalizedVhcItemId;
      return Boolean(matchesRequest || matchesVhc);
    })
    .filter((row) => {
      const key = row.id !== null && row.id !== undefined ? `id:${row.id}` : `link:${row.requestId || ""}:${row.vhcItemId || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const resolveLinkedPrePickLocation = ({
  linkedPartRows = [],
  fallbackValues = [],
} = {}) => {
  const rowsWithLocation = (Array.isArray(linkedPartRows) ? linkedPartRows : [])
    .filter((row) => normalizePrePickLocation(row?.prePickLocation))
    .sort((left, right) => toTimestamp(right?.updatedAt) - toTimestamp(left?.updatedAt));

  if (rowsWithLocation.length > 0) {
    return normalizePrePickLocation(rowsWithLocation[0].prePickLocation);
  }

  for (const fallbackValue of Array.isArray(fallbackValues) ? fallbackValues : []) {
    const normalized = normalizePrePickLocation(fallbackValue);
    if (normalized) return normalized;
  }

  return null;
};
