import { supabaseService } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key not configured" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      customerId,
      nickname,
      cardBrand,
      last4,
      expiryMonth,
      expiryYear,
      isDefault = false,
    } = req.body || {};

    if (!customerId || !last4 || !expiryMonth || !expiryYear) {
      return res.status(400).json({
        success: false,
        error: "customerId, last4, expiryMonth, and expiryYear are required",
      });
    }

    if (String(last4).length !== 4) {
      return res.status(400).json({ success: false, error: "last4 must be 4 digits" });
    }

    if (isDefault) {
      await supabaseService
        .from("customer_payment_methods")
        .update({ is_default: false })
        .eq("customer_id", customerId);
    }

    const insertPayload = {
      customer_id: customerId,
      nickname: nickname || null,
      card_brand: cardBrand || "Card",
      last4: String(last4),
      expiry_month: Number(expiryMonth),
      expiry_year: Number(expiryYear),
      is_default: Boolean(isDefault),
    };

    const { data, error } = await supabaseService
      .from("customer_payment_methods")
      .insert(insertPayload)
      .select(
        "method_id, nickname, card_brand, last4, expiry_month, expiry_year, is_default, created_at"
      )
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ success: true, method: data });
  } catch (error) {
    console.error("❌ payment-methods API error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to save payment method" });
  }
}
