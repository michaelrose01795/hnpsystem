import { DEV_LAYOUT_SECTION_SOURCE_MAP } from "@/lib/dev-layout/sectionSourceMap.generated";

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patternToRegExp = (pattern) => {
  const parts = String(pattern || "").split("*").map(escapeRegExp);
  return new RegExp(`^${parts.join(".*")}$`);
};

const exactByKey = new Map();
const dynamicEntries = [];

DEV_LAYOUT_SECTION_SOURCE_MAP.forEach((entry) => {
  if (!entry?.key) return;
  if (entry.dynamic || String(entry.key).includes("*")) {
    dynamicEntries.push({
      ...entry,
      matcher: patternToRegExp(entry.key),
      specificity: String(entry.key).replace(/\*/g, "").length,
    });
    return;
  }
  if (!exactByKey.has(entry.key)) {
    exactByKey.set(entry.key, []);
  }
  exactByKey.get(entry.key).push(entry);
});

dynamicEntries.sort((left, right) => right.specificity - left.specificity);

export const findDevLayoutSectionSources = (sectionKey) => {
  const key = String(sectionKey || "");
  if (!key) return [];

  const exact = exactByKey.get(key);
  if (exact?.length) return exact;

  return dynamicEntries.filter((entry) => entry.matcher.test(key));
};
