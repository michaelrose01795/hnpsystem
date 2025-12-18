// file location: src/pages/api/workshop/consumables/items.js
import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  }

  const { name, supplier, unitCost } = req.body || {};
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    return res
      .status(400)
      .json({ success: false, message: "Item name is required." });
  }

  const numericUnitCost = Number(unitCost) || 0;

  try {
    const timestamp = new Date().toISOString();
    const { data: workshopConsumable, error: workshopError } = await supabase
      .from("workshop_consumables")
      .insert({
        item_name: trimmedName,
        supplier: (supplier || "").trim() || null,
        unit_cost: numericUnitCost,
        updated_at: timestamp,
        created_at: timestamp,
      })
      .select("id")
      .single();

    if (workshopError) {
      console.error("❌ Failed to insert workshop consumable", workshopError);
      throw workshopError;
    }

    const { error: stockError } = await supabase.from("consumables").insert({
      id: workshopConsumable.id,
      name: trimmedName,
      location: null,
      location_id: null,
      temporary: false,
      created_at: timestamp,
    });

    if (stockError) {
      console.error("❌ Failed to mirror consumable into stock list", stockError);
      await supabase.from("workshop_consumables").delete().eq("id", workshopConsumable.id);
      throw stockError;
    }

    return res.status(201).json({
      success: true,
      message: "Consumable created.",
    });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/items error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}
