import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  getPersonalState,
  mapWidgetDataRowsFromPersonalState,
  requirePersonalAccess,
  savePersonalState,
  validateWidgetType,
} from "@/lib/profile/personalServer";
import { buildDefaultWidgetData } from "@/lib/profile/personalWidgets";

async function handler(req, res, session) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);

    if (req.method === "GET") {
      const widgetType = req.query.widgetType ? String(req.query.widgetType) : null;
      const rows = mapWidgetDataRowsFromPersonalState(state);
      if (!widgetType) {
        return res.status(200).json({ success: true, data: rows });
      }
      validateWidgetType(widgetType);
      return res.status(200).json({
        success: true,
        data: rows.find((entry) => entry.widgetType === widgetType) || null,
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const widgetType = String(req.body?.widgetType || "");
      const dataJson = req.body?.data;
      validateWidgetType(widgetType);

      const nextWidgetData = {
        ...(state.widgetData || {}),
        [widgetType]: {
          id: state.widgetData?.[widgetType]?.id || null,
          widgetType,
          data: dataJson && typeof dataJson === "object" ? dataJson : buildDefaultWidgetData(widgetType),
          updatedAt: new Date().toISOString(),
        },
      };

      await savePersonalState(userId, { ...state, widgetData: nextWidgetData }, db);
      return res.status(200).json({ success: true, data: nextWidgetData[widgetType] });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal widget data request.");
  }
}

export default withRoleGuard(handler);
