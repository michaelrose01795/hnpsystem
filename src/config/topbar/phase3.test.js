// file location: src/config/topbar/phase3.test.js
//
// Phase 3 — coverage for the pure workspace-productivity modules: command
// palette (3.1), recent activity (3.2), favourites (3.3), contextual suggestions
// (3.4), keyboard shortcuts (3.5), productivity widgets (3.6), personalisation
// (3.7) and reminders. UI + hooks are excluded (they only wire these together).

import { describe, it, expect } from "vitest";
import {
  toCommand,
  buildCommands,
  scoreCommand,
  filterCommands,
  groupCommands,
} from "@/lib/topbar/commandPalette";
import { classifyRoute, buildSearchItem, recentToCommandSource } from "@/lib/topbar/recentActivity";
import { normaliseFavourite, isSameFavourite, favouriteToCommandSource } from "@/lib/topbar/favourites";
import { resolveSuggestions } from "@/config/topbar/contextualSuggestions";
import { shortcutMatches, matchShortcut, formatCombo, getShortcut } from "@/config/topbar/keyboardShortcuts";
import { resolveWidgets } from "@/config/topbar/productivityWidgets";
import {
  defaultPreferences,
  mergePreferences,
  setWidgetVisible,
  moveWidget,
  toggleQuickActionHidden,
  applyQuickActionPrefs,
} from "@/lib/topbar/workspacePreferences";
import { buildReminder, sortReminders, countOutstanding } from "@/lib/topbar/reminders";

describe("commandPalette", () => {
  it("normalises a source into a command and drops invalid input", () => {
    expect(toCommand({ label: "Reports", href: "/reports" })).toMatchObject({
      title: "Reports",
      href: "/reports",
      kind: "page",
    });
    expect(toCommand({ label: "No target" })).toBeNull(); // no href/run
    expect(toCommand({ href: "/x" })).toBeNull(); // no title
  });

  it("de-dupes by target keeping the highest-priority kind", () => {
    const commands = buildCommands({
      pages: [{ label: "Reports", href: "/reports" }],
      favourites: [{ label: "Reports", href: "/reports" }],
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].kind).toBe("favourite");
  });

  it("scores exact/prefix above substring, and browses on empty query", () => {
    const cmd = toCommand({ label: "Job Cards", href: "/jobs", keywords: ["jobs"] });
    expect(scoreCommand(cmd, "job cards")).toBeGreaterThan(scoreCommand(cmd, "job"));
    expect(scoreCommand(cmd, "cards")).toBeGreaterThan(0); // substring
    expect(scoreCommand(cmd, "")).toBeGreaterThan(0); // empty → browse
    expect(scoreCommand(cmd, "zzz")).toBe(0);
  });

  it("filters + ranks and caps results", () => {
    const commands = buildCommands({
      pages: [
        { label: "Reports", href: "/reports" },
        { label: "Parts", href: "/parts" },
      ],
    });
    const results = filterCommands(commands, "rep");
    expect(results[0].title).toBe("Reports");
    expect(filterCommands(commands, "rep", { limit: 0 })).toHaveLength(0);
  });

  it("groups results with Suggested before Pages", () => {
    const commands = buildCommands({
      pages: [{ label: "Reports", href: "/reports" }],
      suggestions: [{ label: "Do a thing", href: "/thing" }],
    });
    const groups = groupCommands(filterCommands(commands, ""));
    expect(groups[0].section).toBe("Suggested");
  });
});

describe("recentActivity", () => {
  it("classifies viewable routes", () => {
    expect(classifyRoute("/job-cards/00076")).toMatchObject({ category: "job", label: "Job 00076" });
    expect(classifyRoute("/tech/12345").category).toBe("job");
    expect(classifyRoute("/customers/acme-ltd")).toMatchObject({ category: "customer", label: "Acme Ltd" });
    expect(classifyRoute("/reports/workshop")).toMatchObject({ category: "report", label: "Workshop report" });
    expect(classifyRoute("/vhc/00076")).toMatchObject({ category: "workflow", label: "VHC 00076" });
    expect(classifyRoute("/new-order/123").label).toBe("New Order: 123");
  });

  it("ignores non-record / root routes", () => {
    expect(classifyRoute("/")).toBeNull();
    expect(classifyRoute("/dashboard/workshop")).toBeNull();
    expect(classifyRoute("")).toBeNull();
  });

  it("builds and maps a search item that re-runs via a run handler", () => {
    expect(buildSearchItem("  ")).toBeNull();
    const item = buildSearchItem("brakes");
    expect(item).toMatchObject({ category: "search", query: "brakes", href: null });
    let ran = null;
    const source = recentToCommandSource(item, { onRunSearch: (q) => (ran = q) });
    source.run();
    expect(ran).toBe("brakes");
  });
});

