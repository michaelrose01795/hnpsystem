import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "ServiceHistoryTab.js"), "utf8");

const getComparePickerSource = () => {
  const start = source.indexOf("function ComparePicker");
  const end = source.indexOf("function CompareColumn");
  return source.slice(start, end);
};

describe("ServiceHistoryTab Compare Jobs dropdown", () => {
  it("uses the in-app DropdownField instead of a native select", () => {
    const comparePickerSource = getComparePickerSource();

    expect(comparePickerSource).toContain("<DropdownField");
    expect(comparePickerSource).not.toContain("<select");
    expect(comparePickerSource).not.toContain("<option");
  });
});
