// file location: src/pages/api/tracking/oil-stock.js
import { getDatabaseClient } from "@/lib/database/client";

const serializeOilStock = (record) => ({
  id: record.id,
  title: record.title,
  stock: record.stock,
  lastCheck: record.last_check,
  nextCheck: record.next_check,
  lastToppedUp: record.last_topped_up,
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
      .from("tracking_oil_stock")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to load oil stock entries", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to load oil stock" });
    }

    return res.status(200).json({ success: true, data: (data || []).map(serializeOilStock) });
  }

  if (req.method === "POST") {
    const {
      title,
      stock,
      lastCheck,
      nextCheck,
      lastToppedUp,
      intervalDays,
      intervalMonths,
      intervalLabel,
      createdBy,
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ success: false, message: "title is required" });
    }

    const payload = sanitisePayload({
      title,
      stock: stock || null,
      last_check: lastCheck || null,
      next_check: nextCheck || null,
      last_topped_up: lastToppedUp || null,
      interval_days: intervalDays || null,
      interval_months: intervalMonths || null,
      interval_label: intervalLabel || null,
      created_by: createdBy || null,
    });

    const { data, error } = await supabase
      .from("tracking_oil_stock")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Failed to create oil stock entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to create oil stock entry" });
    }

    return res.status(201).json({ success: true, data: serializeOilStock(data) });
  }

  if (req.method === "PUT") {
    const {
      id,
      title,
      stock,
      lastCheck,
      nextCheck,
      lastToppedUp,
      intervalDays,
      intervalMonths,
      intervalLabel,
    } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }

    const payload = sanitisePayload({
      title,
      stock,
      last_check: lastCheck,
      next_check: nextCheck,
      last_topped_up: lastToppedUp,
      interval_days: intervalDays,
      interval_months: intervalMonths,
      interval_label: intervalLabel,
      updated_at: new Date().toISOString(),
    });

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "No update fields provided" });
    }

    const { data, error } = await supabase
      .from("tracking_oil_stock")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update oil stock entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to update oil stock entry" });
    }

    return res.status(200).json({ success: true, data: serializeOilStock(data) });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }

    const { error } = await supabase.from("tracking_oil_stock").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete oil stock entry", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to delete oil stock entry" });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

