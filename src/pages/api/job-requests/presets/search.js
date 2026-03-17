// file location: src/pages/api/job-requests/presets/search.js

import { searchJobRequestPresets } from "@/lib/database/jobRequestPresets";
import { clampSuggestionLimit, isDiagnosticRequestText, normalizePresetText } from "@/lib/jobRequestPresets/constants";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const rawQuery = String(req.query?.q || "");
    const query = normalizePresetText(rawQuery);
    const limit = clampSuggestionLimit(req.query?.limit, 8);

    const presets = await searchJobRequestPresets({ query, limit });

    res.status(200).json({
      success: true,
      query,
      suggestions: presets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        aliases: preset.aliases,
        defaultHours: preset.defaultHours,
        isDiagnostic: isDiagnosticRequestText(preset.label),
      })),
    });
  } catch (error) {
    console.error("Failed to search job request presets", error);
    res.status(500).json({ success: false, message: "Failed to load preset suggestions" });
  }
}
