// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/vehicles.js
import { supabase } from "@/lib/supabaseClient";

/* ============================================
   GET VEHICLE BY REGISTRATION
   ✅ Enhanced with full field support
   Used by: Vehicle lookup API, Create job page
============================================ */
export const getVehicleByReg = async (regNumber) => {
  console.log("🔍 getVehicleByReg:", regNumber); // debug log
  
  if (!regNumber) {
    console.error("❌ Registration number required");
    return null;
  }

  const regUpper = regNumber.trim().toUpperCase();

  // ✅ Search using both old and new column names for compatibility
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      registration,
      reg_number,
      make,
      model,
      make_model,
      year,
      colour,
      vin,
      chassis,
      engine_number,
      engine,
      mileage,
      fuel_type,
      transmission,
      body_style,
      mot_due,
      service_history,
      warranty_type,
      warranty_expiry,
      insurance_provider,
      insurance_policy_number,
      customer_id,
      created_at,
      updated_at,
      customer:customer_id(
        id,
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode,
        contact_preference
      )
    `)
    .or(`registration.eq.${regUpper},reg_number.eq.${regUpper}`)
    .maybeSingle();

  if (error) {
    console.error("❌ getVehicleByReg error:", error);
    return null;
  }

  if (!data) {
    console.log("⚠️ Vehicle not found for reg:", regUpper);
    return null;
  }

  console.log("✅ Vehicle found:", data); // debug log
  return data;
};

/* ============================================
   GET ALL VEHICLES
   ✅ NEW: Returns all vehicles with pagination
============================================ */
export const getAllVehicles = async (limit = 100, offset = 0) => {
  console.log("🔍 getAllVehicles - limit:", limit, "offset:", offset); // debug log
  
  const { data, error, count } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      registration,
      reg_number,
      make,
      model,
      make_model,
      year,
      colour,
      mileage,
      mot_due,
      customer_id,
      created_at,
      updated_at,
      customer:customer_id(
        id,
        firstname,
        lastname
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("❌ getAllVehicles error:", error);
    return { data: [], count: 0 };
  }

  console.log("✅ Vehicles fetched:", data?.length || 0, "Total:", count); // debug log
  return { data: data || [], count: count || 0 };
};

/* ============================================
   GET VEHICLE BY ID
   ✅ NEW: Get vehicle by database ID
============================================ */
export const getVehicleById = async (vehicleId) => {
  console.log("🔍 getVehicleById:", vehicleId); // debug log
  
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      registration,
      reg_number,
      make,
      model,
      make_model,
      year,
      colour,
      vin,
      chassis,
      engine_number,
      engine,
      mileage,
      fuel_type,
      transmission,
      body_style,
      mot_due,
      service_history,
      warranty_type,
      warranty_expiry,
      insurance_provider,
      insurance_policy_number,
      customer_id,
      created_at,
      updated_at,
      customer:customer_id(
        id,
        firstname,
        lastname,
        email,
        mobile
      )
    `)
    .eq("vehicle_id", vehicleId)
    .single();

  if (error) {
    console.error("❌ getVehicleById error:", error);
    return null;
  }

  console.log("✅ Vehicle found:", data); // debug log
  return data;
};

