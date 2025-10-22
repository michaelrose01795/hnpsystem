// ✅ File location: src/lib/database/vehicles.js
import { supabase } from "../supabaseClient";

/* ============================================
   GET VEHICLE BY REGISTRATION
   Used by: Vehicle lookup API, Create job page
============================================ */
export const getVehicleByReg = async (regNumber) => {
  console.log("🔍 getVehicleByReg:", regNumber);
  
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      reg_number,
      make,
      model,
      year,
      colour,
      vin,
      engine_number,
      mileage,
      fuel_type,
      transmission,
      body_style,
      mot_due,
      customer:customer_id(
        id,
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode
      )
    `)
    .eq("reg_number", regNumber.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("❌ Error:", error);
    return null;
  }

  return data;
};

/* ============================================
   GET VEHICLE MAINTENANCE HISTORY
   Used by: Vehicle details page, MOT history
============================================ */
export const getVehicleMaintenanceHistory = async (vehicleId) => {
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      type,
      status,
      description,
      created_at,
      job_writeups(work_performed, parts_used),
      appointments(scheduled_time)
    `)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error:", error);
    return [];
  }

  return data;
};

/* ============================================
   CREATE OR UPDATE VEHICLE
============================================ */
export const createOrUpdateVehicle = async (vehicleData) => {
  try {
    const { data: existing } = await supabase
      .from("vehicles")
      .select("vehicle_id")
      .eq("reg_number", vehicleData.reg_number)
      .maybeSingle();

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("vehicles")
        .update(vehicleData)
        .eq("vehicle_id", existing.vehicle_id)
        .select()
        .single();

      return { success: !error, data, error };
    } else {
      // Create
      const { data, error } = await supabase
        .from("vehicles")
        .insert([vehicleData])
        .select()
        .single();

      return { success: !error, data, error };
    }
  } catch (error) {
    return { success: false, error };
  }
};

/* ============================================
   GET VEHICLE BY VIN
============================================ */
export const getVehicleByVin = async (vin) => {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("vin", vin)
    .maybeSingle();

  return error ? null : data;
};