const ENDPOINT = "/api/floating-notes";

const request = async (url = ENDPOINT, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      error: { message: payload?.error?.message || "Floating notes request failed" },
    };
  }

  return payload;
};

export const getFloatingNotes = async () => {
  const result = await request();
  if (!result?.success) throw new Error(result?.error?.message || "Failed to load notes");
  return result.data || [];
};

export const createFloatingNote = (note) =>
  request(ENDPOINT, { method: "POST", body: JSON.stringify(note) });

export const updateFloatingNote = (noteId, updates) =>
  request(ENDPOINT, { method: "PATCH", body: JSON.stringify({ noteId, ...updates }) });

export const deleteFloatingNote = (noteId) =>
  request(`${ENDPOINT}?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" });

export const getFloatingNoteShareOptions = async (noteId) => {
  const result = await request(
    `${ENDPOINT}?view=share-options&noteId=${encodeURIComponent(noteId)}`
  );
  if (!result?.success) throw new Error(result?.error?.message || "Failed to load share users");
  return result.data || { users: [], sharedUserIds: [] };
};

export const setFloatingNoteSharedUsers = (noteId, userIds) =>
  request(ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ action: "set-shares", noteId, userIds }),
  });
