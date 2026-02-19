// ✅ Parts order helpers
// file location: src/lib/database/partsOrders.js
import { getDatabaseClient } from "@/lib/database/client";

const supabase = getDatabaseClient();

/**
 * Fetches all parts job cards ("parts orders") with their basic line items.
 * Used by the job-cards Orders tab to show recent activity.
 */
export const getPartsOrders = async () => {
  const { data, error } = await supabase
    .from("parts_job_cards")
    .select(
      `
        id,
        order_number,
        status,
        priority,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        vehicle_id,
        vehicle_reg,
        vehicle_make,
        vehicle_model,
        vehicle_vin,
        delivery_type,
        delivery_address,
        delivery_contact,
        delivery_phone,
        delivery_eta,
        delivery_window,
        delivery_status,
        delivery_notes,
        invoice_reference,
        invoice_total,
        invoice_status,
        notes,
        created_by,
        created_at,
        updated_at,
        items:parts_job_card_items(
          id,
          part_number,
          part_name,
          quantity,
          unit_price
        )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ getPartsOrders error:", error);
    return [];
  }

  return data || [];
};

export default getPartsOrders;
