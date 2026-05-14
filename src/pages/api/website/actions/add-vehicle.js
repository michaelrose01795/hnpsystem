// file location: src/pages/api/website/actions/add-vehicle.js
// Lets a logged-in customer add a vehicle to their account directly,
// without staff needing to approve a request first. Inserts the row
// into public.vehicles linked to the customer, or attaches an existing
// unowned row. Also writes a customer_activity_events row so staff
// still see the addition on the timeline.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const reg = String(req.body?.reg ?? "").trim().toUpperCase();
  const makeModel = String(req.body?.make_model ?? "").trim();
  const mileageRaw = req.body?.mileage;
  const mileage =
    mileageRaw === null || mileageRaw === "" || mileageRaw === undefined
      ? null
      : Number(mileageRaw);
  const notes = String(req.body?.notes ?? "").trim();

  if (!reg) {
    return res.status(400).json({ success: false, message: "Enter a registration." });
  }
  if (mileage !== null && (!Number.isFinite(mileage) || mileage < 0)) {
    return res.status(400).json({ success: false, message: "Enter a valid mileage." });
  }

  const [makePart, ...modelParts] = makeModel.split(" ");
  const make = makePart || null;
  const model = modelParts.length > 0 ? modelParts.join(" ") : null;

  const client = db();
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await client
    .from("vehicles")
    .select("vehicle_id, customer_id, reg_number")
    .eq("reg_number", reg)
    .maybeSingle();

  if (lookupErr) {
    console.error("/api/website/actions/add-vehicle lookup:", lookupErr.message);
    return res.status(500).json({ success: false, message: "Could not add vehicle." });
  }

  let vehicleId;
  if (existing) {
    if (existing.customer_id && existing.customer_id !== session.customerId) {
      return res.status(409).json({
        success: false,
        message: "That registration is already linked to another account.",
      });
    }
    vehicleId = existing.vehicle_id;
    if (!existing.customer_id) {
      const update = {
        customer_id: session.customerId,
        updated_at: now,
      };
      if (make) update.make = make;
      if (model) update.model = model;
      if (makeModel) update.make_model = makeModel;
      if (mileage !== null) update.mileage = mileage;
      const { error: updErr } = await client
        .from("vehicles")
        .update(update)
        .eq("vehicle_id", vehicleId);
      if (updErr) {
        console.error("/api/website/actions/add-vehicle attach:", updErr.message);
        return res.status(500).json({ success: false, message: "Could not add vehicle." });
      }
    }
  } else {
    const insert = {
      reg_number: reg,
      registration: reg,
      customer_id: session.customerId,
      make,
      model,
      make_model: makeModel || null,
      mileage: mileage,
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error: insErr } = await client
      .from("vehicles")
      .insert(insert)
      .select("vehicle_id")
      .single();
    if (insErr || !inserted) {
      console.error("/api/website/actions/add-vehicle insert:", insErr?.message);
      return res.status(500).json({ success: false, message: "Could not add vehicle." });
    }
    vehicleId = inserted.vehicle_id;
  }

  await client.from("customer_activity_events").insert({
    customer_id: session.customerId,
    vehicle_id: vehicleId,
    activity_type: "vehicle_added",
    activity_source: "customer_portal",
    activity_payload: {
      reg,
      make_model: makeModel || null,
      mileage,
      notes: notes || null,
    },
  });

  return res.status(200).json({ success: true, vehicle_id: vehicleId });
}
