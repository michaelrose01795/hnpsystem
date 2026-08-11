// file location: src/pages/api/job-requests/presets/search.js

import { listJobRequestPresets, searchJobRequestPresets } from "@/lib/database/jobRequestPresets";
import { clampSuggestionLimit, isDiagnosticRequestText, normalizePresetText } from "@/lib/jobRequestPresets/constants";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const rawQuery = String(req.query?.q || "");
    const query = normalizePresetText(rawQuery);
    const limit = clampSuggestionLimit(req.query?.limit, 8);

    const loadAll = String(req.query?.all || "") === "1";
    const presets = loadAll
      ? await listJobRequestPresets()
      : await searchJobRequestPresets({ query, limit });

    res.status(200).json({
      success: true,
      query,
      suggestions: presets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        aliases: preset.aliases,
        category: preset.category,
        defaultHours: preset.defaultHours,
        isDiagnostic: isDiagnosticRequestText(preset.label),
      })),
    });
  } catch (error) {
    console.error("Failed to search job request presets", error);
    res.status(500).json({ success: false, message: "Failed to load preset suggestions" });
  }
}

export default withRoleGuard(handler);
