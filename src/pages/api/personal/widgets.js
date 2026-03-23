import {
  buildPersonalApiError,
  ensureDefaultPersonalSetup,
  mapWidgetRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
  syncPersonalLayout,
  validateWidgetType,
} from "@/lib/profile/personalServer";
import {
  buildDefaultWidgetConfig,
  getNextWidgetPlacement,
  getWidgetDefinition,
  normaliseWidgetRecord,
  sanitiseWidgetLayout,
  sortWidgetsForDisplay,
} from "@/lib/profile/personalWidgets";

async function fetchUserWidgets(userId, db) {
  const { data, error } = await db
    .from(PERSONAL_TABLES.widgets)
    .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return sortWidgetsForDisplay(sanitiseWidgetLayout((data || []).map(mapWidgetRow)));
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    await ensureDefaultPersonalSetup(userId, db);

    if (req.method === "GET") {
      const widgets = await fetchUserWidgets(userId, db);
      await syncPersonalLayout(userId, widgets, db);
      return res.status(200).json({ success: true, data: widgets });
    }

    if (req.method === "POST") {
      const widgetType = String(req.body?.widgetType || "");
      validateWidgetType(widgetType);

      const { data: existingRows, error: existingError } = await db
        .from(PERSONAL_TABLES.widgets)
        .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
        .eq("user_id", userId)
        .eq("widget_type", widgetType)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      const allowMultipleInstances = widgetType === "custom";
      if (!allowMultipleInstances && existing?.id && existing.is_visible === true) {
        return res.status(200).json({ success: true, data: mapWidgetRow(existing) });
      }

      const allWidgets = await fetchUserWidgets(userId, db);
      const placement = getNextWidgetPlacement(allWidgets, widgetType);

      let savedRow = null;

      if (!allowMultipleInstances && existing?.id) {
        const { data, error } = await db
          .from(PERSONAL_TABLES.widgets)
          .update({
            is_visible: true,
            position_x: placement.positionX,
            position_y: placement.positionY,
            width: placement.width,
            height: placement.height,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
          .maybeSingle();
        if (error) {
          throw error;
        }
        savedRow = data;
      } else {
        const { data, error } = await db
          .from(PERSONAL_TABLES.widgets)
          .insert({
            user_id: userId,
            widget_type: widgetType,
            is_visible: true,
            position_x: placement.positionX,
            position_y: placement.positionY,
            width: placement.width,
            height: placement.height,
            config_json: widgetType === "custom" ? { ...buildDefaultWidgetConfig(widgetType), title: `Custom widget ${(allWidgets.filter((entry) => entry.widgetType === "custom").length || 0) + 1}` } : buildDefaultWidgetConfig(widgetType),
            updated_at: new Date().toISOString(),
          })
          .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
          .maybeSingle();
        if (error) {
          throw error;
        }
        savedRow = data;
      }

      const widgets = await fetchUserWidgets(userId, db);
      await syncPersonalLayout(userId, widgets, db);
      return res.status(200).json({ success: true, data: mapWidgetRow(savedRow) });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Widget id is required." });
      }

      const { data: existing, error: existingError } = await db
        .from(PERSONAL_TABLES.widgets)
        .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }
      if (!existing?.id) {
        return res.status(404).json({ success: false, message: "Widget not found." });
      }

      const definition = getWidgetDefinition(existing.widget_type);
      const merged = normaliseWidgetRecord({
        ...existing,
        position_x: req.body?.positionX ?? existing.position_x,
        position_y: req.body?.positionY ?? existing.position_y,
        width: req.body?.width ?? existing.width,
        height: req.body?.height ?? existing.height,
        is_visible: typeof req.body?.isVisible === "boolean" ? req.body.isVisible : existing.is_visible,
        config_json: req.body?.config || existing.config_json || buildDefaultWidgetConfig(existing.widget_type),
      });

      const { data: updated, error: updateError } = await db
        .from(PERSONAL_TABLES.widgets)
        .update({
          is_visible: merged.isVisible,
          position_x: merged.positionX,
          position_y: merged.positionY,
          width: merged.width,
          height: merged.height,
          config_json: merged.config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      const widgets = await fetchUserWidgets(userId, db);
      await syncPersonalLayout(userId, widgets, db);
      return res.status(200).json({
        success: true,
        data: {
          ...mapWidgetRow(updated),
          minWidth: definition.minWidth,
          minHeight: definition.minHeight,
        },
      });
    }

    if (req.method === "PUT") {
      const widgets = Array.isArray(req.body?.widgets) ? req.body.widgets : null;
      if (!widgets) {
        return res.status(400).json({ success: false, message: "widgets array is required." });
      }

      const { data: existingRows, error: existingError } = await db
        .from(PERSONAL_TABLES.widgets)
        .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
        .eq("user_id", userId);

      if (existingError) {
        throw existingError;
      }

      const existingMap = new Map((existingRows || []).map((row) => [row.id, row]));

      for (const widget of widgets) {
        const existing = existingMap.get(widget.id);
        if (!existing) {
          continue;
        }

        const merged = normaliseWidgetRecord({
          ...existing,
          position_x: widget.positionX,
          position_y: widget.positionY,
          width: widget.width,
          height: widget.height,
          is_visible: typeof widget.isVisible === "boolean" ? widget.isVisible : existing.is_visible,
          config_json: widget.config || existing.config_json,
        });

        const { error: updateError } = await db
          .from(PERSONAL_TABLES.widgets)
          .update({
            is_visible: merged.isVisible,
            position_x: merged.positionX,
            position_y: merged.positionY,
            width: merged.width,
            height: merged.height,
            config_json: merged.config,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId);

        if (updateError) {
          throw updateError;
        }
      }

      const nextWidgets = await fetchUserWidgets(userId, db);
      await syncPersonalLayout(userId, nextWidgets, db);
      return res.status(200).json({ success: true, data: nextWidgets });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Widget id is required." });
      }

      const { data: updated, error: updateError } = await db
        .from(PERSONAL_TABLES.widgets)
        .update({
          is_visible: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", id)
        .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }
      if (!updated?.id) {
        return res.status(404).json({ success: false, message: "Widget not found." });
      }

      const widgets = await fetchUserWidgets(userId, db);
      await syncPersonalLayout(userId, widgets, db);
      return res.status(200).json({ success: true, data: mapWidgetRow(updated) });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal widgets request.");
  }
}
