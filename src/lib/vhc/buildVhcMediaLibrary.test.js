import { describe, expect, it } from "vitest";
import { prioritiseRowsWithMedia } from "@/lib/vhc/buildVhcMediaLibrary";

describe("prioritiseRowsWithMedia", () => {
  it("moves photo and video rows ahead of empty rows without changing partition order", () => {
    const rows = [
      { key: "empty-red", photos: [], videos: [] },
      { key: "photo-amber", photos: [{ file_id: 1 }], videos: [] },
      { key: "empty-amber", photos: [], videos: [] },
      { key: "video-red", photos: [], videos: [{ file_id: 2 }] },
      { key: "unlinked", photos: [{ file_id: 3 }], videos: [] },
    ];

    expect(prioritiseRowsWithMedia(rows).map((row) => row.key)).toEqual([
      "photo-amber",
      "video-red",
      "unlinked",
      "empty-red",
      "empty-amber",
    ]);
  });

  it("does not mutate the source array", () => {
    const rows = [
      { key: "empty", photos: [], videos: [] },
      { key: "media", photos: [], videos: [{ file_id: 1 }] },
    ];

    prioritiseRowsWithMedia(rows);

    expect(rows.map((row) => row.key)).toEqual(["empty", "media"]);
  });
});
