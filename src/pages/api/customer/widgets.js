import { supabaseService } from "@/lib/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const DEFAULT_CUSTOMER_DASHBOARD_WIDGETS = [
  { id: "hero", type: "hero", config: {} },
  { id: "booking-calendar", type: "booking-calendar", config: {} },
  { id: "vhc-summary", type: "vhc-summary", config: {} },
  { id: "appointment-timeline", type: "appointment-timeline", config: {} },
  { id: "customer-details", type: "customer-details", config: {} },
  { id: "vehicle-garage", type: "vehicle-garage", config: {} },
  { id: "parts-access", type: "parts-access", config: {} },
  { id: "messaging-hub", type: "messaging-hub", config: {} },
  { id: "finance-overview", type: "finance-overview", config: {} },
  { id: "tracking-overview", type: "tracking-overview", config: {} },
];

const buildSettingKey = (customerId) => `customer_portal_widgets:${customerId}`;

const sanitiseWidgets = (widgets = []) => {
  if (!Array.isArray(widgets) || widgets.length === 0) {
    return DEFAULT_CUSTOMER_DASHBOARD_WIDGETS;
  }

  return widgets
    .slice(0, 24)
    .map((widget, index) => ({
      id: String(widget?.id || `${widget?.type || "widget"}-${index + 1}`),
      type: String(widget?.type || "user-defined").trim() || "user-defined",
      config: widget?.config && typeof widget.config === "object" ? widget.config : {},
    }))
    .filter((widget) => widget.type);
};

async function handler(req, res, session) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key not configured" });
  }

  try {
    if (req.method === "GET") {
      const customerId = String(req.query?.customerId || "").trim();
      if (!customerId) {
        return res.status(400).json({ success: false, error: "customerId is required" });
      }

      const settingKey = buildSettingKey(customerId);
      const { data, error } = await supabaseService
        .from("company_settings")
        .select("setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      let widgets = DEFAULT_CUSTOMER_DASHBOARD_WIDGETS;
      if (data?.setting_value) {
        try {
          widgets = sanitiseWidgets(JSON.parse(data.setting_value));
        } catch (_parseError) {
          widgets = DEFAULT_CUSTOMER_DASHBOARD_WIDGETS;
        }
      }

      return res.status(200).json({ success: true, widgets });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const customerId = String(req.body?.customerId || "").trim();
      if (!customerId) {
        return res.status(400).json({ success: false, error: "customerId is required" });
      }

      const widgets = sanitiseWidgets(req.body?.widgets);
      const settingKey = buildSettingKey(customerId);
      const { error } = await supabaseService
        .from("company_settings")
        .upsert(
          {
            setting_key: settingKey,
            setting_value: JSON.stringify(widgets),
            setting_type: "json",
            description: "Customer portal dashboard widgets",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, widgets });
    }

    res.setHeader("Allow", ["GET", "PUT", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("❌ customer widgets API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to handle customer widgets",
    });
  }
}

export default withRoleGuard(handler);
