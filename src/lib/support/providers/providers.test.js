// file location: src/lib/support/providers/providers.test.js
import { describe, expect, it } from "vitest";
import { collectUiState } from "@/lib/support/providers/uiStateProvider";
import { collectDevMetadata } from "@/lib/support/providers/devMetadataProvider";

// --- tiny DOM stubs -------------------------------------------------------
const el = (tag, attrs = {}, extra = {}) => ({
  tagName: tag.toUpperCase(),
  getAttribute: (k) => (k in attrs ? attrs[k] : null),
  textContent: extra.textContent || "",
  value: extra.value,
  checked: extra.checked,
  options: extra.options,
  selectedIndex: extra.selectedIndex,
});

function makeDoc(map) {
  // map: { selector: element | element[] }
  return {
    querySelector: (sel) => {
      const v = map[sel];
      return Array.isArray(v) ? v[0] || null : v || null;
    },
    querySelectorAll: (sel) => {
      const v = map[sel];
      return Array.isArray(v) ? v : v ? [v] : [];
    },
  };
}

describe("collectUiState", () => {
  it("returns {} without a document", () => {
    expect(collectUiState({})).toEqual({});
  });

  it("captures the active tab and form field identity WITHOUT values", () => {
    const doc = makeDoc({
      "[data-dev-active-tab-label]": el("button", { "data-dev-active-tab-label": "Parts" }),
      "input, select, textarea": [
        el("input", { type: "text", name: "customerName" }, { value: "Jane Secret" }),
        el("input", { type: "checkbox", name: "agree" }, { checked: true }),
      ],
    });
    const out = collectUiState({ doc });
    expect(out.activeTab).toBe("Parts");
    expect(out.formFields).toEqual([
      { field: "customerName", type: "text", filled: true },
      { field: "agree", type: "checkbox", filled: true },
    ]);
    // The actual typed value must never appear anywhere in the output.
    expect(JSON.stringify(out)).not.toContain("Jane Secret");
  });

  it("reports modal state but ignores the support popup itself", () => {
    const doc = makeDoc({
      "[aria-modal='true']:not([aria-label='Report a problem']), [data-modal-portal='true']": [
        el("div", { "aria-label": "Edit customer" }),
      ],
    });
    const out = collectUiState({ doc });
    expect(out.modal).toMatchObject({ open: true, count: 1, label: "Edit customer" });
  });
});

describe("collectDevMetadata", () => {
  const store = (requests) => ({
    requests: { toArray: () => requests },
    actions: { toArray: () => [{ type: "route_change" }, { type: "click" }] },
  });

  it("flags repeated API failures (same endpoint > once), ignoring querystrings", () => {
    const out = collectDevMetadata({
      win: {},
      store: store([
        { method: "GET", url: "/api/jobs?a=1", status: 500 },
        { method: "GET", url: "/api/jobs?a=2", status: 500 },
        { method: "POST", url: "/api/x", status: 400 },
      ]),
    });
    expect(out.repeatedApiFailures).toEqual([{ endpoint: "GET /api/jobs", count: 2 }]);
    expect(out.recentRouteChanges).toBe(1);
  });

  it("reads memory pressure and network quality when available", () => {
    const out = collectDevMetadata({
      win: {
        performance: { memory: { usedJSHeapSize: 50 * 1024 * 1024, jsHeapSizeLimit: 100 * 1024 * 1024 } },
        navigator: undefined,
      },
      store: store([]),
    });
    expect(out.memory).toMatchObject({ usedMb: 50, limitMb: 100, pressure: 0.5 });
  });

  it("includes network info from navigator.connection", () => {
    const out = collectDevMetadata({
      win: { navigator: { connection: { effectiveType: "4g", rtt: 80, downlink: 10, saveData: false } } },
      store: store([]),
    });
    expect(out.network).toEqual({ effectiveType: "4g", downlinkMbps: 10, rttMs: 80, saveData: false });
  });
});
