// file location: src/lib/dev-platform/commandPalette.test.js
import { describe, expect, it, vi } from "vitest";
import {
  fuzzyScore,
  buildDefaultCommands,
  searchCommands,
  groupCommands,
} from "@/lib/dev-platform/commandPalette";
import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";

describe("fuzzyScore", () => {
  it("returns 0 for an empty query", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
    expect(fuzzyScore(null, "anything")).toBe(0);
    expect(fuzzyScore(undefined, "anything")).toBe(0);
  });

  it("returns -1 for an empty target with a non-empty query", () => {
    expect(fuzzyScore("x", "")).toBe(-1);
  });

  it("returns -1 when the query is not a subsequence", () => {
    expect(fuzzyScore("xyz", "abcdef")).toBe(-1);
    expect(fuzzyScore("zab", "abz")).toBe(-1); // order matters
  });

  it("matches a subsequence in order (non-contiguous)", () => {
    expect(fuzzyScore("ace", "abcde")).toBeGreaterThanOrEqual(0);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("GO", "go to health")).toBeGreaterThanOrEqual(0);
  });

  it("scores a prefix match higher than a mid-string match", () => {
    const prefix = fuzzyScore("log", "login button");
    const mid = fuzzyScore("log", "the login button");
    expect(prefix).toBeGreaterThan(mid);
  });

  it("scores a contiguous run higher than a scattered subsequence", () => {
    const contiguous = fuzzyScore("abc", "abcxyz");
    const scattered = fuzzyScore("abc", "axbxc");
    expect(contiguous).toBeGreaterThan(scattered);
  });

  it("rewards a word-boundary start", () => {
    // 'h' after a space (word boundary) beats 'h' embedded mid-word
    const boundary = fuzzyScore("h", "go health");
    const embedded = fuzzyScore("h", "ohno");
    expect(boundary).toBeGreaterThan(embedded);
  });

  it("applies a slight brevity preference for shorter targets", () => {
    const shortT = fuzzyScore("go", "go");
    const longT = fuzzyScore("go", "go somewhere far away");
    expect(shortT).toBeGreaterThan(longT);
  });
});

describe("buildDefaultCommands", () => {
  it("yields one nav command per DEV_PLATFORM_NAV entry", () => {
    const cmds = buildDefaultCommands({ navigate: () => {} });
    const navCmds = cmds.filter((c) => c.group === "Navigate");
    expect(navCmds).toHaveLength(DEV_PLATFORM_NAV.length);
  });

  it("builds each nav command from its nav entry", () => {
    const cmds = buildDefaultCommands({ navigate: () => {} });
    for (const item of DEV_PLATFORM_NAV) {
      const cmd = cmds.find((c) => c.id === `nav:${item.key}`);
      expect(cmd).toBeTruthy();
      expect(cmd.title).toBe(`Go to ${item.label}`);
      expect(cmd.subtitle).toBe(item.description);
      expect(cmd.href).toBe(item.href);
      expect(cmd.group).toBe("Navigate");
      expect(cmd.keywords).toEqual(expect.arrayContaining([item.key, item.label]));
    }
  });

  it("run() calls the injected navigate with the entry's href", () => {
    const navigate = vi.fn();
    const cmds = buildDefaultCommands({ navigate });
    const first = cmds.find((c) => c.id === `nav:${DEV_PLATFORM_NAV[0].key}`);
    first.run();
    expect(navigate).toHaveBeenCalledWith(DEV_PLATFORM_NAV[0].href);
  });

  it("appends caller-supplied action commands after the nav commands", () => {
    const actions = [
      { id: "act:new", title: "New report", group: "Actions", run: () => {} },
      { id: "act:refresh", title: "Refresh", group: "Actions", run: () => {} },
    ];
    const cmds = buildDefaultCommands({ navigate: () => {}, actions });
    expect(cmds).toHaveLength(DEV_PLATFORM_NAV.length + actions.length);
    expect(cmds.slice(-2).map((c) => c.id)).toEqual(["act:new", "act:refresh"]);
  });

  it("tolerates no context (navigate defaults to a no-op)", () => {
    const cmds = buildDefaultCommands();
    expect(cmds).toHaveLength(DEV_PLATFORM_NAV.length);
    expect(() => cmds[0].run()).not.toThrow();
  });

  it("ignores a non-array actions value", () => {
    const cmds = buildDefaultCommands({ navigate: () => {}, actions: "nope" });
    expect(cmds).toHaveLength(DEV_PLATFORM_NAV.length);
  });
});

