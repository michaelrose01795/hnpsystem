// file location: src/pages/api/parts/deliveries/index.js

import { supabase } from "@/lib/supabaseClient";

const parseInteger = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const PART_COLUMNS = [
  "id",
  "part_number",
  "name",
  "supplier",
  "storage_location",
  "qty_in_stock",
  "qty_on_order",
  "unit_cost",
  "unit_price",
].join(",");

const STORAGE_LOCATION_CODES = Array.from({ length: 26 })
  .map((_, letterIndex) => {
    const letter = String.fromCharCode(65 + letterIndex);
    return Array.from({ length: 10 }).map((__, numberIndex) => `${letter}${numberIndex + 1}`);
  })
  .flat();

const VALID_STORAGE_LOCATIONS = new Set(STORAGE_LOCATION_CODES);

const normaliseLocation = (value = "") =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { status = "all", limit = "50", offset = "0" } = req.query;

    try {
      const from = Number.parseInt(offset, 10) || 0;
      const to = from + (Number.parseInt(limit, 10) || 50) - 1;

      let query = supabase
        .from("parts_deliveries")
        .select(
          `*, delivery_items:parts_delivery_items(*, part:parts_catalog(${PART_COLUMNS}))`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return res.status(200).json({
        success: true,
        deliveries: data || [],
        count: count || 0,
      });
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch deliveries",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const { items = [], userId, ...deliveryData } = req.body || {};

    try {
      const deliveryPayload = {
        supplier: deliveryData.supplier || null,
        order_reference: deliveryData.orderReference || null,
        status: deliveryData.status || "ordering",
        expected_date: deliveryData.expectedDate || null,
        received_date: deliveryData.receivedDate || null,
        notes: deliveryData.notes || null,
        created_by: userId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: delivery, error: deliveryError } = await supabase
        .from("parts_deliveries")
        .insert([deliveryPayload])
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      for (const item of items) {
        if (!item.partId) continue;

        const quantityOrdered = Math.max(0, parseInteger(item.quantityOrdered, 0));
        const quantityReceived = Math.max(0, parseInteger(item.quantityReceived, 0));
        const unitCost = parseNumber(item.unitCost);
        const unitPrice = parseNumber(item.unitPrice);
        const requestedLocation = normaliseLocation(item.storageLocation || "");
        const storageLocation = VALID_STORAGE_LOCATIONS.has(requestedLocation)
          ? requestedLocation
          : null;

        const itemPayload = {
          delivery_id: delivery.id,
          part_id: item.partId,
          job_id: item.jobId || null,
          quantity_ordered: quantityOrdered,
          quantity_received: quantityReceived,
          unit_cost: unitCost,
          unit_price: unitPrice,
          status:
            item.status ||
            (quantityReceived > 0
              ? quantityReceived >= quantityOrdered
                ? "received"
                : "partial"
              : "ordered"),
          notes: item.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: deliveryItem, error: itemError } = await supabase
          .from("parts_delivery_items")
          .insert([itemPayload])
          .select(`*, part:parts_catalog(${PART_COLUMNS})`)
          .single();

        if (itemError) throw itemError;

        const { data: currentPart, error: partError } = await supabase
          .from("parts_catalog")
          .select("qty_in_stock, qty_on_order")
          .eq("id", item.partId)
          .single();

        if (partError) throw partError;

        const orderedDelta = quantityOrdered;
        const receivedDelta = quantityReceived;
        const onOrderReduction = Math.min(quantityReceived, quantityOrdered);

        let newInStock = currentPart.qty_in_stock + receivedDelta;
        let newOnOrder = currentPart.qty_on_order + orderedDelta - onOrderReduction;

        const partUpdatePayload = {
          qty_in_stock: newInStock,
          qty_on_order: newOnOrder,
          updated_at: new Date().toISOString(),
          updated_by: userId || null,
        };

        if (storageLocation) {
          partUpdatePayload.storage_location = storageLocation;
        }

        const { error: updateError } = await supabase
          .from("parts_catalog")
          .update(partUpdatePayload)
          .eq("id", item.partId);

        if (updateError) throw updateError;

        if (receivedDelta > 0) {
          await supabase.from("parts_stock_movements").insert([
            {
              part_id: item.partId,
              delivery_item_id: deliveryItem.id,
              movement_type: "delivery",
              quantity: receivedDelta,
              unit_cost: deliveryItem.unit_cost ?? unitCost ?? 0,
              unit_price: deliveryItem.unit_price ?? unitPrice ?? 0,
              performed_by: userId || null,
              reference: `delivery:${delivery.id}`,
              notes: item.notes || null,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }

      const { data: completeDelivery, error: fetchError } = await supabase
        .from("parts_deliveries")
        .select(
          `*, delivery_items:parts_delivery_items(*, part:parts_catalog(${PART_COLUMNS}))`
        )
        .eq("id", delivery.id)
        .single();

      if (fetchError) throw fetchError;

      return res.status(201).json({
        success: true,
        delivery: completeDelivery,
      });
    } catch (err) {
      console.error("Error creating delivery:", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to process delivery",
        error: err?.message || err,
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
