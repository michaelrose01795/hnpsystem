// file location: src/pages/api/settings/company.js
// API endpoint to fetch company settings including VAT rate and labour rate

import { getDatabaseClient } from "@/lib/database/client";

const supabase = getDatabaseClient();

/**
 * GET /api/settings/company
 * Fetches company settings from the database
 *
 * Query parameters:
 * - keys: comma-separated list of setting keys to fetch (optional)
 *   Example: ?keys=vat_rate,default_labour_rate
 *   If not provided, returns all settings
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { keys } = req.query;

    let query = supabase
      .from("company_settings")
      .select("setting_key, setting_value, setting_type, description");

    // If specific keys are requested, filter by them
    if (keys) {
      const keyArray = keys.split(",").map(k => k.trim());
      query = query.in("setting_key", keyArray);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching company settings:", error);
      return res.status(500).json({
        error: "Failed to fetch company settings",
        details: error.message
      });
    }

    // Transform the data into a more convenient format
    // Convert to an object with setting_key as keys
    const settings = {};

    if (data) {
      data.forEach(setting => {
        let value = setting.setting_value;

        // Parse value based on type
        if (setting.setting_type === "number") {
          value = parseFloat(value);
        } else if (setting.setting_type === "boolean") {
          value = value === "true" || value === "1";
        } else if (setting.setting_type === "json") {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.warn(`Failed to parse JSON for ${setting.setting_key}`);
          }
        }

        settings[setting.setting_key] = value;
      });
    }

    return res.status(200).json({
      success: true,
      settings
    });

  } catch (error) {
    console.error("Unexpected error in company settings API:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
