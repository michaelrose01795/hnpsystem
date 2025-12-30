// file location: src/pages/api/tracking/equipment.js
import { getDatabaseClient } from "@/lib/database/client";

const serializeEquipment = (record) => ({
  id: record.id,
  name: record.name,
  lastChecked: record.last_checked,
  nextDue: record.next_due,
  intervalDays: record.interval_days,
  intervalMonths: record.interval_months,
  intervalLabel: record.interval_label,
  createdBy: record.created_by,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const sanitisePayload = (payload) => {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
};

export default async function handler(req, res) {
  const supabase = getDatabaseClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("tracking_equipment_tools")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to load equipment/tools", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to load equipment" });
    }

    return res.status(200).json({ success: true, data: (data || []).map(serializeEquipment) });
  }

  if (req.method === "POST") {
    const {
      name,
      lastChecked,
      nextDue,
      intervalDays,
      intervalMonths,
      intervalLabel,
      createdBy,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    const payload = sanitisePayload({
      name,
      last_checked: lastChecked || null,
      next_due: nextDue || null,
      interval_days: intervalDays || null,
      interval_months: intervalMonths || null,
      interval_label: intervalLabel || null,
      created_by: createdBy || null,
    });

    const { data, error } = await supabase
      .from("tracking_equipment_tools")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Failed to create equipment entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to create equipment entry" });
    }

    return res.status(201).json({ success: true, data: serializeEquipment(data) });
  }

  if (req.method === "PUT") {
    const {
      id,
      name,
      lastChecked,
      nextDue,
      intervalDays,
      intervalMonths,
      intervalLabel,
    } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }

    const payload = sanitisePayload({
      name,
      last_checked: lastChecked,
      next_due: nextDue,
      interval_days: intervalDays,
      interval_months: intervalMonths,
      interval_label: intervalLabel,
      updated_at: new Date().toISOString(),
    });

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "No update fields provided" });
    }

    const { data, error } = await supabase
      .from("tracking_equipment_tools")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update equipment entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to update equipment entry" });
    }

    return res.status(200).json({ success: true, data: serializeEquipment(data) });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }

    const { error } = await supabase.from("tracking_equipment_tools").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete equipment entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to delete equipment entry" });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

