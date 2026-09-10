// file location: src/lib/ui/symbolLabels.test.js
//
// resolveSymbolForLabel decides, for EVERY button in the staff app, whether a
// symbol appears next to the label. A wrong "yes" puts a mark on a button that
// should not carry one; a wrong "no" silently drops the mark from a whole class
// of buttons. Both are invisible in review, so the rule is pinned here.
import { describe, expect, it } from "vitest";
import { SYMBOL_FOR_LABEL, resolveSymbolForLabel } from "./symbolLabels";

describe("SYMBOL_FOR_LABEL", () => {
  it("keys are already normalised, so a lookup can never miss", () => {
    const unnormalised = Object.keys(SYMBOL_FOR_LABEL).filter(
      (key) => key !== key.trim().toLowerCase().replace(/\s+/g, " ")
    );
    expect(unnormalised).toEqual([]);
  });
  it("maps the labels the deep dive converted", () => {
    expect(resolveSymbolForLabel("Clear")).toBe("clear");
    expect(resolveSymbolForLabel("Create order")).toBe("save");
    expect(resolveSymbolForLabel("Move media")).toBe("move");
    expect(resolveSymbolForLabel("Back")).toBe("back");
  });
});

describe("resolveSymbolForLabel", () => {
  it("resolves an exact action label, whatever its casing or padding", () => {
    expect(resolveSymbolForLabel("Reply")).toBe("reply");
    expect(resolveSymbolForLabel("  DELETE  ")).toBe("delete");
    expect(resolveSymbolForLabel("Save changes")).toBe("save");
    expect(resolveSymbolForLabel("Clear filters")).toBe("clear");
  });

  it("leaves labels that name no concrete action alone", () => {
    // A symbol REPLACES the words, so a mark on one of these would leave the
    // button saying less than it does now.
    expect(resolveSymbolForLabel("Cancel")).toBeNull();
    expect(resolveSymbolForLabel("Continue")).toBeNull();
    expect(resolveSymbolForLabel("Submit")).toBeNull();
    expect(resolveSymbolForLabel("Assign Technician")).toBeNull();
    expect(resolveSymbolForLabel("Saving…")).toBeNull();
  });

  it("leaves labels whose mark would read as a different action", () => {
    // These were deliberately taken OUT of the map. Each has artwork in the
    // set, so nothing stops someone re-adding them; the point is that the
    // borrowed mark says the wrong thing once the words are gone.
    expect(resolveSymbolForLabel("Import")).toBeNull();   // upload arrow
    expect(resolveSymbolForLabel("Reset")).toBeNull();    // same eraser as Clear
    expect(resolveSymbolForLabel("Decline")).toBeNull();  // cross reads "close"
    expect(resolveSymbolForLabel("Approve")).toBeNull();  // bare tick, on an authorisation
    expect(resolveSymbolForLabel("Details")).toBeNull();
    // "Export CSV" / "Export PDF" sit side by side, so one shared mark would
    // make them the same button. Bare "Export" is mapped; these are not.
    expect(resolveSymbolForLabel("Export CSV")).toBeNull();
    expect(resolveSymbolForLabel("Export PDF")).toBeNull();
  });

  it("maps the labels that got their own mark", () => {
    // "Export" was excluded only while the candidate mark was a download
    // arrow. It has its own now — a record with the arrow leaving it.
    expect(resolveSymbolForLabel("Export")).toBe("export");
    expect(resolveSymbolForLabel("Update")).toBe("update");
    expect(resolveSymbolForLabel("View")).toBe("view");
    expect(resolveSymbolForLabel("Open")).toBe("open");
    expect(resolveSymbolForLabel("Open job card")).toBe("open");
  });

  it("falls back to the accessible name for a bare glyph label", () => {
    // The popup closes that render a lone × are labelled only by aria-label.
    expect(resolveSymbolForLabel("×", "Close")).toBe("close");
    expect(resolveSymbolForLabel("✕", "Close")).toBe("close");
  });

  it("does not let the accessible name override a real text label", () => {
    // "Assign Technician" is not a mapped action; an aria-label of "Save" must
    // not sneak a mark onto it. (The guard is the early return on an unmapped
    // string child, so any unmapped label demonstrates it.)
    expect(resolveSymbolForLabel("Assign Technician", "Save")).toBeNull();
    expect(resolveSymbolForLabel("Export CSV", "Export")).toBeNull();
  });

  it("leaves buttons whose children are not plain text alone", () => {
    // The call site has already said what it wants shown.
    expect(resolveSymbolForLabel(["Reply", " (3)"], "Reply")).toBeNull();
    expect(resolveSymbolForLabel({ type: "span" }, "Delete")).toBeNull();
  });

  it("resolves from the accessible name when there are no children at all", () => {
    expect(resolveSymbolForLabel(null, "Refresh")).toBe("refresh");
    expect(resolveSymbolForLabel(undefined, "Print")).toBe("print");
  });
});