/* ============================================
   GET VEHICLE MAINTENANCE HISTORY
   ✅ Enhanced with full job details
   Used by: Vehicle details page, MOT history
============================================ */
export const getVehicleMaintenanceHistory = async (vehicleId) => {
  console.log("🔍 getVehicleMaintenanceHistory for vehicle:", vehicleId); // debug log
  
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      type,
      status,
      description,
      job_source,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      created_at,
      updated_at,
      job_writeups(
        writeup_id,
        fault,
        rectification,
        task_checklist,
        created_at
      ),
      appointments(
        appointment_id,
        scheduled_time,
        status,
        notes
      ),
      vhc_checks(
        vhc_id,
        section,
        issue_title,
        issue_description
      )
    `)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ getVehicleMaintenanceHistory error:", error);
    return [];
  }

  console.log("✅ Maintenance history found:", data?.length || 0, "jobs"); // debug log
  return data || [];
};

/* ============================================
   CREATE OR UPDATE VEHICLE
   ✅ Enhanced with full field support and better duplicate handling
============================================ */
export const createOrUpdateVehicle = async (vehicleData) => {
  console.log("💾 createOrUpdateVehicle called with:", vehicleData); // debug log
  
  try {
    // ✅ Validate required fields
    if (!vehicleData.reg_number && !vehicleData.registration) {
      throw new Error("Registration number is required");
    }

    const regNumber = (vehicleData.reg_number || vehicleData.registration).trim().toUpperCase();

    // ✅ Check if vehicle already exists
    const { data: existing } = await supabase
      .from("vehicles")
      .select("vehicle_id")
      .or(`registration.eq.${regNumber},reg_number.eq.${regNumber}`)
      .maybeSingle();

    if (existing) {
      // ✅ Update existing vehicle
      console.log("🔄 Updating existing vehicle:", existing.vehicle_id);
      
      const updateData = {
        ...vehicleData,
        registration: regNumber, // NEW column
        reg_number: regNumber, // OLD column (keep for compatibility)
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("vehicles")
        .update(updateData)
        .eq("vehicle_id", existing.vehicle_id)
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Vehicle updated successfully:", data);
      return { success: true, data, updated: true };
    } else {
      // ✅ Create new vehicle
      console.log("➕ Creating new vehicle");
      
      const insertData = {
        ...vehicleData,
        registration: regNumber, // NEW column
        reg_number: regNumber, // OLD column (keep for compatibility)
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("vehicles")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Vehicle created successfully:", data);
      return { success: true, data, updated: false };
    }
  } catch (error) {
    console.error("❌ createOrUpdateVehicle error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET VEHICLE BY VIN
   ✅ Enhanced to search both vin and chassis columns
============================================ */
export const getVehicleByVin = async (vin) => {
  console.log("🔍 getVehicleByVin:", vin); // debug log
  
  if (!vin) {
    console.error("❌ VIN is required");
    return null;
  }

  const vinUpper = vin.trim().toUpperCase();

  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      registration,
      reg_number,
      make,
      model,
      make_model,
      year,
      colour,
      vin,
      chassis,
      engine_number,
      engine,
      mileage,
      fuel_type,
      transmission,
      body_style,
      mot_due,
      customer_id,
      created_at,
      customer:customer_id(
        id,
        firstname,
        lastname,
        email,
        mobile
      )
    `)
    .or(`vin.eq.${vinUpper},chassis.eq.${vinUpper}`)
    .maybeSingle();

  if (error) {
    console.error("❌ getVehicleByVin error:", error);
    return null;
  }

  if (!data) {
    console.log("⚠️ Vehicle not found for VIN:", vinUpper);
    return null;
  }

  console.log("✅ Vehicle found by VIN:", data); // debug log
  return data;
};

/* ============================================
   SEARCH VEHICLES
   ✅ NEW: Search vehicles by registration, make, model, VIN
============================================ */
export const searchVehicles = async (searchTerm) => {
  console.log("🔍 searchVehicles:", searchTerm); // debug log
  
  if (!searchTerm || searchTerm.trim().length === 0) {
    console.warn("⚠️ Empty search term");
    return [];
  }

  const term = searchTerm.trim();

  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      registration,
      reg_number,
      make,
      model,
      make_model,
      year,
      colour,
      vin,
      chassis,
      mileage,
      customer_id,
      customer:customer_id(
        id,
        firstname,
        lastname
      )
    `)
    .or(
      `registration.ilike.%${term}%,reg_number.ilike.%${term}%,make.ilike.%${term}%,model.ilike.%${term}%,make_model.ilike.%${term}%,vin.ilike.%${term}%,chassis.ilike.%${term}%`
    )
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ searchVehicles error:", error);
    return [];
  }

  console.log("✅ Search results:", data?.length || 0, "vehicles"); // debug log
  return data || [];
};

/* ============================================
   UPDATE VEHICLE
   ✅ NEW: Update specific vehicle fields
============================================ */
export const updateVehicle = async (vehicleId, updates) => {
  console.log("🔄 updateVehicle:", vehicleId, updates); // debug log
  
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("vehicles")
      .update(updateData)
      .eq("vehicle_id", vehicleId)
      .select()
      .single();

    if (error) throw error;

    console.log("✅ Vehicle updated successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ updateVehicle error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   DELETE VEHICLE
   ✅ NEW: Delete a vehicle (checks for linked jobs first)
============================================ */
export const deleteVehicle = async (vehicleId) => {
  console.log("🗑️ deleteVehicle:", vehicleId); // debug log
  
  try {
    // ✅ Check if vehicle has linked jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .limit(1);

    if (jobs && jobs.length > 0) {
      throw new Error("Cannot delete vehicle with linked jobs. Archive jobs first.");
    }

    // ✅ Proceed with deletion
    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("vehicle_id", vehicleId);

    if (error) throw error;

    console.log("✅ Vehicle deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ deleteVehicle error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   LINK VEHICLE TO CUSTOMER
   ✅ NEW: Link or update vehicle-customer relationship
============================================ */
export const linkVehicleToCustomer = async (vehicleId, customerId) => {
  console.log("🔗 linkVehicleToCustomer - vehicle:", vehicleId, "customer:", customerId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("vehicles")
      .update({ 
        customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("vehicle_id", vehicleId)
      .select()
      .single();

    if (error) throw error;

    console.log("✅ Vehicle linked to customer successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ linkVehicleToCustomer error:", error);
    return { success: false, error: { message: error.message } };
  }
};