describe("favourites", () => {
  it("infers kind from the route", () => {
    expect(normaliseFavourite({ href: "/reports/workshop" }).kind).toBe("report");
    expect(normaliseFavourite({ href: "/job-cards/1" }).kind).toBe("record");
    expect(normaliseFavourite({ href: "/parts" }).kind).toBe("page");
    expect(normaliseFavourite({})).toBeNull();
  });

  it("compares targets hash-insensitively and maps to a command", () => {
    expect(isSameFavourite("/reports#a", "/reports#b")).toBe(true);
    expect(favouriteToCommandSource(normaliseFavourite({ href: "/parts", label: "Parts" }))).toMatchObject({
      href: "/parts",
      icon: "★",
    });
  });
});

describe("contextualSuggestions", () => {
  it("prioritises live operational nudges and excludes the current page", () => {
    const list = resolveSuggestions({
      pathname: "/dashboard/workshop",
      roles: ["workshop manager"],
      metrics: { overdueJobs: 3 },
    });
    expect(list[0].label).toContain("3 overdue");
    // create-job suggestion would point at /new-job; not the current page → fine.
    const onNewJob = resolveSuggestions({
      pathname: "/new-job",
      roles: ["service"],
      metrics: {},
    });
    expect(onNewJob.some((s) => s.href === "/new-job")).toBe(false);
  });

  it("returns nothing for a role with no matching rule", () => {
    expect(resolveSuggestions({ pathname: "/x", roles: ["valet service"], metrics: {} })).toEqual([]);
  });
});

describe("keyboardShortcuts", () => {
  it("matches mod chords and bare keys correctly", () => {
    const palette = getShortcut("command-palette");
    expect(shortcutMatches(palette, { key: "k", ctrlKey: true })).toBe(true);
    expect(shortcutMatches(palette, { key: "k" })).toBe(false); // needs mod
    const search = getShortcut("search");
    expect(shortcutMatches(search, { key: "/" })).toBe(true);
    expect(shortcutMatches(search, { key: "/", ctrlKey: true })).toBe(false); // bare only
    expect(matchShortcut({ key: "?" })?.id).toBe("shortcut-hints");
  });

  it("formats combos per platform", () => {
    const palette = getShortcut("command-palette");
    expect(formatCombo(palette, true)).toContain("⌘");
    expect(formatCombo(palette, false)).toBe("Ctrl+K");
  });
});

describe("productivityWidgets", () => {
  const ctx = {
    department: "workshop",
    metrics: { overdueJobs: 2, jobsInProgress: 5 },
    recentItems: [{ id: "a", label: "Job 1", href: "/job-cards/1", subtitle: "Job card" }],
    favourites: [{ href: "/parts", label: "Parts", subtitle: "Page" }],
    suggestions: [{ id: "s", label: "Suggested", href: "/x" }],
    reminders: [{ id: "r1", text: "Call customer", done: false }],
  };

  it("builds ordered widgets from context", () => {
    const widgets = resolveWidgets(ctx);
    const ids = widgets.map((w) => w.id);
    expect(ids[0]).toBe("upcoming");
    const upcoming = widgets.find((w) => w.id === "upcoming");
    expect(upcoming.items.some((i) => /overdue/.test(i.label))).toBe(true);
    expect(widgets.find((w) => w.id === "reminders").interactive).toBe("reminders");
  });

  it("honours visibility + order prefs", () => {
    const widgets = resolveWidgets(ctx, {
      widgets: { operational: false },
      widgetOrder: ["favourites", "upcoming"],
    });
    expect(widgets.map((w) => w.id)).not.toContain("operational");
    expect(widgets[0].id).toBe("favourites");
  });
});

describe("workspacePreferences", () => {
  it("merges partial/stale blobs onto defaults", () => {
    const merged = mergePreferences({ widgets: { recent: false }, junk: 1 });
    expect(merged.widgets.recent).toBe(false);
    expect(merged.widgets.upcoming).toBe(true);
    expect(merged.hiddenQuickActions).toEqual([]);
    expect(merged).not.toHaveProperty("junk");
  });

  it("applies immutable reducers", () => {
    const base = defaultPreferences();
    expect(setWidgetVisible(base, "recent", false).widgets.recent).toBe(false);
    expect(base.widgets.recent).toBe(true); // unchanged

    const moved = moveWidget(base, base.widgetOrder[1], -1);
    expect(moved.widgetOrder[0]).toBe(base.widgetOrder[1]);

    const hidden = toggleQuickActionHidden(base, "/parts");
    expect(hidden.hiddenQuickActions).toContain("/parts");
    expect(toggleQuickActionHidden(hidden, "/parts").hiddenQuickActions).not.toContain("/parts");
  });

  it("filters hidden quick actions", () => {
    const actions = [{ href: "/a", label: "A" }, { href: "/b", label: "B" }];
    expect(applyQuickActionPrefs(actions, { hiddenQuickActions: ["/a"] })).toEqual([
      { href: "/b", label: "B" },
    ]);
  });
});

describe("reminders", () => {
  it("builds, sorts outstanding-first, and counts", () => {
    expect(buildReminder("  ")).toBeNull();
    const a = buildReminder("done one", 1, 0);
    const b = buildReminder("todo two", 2, 1);
    const list = [{ ...a, done: true }, { ...b, done: false }];
    expect(sortReminders(list)[0].id).toBe(b.id); // outstanding first
    expect(countOutstanding(list)).toBe(1);
  });
});
