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
      firstname,
      lastname,
      email,
      mobile,
      telephone,
      address,
      postcode,
      contactPreference,
    } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ success: false, error: "customerId is required" });
    }

    const updates = {
      firstname: firstname?.trim() || null,
      lastname: lastname?.trim() || null,
      email: email?.trim() || null,
      mobile: mobile?.trim() || null,
      telephone: telephone?.trim() || null,
      address: address?.trim() || null,
      postcode: postcode?.trim() || null,
      contact_preference: contactPreference?.toLowerCase() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseService
      .from("customers")
      .update(updates)
      .eq("id", customerId)
      .select(
        "id, firstname, lastname, email, mobile, telephone, address, postcode, contact_preference, updated_at"
      )
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true, customer: data });
  } catch (error) {
    console.error("❌ customer profile API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update customer details",
    });
  }
}
