import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [],
  ownedNote: { note_id: 42, user_id: 7 },
  shareDeleteError: null,
  noteDeleteError: null,
  staffRows: [],
  from: vi.fn(),
}));

vi.mock("@/lib/database/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

import { deleteFloatingNote, setNoteSharedUsers } from "./floatingNotes";

describe("deleteFloatingNote ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls = [];
    mocks.ownedNote = { note_id: 42, user_id: 7 };
    mocks.shareDeleteError = null;
    mocks.noteDeleteError = null;
    mocks.staffRows = [];
    mocks.from.mockImplementation((table) => ({
      select: (columns) => {
        const conditions = [];
        return {
          limit: async () => ({ data: [], error: null }),
          eq(column, value) {
            conditions.push([column, value]);
            return this;
          },
          in(column, value) {
            conditions.push([column, value]);
            return this;
          },
          async maybeSingle() {
            mocks.calls.push(["owner-check", table, columns, conditions]);
            return { data: mocks.ownedNote, error: null };
          },
          then(resolve) {
            mocks.calls.push(["select-many", table, columns, conditions]);
            return Promise.resolve({ data: mocks.staffRows, error: null }).then(resolve);
          },
        };
      },
      insert: async (payload) => {
        mocks.calls.push(["insert", table, payload]);
        return { error: null };
      },
      delete: () => {
        const conditions = [];
        const query = {
          eq(column, value) {
            conditions.push([column, value]);
            return query;
          },
          then(resolve) {
            mocks.calls.push(["delete", table, conditions]);
            const error = table === "floating_note_shares"
              ? mocks.shareDeleteError
              : mocks.noteDeleteError;
            return Promise.resolve({ error }).then(resolve);
          },
        };
        return query;
      },
    }));
  });

  it("checks ownership before deleting shares and the note", async () => {
    await expect(deleteFloatingNote(42, 7)).resolves.toEqual({ success: true });

    expect(mocks.calls).toContainEqual([
      "owner-check",
      "floating_notes",
      "note_id, user_id",
      [["note_id", 42], ["user_id", 7]],
    ]);
    expect(mocks.calls).toContainEqual([
      "delete",
      "floating_note_shares",
      [["note_id", 42]],
    ]);
    expect(mocks.calls).toContainEqual([
      "delete",
      "floating_notes",
      [["note_id", 42], ["user_id", 7]],
    ]);
  });

  it("does not touch share rows when the caller does not own the note", async () => {
    mocks.ownedNote = null;

    await expect(deleteFloatingNote(42, 99)).resolves.toEqual({
      success: false,
      error: {
        code: "NOTE_NOT_ACCESSIBLE",
        message: "Note not found or you do not have permission",
      },
    });
    expect(mocks.calls.some(([operation]) => operation === "delete")).toBe(false);
  });

  it("does not let a non-owner replace another note's share list", async () => {
    mocks.ownedNote = null;

    await expect(setNoteSharedUsers({
      noteId: 42,
      ownerUserId: 99,
      userIds: [8],
    })).resolves.toEqual({
      success: false,
      error: {
        code: "NOTE_NOT_ACCESSIBLE",
        message: "Note not found or you do not have permission",
      },
    });
    expect(mocks.calls.some(([operation]) => operation === "delete")).toBe(false);
  });

  it("drops customer recipients even when their ids are submitted directly", async () => {
    mocks.staffRows = [
      { user_id: 8, role: "Admin", is_active: true },
      { user_id: 9, role: "Customer", is_active: true },
    ];

    await expect(setNoteSharedUsers({
      noteId: 42,
      ownerUserId: 7,
      userIds: [8, 9],
    })).resolves.toEqual({ success: true, data: [8] });

    expect(mocks.calls).toContainEqual([
      "insert",
      "floating_note_shares",
      [{ note_id: 42, user_id: 8, shared_by: 7 }],
    ]);
  });

  it("keeps the note when its share rows could not be cleared", async () => {
    mocks.shareDeleteError = { message: "share cleanup failed" };

    await expect(deleteFloatingNote(42, 7)).resolves.toEqual({
      success: false,
      error: { message: "share cleanup failed" },
    });
    expect(mocks.calls).not.toContainEqual([
      "delete",
      "floating_notes",
      [["note_id", 42], ["user_id", 7]],
    ]);
  });
});
