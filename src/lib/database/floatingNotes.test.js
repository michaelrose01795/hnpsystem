import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [],
  shareDeleteError: null,
  noteDeleteError: null,
  from: vi.fn(),
}));

vi.mock("@/lib/database/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

import { deleteFloatingNote } from "./floatingNotes";

describe("deleteFloatingNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls = [];
    mocks.shareDeleteError = null;
    mocks.noteDeleteError = null;
    mocks.from.mockImplementation((table) => ({
      select: (columns) => ({
        limit: async () => {
          mocks.calls.push(["select", table, columns]);
          return { data: [], error: null };
        },
      }),
      delete: () => ({
        eq: async (column, value) => {
          mocks.calls.push(["delete", table, column, value]);
          return {
            error: table === "floating_note_shares"
              ? mocks.shareDeleteError
              : mocks.noteDeleteError,
          };
        },
      }),
    }));
  });

  it("clears share rows before deleting their note", async () => {
    await expect(deleteFloatingNote(42)).resolves.toEqual({ success: true });

    expect(mocks.calls).toEqual([
      ["delete", "floating_note_shares", "note_id", 42],
      ["select", "floating_notes", "note_id"],
      ["delete", "floating_notes", "note_id", 42],
    ]);
  });

  it("keeps the note when its share rows could not be cleared", async () => {
    mocks.shareDeleteError = { message: "share cleanup failed" };

    await expect(deleteFloatingNote(42)).resolves.toEqual({
      success: false,
      error: { message: "share cleanup failed" },
    });
    expect(mocks.calls).toEqual([
      ["delete", "floating_note_shares", "note_id", 42],
    ]);
  });
});
