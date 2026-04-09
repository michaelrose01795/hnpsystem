import crypto from "crypto";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  getPersonalState,
  requirePersonalAccess,
  savePersonalState,
  validateWidgetType,
} from "@/lib/profile/personalServer";
import {
  buildDefaultWidgetConfig,
  getNextWidgetPlacement,
  normaliseWidgetRecord,
  sanitiseWidgetLayout,
  sortWidgetsForDisplay,
} from "@/lib/profile/personalWidgets";

function nextWidgetsFromState(state) {
  return sortWidgetsForDisplay(sanitiseWidgetLayout(Array.isArray(state.widgets) ? state.widgets : []));
}

async function handler(req, res, session) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);

    if (req.method === "GET") {
      return res.status(200).json({ success: true, data: nextWidgetsFromState(state) });
    }

    if (req.method === "POST") {
      const widgetType = String(req.body?.widgetType || "");
      validateWidgetType(widgetType);
      const allowMultipleInstances = widgetType === "custom";
      const widgets = nextWidgetsFromState(state);
      const existing = widgets.find((entry) => entry.widgetType === widgetType) || null;

      if (!allowMultipleInstances && existing?.id && existing.isVisible !== false) {
        return res.status(200).json({ success: true, data: existing });
      }

      let nextWidgets = [...widgets];
      let savedWidget = null;

      if (!allowMultipleInstances && existing?.id) {
        const placement = getNextWidgetPlacement(nextWidgets);
        nextWidgets = nextWidgets.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                isVisible: true,
                ...placement,
              }
            : entry
        );
        savedWidget = nextWidgets.find((entry) => entry.id === existing.id) || null;
      } else {
        const placement = getNextWidgetPlacement(nextWidgets);
        const customCount = nextWidgets.filter((entry) => entry.widgetType === "custom").length;
        const newWidget = normaliseWidgetRecord({
          id: crypto.randomUUID(),
          widget_type: widgetType,
          is_visible: true,
          position_x: placement.positionX,
          position_y: placement.positionY,
          width: placement.width,
          height: placement.height,
          config_json:
            widgetType === "custom"
              ? { ...buildDefaultWidgetConfig(widgetType), title: `Custom widget ${customCount + 1}` }
              : buildDefaultWidgetConfig(widgetType),
          updated_at: new Date().toISOString(),
        });
        nextWidgets = [...nextWidgets, newWidget];
        savedWidget = newWidget;
      }

      await savePersonalState(
        userId,
        {
          ...state,
          widgets: nextWidgets,
        },
        db
      );

      return res.status(200).json({ success: true, data: savedWidget });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Widget id is required." });

      const widgets = nextWidgetsFromState(state);
      const existing = widgets.find((entry) => String(entry.id) === id) || null;
      if (!existing) return res.status(404).json({ success: false, message: "Widget not found." });

      const nextWidgets = widgets.map((entry) =>
        entry.id === existing.id
          ? normaliseWidgetRecord({
              ...entry,
              positionX: req.body?.positionX ?? entry.positionX,
              positionY: req.body?.positionY ?? entry.positionY,
              width: req.body?.width ?? entry.width,
              height: req.body?.height ?? entry.height,
              isVisible: typeof req.body?.isVisible === "boolean" ? req.body.isVisible : entry.isVisible,
              config: req.body?.config || entry.config,
              updatedAt: new Date().toISOString(),
            })
          : entry
      );

      await savePersonalState(userId, { ...state, widgets: nextWidgets }, db);
      return res.status(200).json({ success: true, data: nextWidgets.find((entry) => entry.id === existing.id) });
    }

    if (req.method === "PUT") {
      const widgets = Array.isArray(req.body?.widgets) ? req.body.widgets : null;
      if (!widgets) return res.status(400).json({ success: false, message: "widgets array is required." });

      const existingMap = new Map(nextWidgetsFromState(state).map((entry) => [entry.id, entry]));
      const nextWidgets = widgets
        .map((widget, index) => {
          const existing = existingMap.get(widget.id);
          if (!existing) return null;
          return normaliseWidgetRecord({
            ...existing,
            positionX: widget.positionX,
            positionY: widget.positionY,
            width: widget.width,
            height: widget.height,
            isVisible: typeof widget.isVisible === "boolean" ? widget.isVisible : existing.isVisible,
            config: widget.config || existing.config,
            updatedAt: new Date().toISOString(),
          }, index);
        })
        .filter(Boolean);

      await savePersonalState(userId, { ...state, widgets: nextWidgets }, db);
      return res.status(200).json({ success: true, data: nextWidgetsFromState({ widgets: nextWidgets }) });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Widget id is required." });

      const widgets = nextWidgetsFromState(state);
      const existing = widgets.find((entry) => String(entry.id) === id) || null;
      if (!existing) return res.status(404).json({ success: false, message: "Widget not found." });

      const nextWidgets = widgets.map((entry) =>
        entry.id === existing.id
          ? {
              ...entry,
              isVisible: false,
            }
          : entry
      );

      await savePersonalState(userId, { ...state, widgets: nextWidgets }, db);
      return res.status(200).json({ success: true, data: { ...existing, isVisible: false } });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal widgets request.");
  }
}

export default withRoleGuard(handler);
