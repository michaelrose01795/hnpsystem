// file location: src/lib/dev-platform/developerDirectory.test.js
import { describe, expect, it } from "vitest";
import { buildDeveloperDirectory, searchDirectory } from "@/lib/dev-platform/developerDirectory";

const reports = [
  { id: "1", assigned_to: 5, reporter_user_id: 9, reporter_username: "ada" },
  { id: "2", assigned_to: 5, reporter_user_id: 9, reporter_username: "ada" },
  { id: "3", assigned_to: null, reporter_user_id: 12, reporter_username: "grace" },
  { id: "4", assigned_to: 5, reporter_user_id: null, reporter_username: null },
];

describe("buildDeveloperDirectory", () => {
  it("merges identities by id and counts assignments + reports", () => {
    const dir = buildDeveloperDirectory(reports);
    const five = dir.find((d) => d.id === 5);
    expect(five.assignedCount).toBe(3);
    const ada = dir.find((d) => d.username === "ada");
    expect(ada.id).toBe(9);
    expect(ada.reportedCount).toBe(2);
  });

  it("marks the current user and sorts them first", () => {
    const dir = buildDeveloperDirectory(reports, { currentUser: { id: 12 } });
    expect(dir[0].id).toBe(12);
    expect(dir[0].isCurrent).toBe(true);
  });

  it("is safe on empty input", () => {
    expect(buildDeveloperDirectory()).toEqual([]);
  });
});

describe("searchDirectory", () => {
  const dir = buildDeveloperDirectory(reports);
  it("returns everything for an empty query", () => {
    expect(searchDirectory(dir, "")).toHaveLength(dir.length);
  });
  it("matches on username", () => {
    expect(searchDirectory(dir, "ada").every((d) => d.username.includes("ada"))).toBe(true);
  });
  it("matches on #id", () => {
    expect(searchDirectory(dir, "#5").some((d) => d.id === 5)).toBe(true);
  });
});