describe("searchCommands", () => {
  const commands = [
    { id: "1", title: "Go to Health", subtitle: "subsystem health", keywords: ["health"] },
    { id: "2", title: "Go to Releases", subtitle: "deployment timeline", keywords: ["releases"] },
    { id: "3", title: "New report", subtitle: "create a support report", keywords: ["new", "report"] },
  ];

  it("returns all commands unchanged for an empty query", () => {
    expect(searchCommands(commands, "")).toEqual(commands);
    expect(searchCommands(commands, "   ")).toEqual(commands); // trimmed to empty
  });

  it("respects the limit on an empty query", () => {
    const out = searchCommands(commands, "", { limit: 2 });
    expect(out).toHaveLength(2);
    expect(out).toEqual(commands.slice(0, 2));
  });

  it("filters to commands whose fields match the query", () => {
    const out = searchCommands(commands, "health");
    expect(out.map((c) => c.id)).toEqual(["1"]);
  });

  it("matches against subtitle and keywords, not just title", () => {
    expect(searchCommands(commands, "deployment").map((c) => c.id)).toEqual(["2"]);
    expect(searchCommands(commands, "report").map((c) => c.id)).toEqual(["3"]);
  });

  it("ranks the better match first", () => {
    const cmds = [
      { id: "far", title: "Go to Release Ledger" },
      { id: "near", title: "Releases" },
    ];
    // "releases" is a prefix of the "Releases" title → ranks first
    const out = searchCommands(cmds, "releases");
    expect(out[0].id).toBe("near");
  });

  it("drops non-matching commands", () => {
    expect(searchCommands(commands, "zzzzz")).toEqual([]);
  });

  it("respects the limit on a filtered result", () => {
    const cmds = [
      { id: "a", title: "release one" },
      { id: "b", title: "release two" },
      { id: "c", title: "release three" },
    ];
    expect(searchCommands(cmds, "release", { limit: 2 })).toHaveLength(2);
  });

  it("tolerates empty command lists / no args", () => {
    expect(searchCommands([], "x")).toEqual([]);
    expect(searchCommands(undefined, "x")).toEqual([]);
  });
});

describe("groupCommands", () => {
  it("groups by the `group` field, preserving first-seen order", () => {
    const cmds = [
      { id: "1", group: "Navigate" },
      { id: "2", group: "Actions" },
      { id: "3", group: "Navigate" },
      { id: "4", group: "Actions" },
    ];
    const groups = groupCommands(cmds);
    expect(groups.map((g) => g.group)).toEqual(["Navigate", "Actions"]);
    expect(groups[0].commands.map((c) => c.id)).toEqual(["1", "3"]);
    expect(groups[1].commands.map((c) => c.id)).toEqual(["2", "4"]);
  });

  it("defaults commands without a group to 'Actions'", () => {
    const groups = groupCommands([{ id: "1" }, { id: "2", group: "Navigate" }]);
    const byName = Object.fromEntries(groups.map((g) => [g.group, g]));
    expect(byName.Actions.commands.map((c) => c.id)).toEqual(["1"]);
    expect(byName.Navigate.commands.map((c) => c.id)).toEqual(["2"]);
  });

  it("returns [] for an empty / missing list", () => {
    expect(groupCommands([])).toEqual([]);
    expect(groupCommands()).toEqual([]);
  });

  it("round-trips with buildDefaultCommands (Navigate group is present)", () => {
    const cmds = buildDefaultCommands({ navigate: () => {} });
    const groups = groupCommands(cmds);
    const nav = groups.find((g) => g.group === "Navigate");
    expect(nav.commands).toHaveLength(DEV_PLATFORM_NAV.length);
  });
});
