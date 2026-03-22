import {
  buildPersonalApiError,
  ensureDefaultPersonalSetup,
  mapWidgetDataRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
  validateWidgetType,
} from "@/lib/profile/personalServer";

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    await ensureDefaultPersonalSetup(userId, db);

    if (req.method === "GET") {
      const widgetType = req.query.widgetType ? String(req.query.widgetType) : null;

      let query = db
        .from(PERSONAL_TABLES.widgetData)
        .select("id, user_id, widget_type, data_json, updated_at")
        .eq("user_id", userId);

      if (widgetType) {
        validateWidgetType(widgetType);
        query = query.eq("widget_type", widgetType);
      }

      const { data, error } = await query.order("widget_type", { ascending: true });
      if (error) {
        throw error;
      }

      const rows = (data || []).map(mapWidgetDataRow);
      return res.status(200).json({
        success: true,
        data: widgetType ? rows[0] || null : rows,
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const widgetType = String(req.body?.widgetType || "");
      const dataJson = req.body?.data;
      validateWidgetType(widgetType);

      const { data, error } = await db
        .from(PERSONAL_TABLES.widgetData)
        .upsert(
          {
            user_id: userId,
            widget_type: widgetType,
            data_json: dataJson && typeof dataJson === "object" ? dataJson : {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,widget_type" }
        )
        .select("id, user_id, widget_type, data_json, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: mapWidgetDataRow(data),
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal widget data request.");
  }
}
