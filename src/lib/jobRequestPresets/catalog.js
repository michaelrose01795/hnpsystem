import catalogData from "@/lib/jobRequestPresets/catalog.json";
import { normalizePresetText } from "@/lib/jobRequestPresets/constants";

export const JOB_REQUEST_PRESET_CATALOG = Object.freeze(
  catalogData.map((preset, index) => Object.freeze({
    id: null,
    catalogKey: `${normalizePresetText(preset.label)}-${index}`,
    label: preset.label,
    aliases: Object.freeze(Array.isArray(preset.aliases) ? preset.aliases : []),
    category: preset.category || "general",
    defaultHours: Number(preset.hours || 0),
    usageCount: 0,
  }))
);

export const mergePersistedJobRequestPresets = (persistedPresets = []) => {
  const persistedPresetsList = Array.isArray(persistedPresets) ? persistedPresets : [];
  const persistedByLabel = new Map(
    persistedPresetsList.map((preset) => [
      normalizePresetText(preset.label),
      preset,
    ])
  );

  const catalogLabels = new Set(JOB_REQUEST_PRESET_CATALOG.map((preset) => normalizePresetText(preset.label)));
  const catalogAliases = new Set(JOB_REQUEST_PRESET_CATALOG.flatMap((preset) => preset.aliases.map(normalizePresetText)));
  const mergedCatalog = JOB_REQUEST_PRESET_CATALOG.map((preset) => {
    const normalizedLabel = normalizePresetText(preset.label);
    const exactPersisted = persistedByLabel.get(normalizedLabel);
    const aliasPersisted = exactPersisted || persistedPresetsList.find((candidate) =>
      preset.aliases.some((alias) => normalizePresetText(alias) === normalizePresetText(candidate.label))
    );
    if (!aliasPersisted) return preset;

    return {
      ...preset,
      id: aliasPersisted.id ?? null,
      aliases: Array.from(new Set([...preset.aliases, ...(aliasPersisted.aliases || [])])),
      // Exact persisted values may carry a manager or manufacturer-specific override.
      defaultHours: exactPersisted && Number.isFinite(Number(exactPersisted.defaultHours))
        ? Number(exactPersisted.defaultHours)
        : preset.defaultHours,
      usageCount: Number(aliasPersisted.usageCount || 0),
    };
  });

  const additionalPersisted = persistedPresetsList
    .filter((preset) => {
      const normalizedLabel = normalizePresetText(preset.label);
      return !catalogLabels.has(normalizedLabel) && !catalogAliases.has(normalizedLabel);
    })
    .map((preset) => ({ ...preset, category: preset.category || "general" }));

  return [...mergedCatalog, ...additionalPersisted];
};
