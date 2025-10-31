// file location: src/lib/database/customers.js
import { supabase } from "../supabaseClient"; // import Supabase client

/* ============================================
   GET CUSTOMER BY ID
   ✅ Returns complete customer data
============================================ */
export const getCustomerById = async (customerId) => {
  console.log("🔍 getCustomerById:", customerId); // debug log
  
  const { data, error } = await supabase
    .from("customers")
    .select(`
      id,
      firstname,
      lastname,
      email,
      mobile,
      telephone,
      address,
      postcode,
      contact_preference,
      created_at,
      updated_at
    `)
    .eq("id", customerId)
    .single();

  if (error) {
    console.error("❌ getCustomerById error:", error.message);
    return null;
  }

  console.log("✅ Customer found:", data); // debug log
  return data;
};

/* ============================================
   GET ALL CUSTOMERS
   ✅ Returns all customers with pagination support
============================================ */
export const getAllCustomers = async (limit = 100, offset = 0) => {
  console.log("🔍 getAllCustomers - limit:", limit, "offset:", offset); // debug log
  
  const { data, error, count } = await supabase
    .from("customers")
    .select(`
      id,
      firstname,
      lastname,
      email,
      mobile,
      telephone,
      address,
      postcode,
      contact_preference,
      created_at,
      updated_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("❌ getAllCustomers error:", error.message);
    return { data: [], count: 0 };
  }

  console.log("✅ Customers fetched:", data?.length || 0, "Total:", count); // debug log
  return { data: data || [], count: count || 0 };
};

/* ============================================
   SEARCH CUSTOMERS
   ✅ Used by: Customer lookup popups
   ✅ Enhanced with better search logic
============================================ */
export const searchCustomers = async (searchTerm) => {
  console.log("🔍 searchCustomers:", searchTerm); // debug log
  
  if (!searchTerm || searchTerm.trim().length === 0) {
    console.warn("⚠️ Empty search term"); // debug log
    return [];
  }

  const term = searchTerm.trim();

  const { data, error } = await supabase
    .from("customers")
    .select(`
      id,
      firstname,
      lastname,
      email,
      mobile,
      telephone,
      address,
      postcode,
      contact_preference,
      created_at
    `)
    .or(
      `firstname.ilike.%${term}%,lastname.ilike.%${term}%,email.ilike.%${term}%,mobile.ilike.%${term}%,telephone.ilike.%${term}%,postcode.ilike.%${term}%`
    )
    .order('created_at', { ascending: false })
    .limit(20); // limit to 20 results for performance

  if (error) {
    console.error("❌ searchCustomers error:", error.message);
    return [];
  }

  console.log("✅ Search results:", data?.length || 0, "customers"); // debug log
  return data || [];
};

/* ============================================
   GET CUSTOMER VEHICLES
   ✅ Used by: Customer detail page
   ✅ Returns all vehicles linked to a customer
============================================ */
export const getCustomerVehicles = async (customerId) => {
  console.log("🔍 getCustomerVehicles for customer:", customerId); // debug log
  
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
      fuel_type,
      transmission,
      body_style,
      mot_due,
      created_at,
      updated_at
    `)
    .eq("customer_id", customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ getCustomerVehicles error:", error.message);
    return [];
  }

  console.log("✅ Customer vehicles found:", data?.length || 0); // debug log
  return data || [];
};

/* ============================================
   GET CUSTOMER JOBS
   ✅ NEW: Returns all jobs for a customer
============================================ */
export const getCustomerJobs = async (customerId) => {
  console.log("🔍 getCustomerJobs for customer:", customerId); // debug log
  
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      type,
      status,
      vehicle_reg,
      vehicle_make_model,
      job_source,
      waiting_status,
      created_at,
      updated_at
    `)
    .eq("customer_id", customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ getCustomerJobs error:", error.message);
    return [];
  }

  console.log("✅ Customer jobs found:", data?.length || 0); // debug log
  return data || [];
};

/* ============================================
   ADD / CREATE CUSTOMER
   ✅ Enhanced with better duplicate checking
   - Checks for duplicates by email or mobile
   - Inserts a new customer
   - Returns the inserted row with full data
============================================ */
export const addCustomerToDatabase = async (customerData) => {
  console.log("➕ addCustomerToDatabase called with:", customerData); // debug log
  
  const { firstname, lastname, email, mobile } = customerData;

  try {
    // ✅ Step 1: Check for duplicate by email OR mobile (not both required)
    if (email || mobile) {
      let searchConditions = [];
      
      if (email) {
        searchConditions.push(`email.eq.${email}`);
      }
      
      if (mobile) {
        searchConditions.push(`mobile.eq.${mobile}`);
      }

      const { data: existing, error: checkError } = await supabase
        .from("customers")
        .select("id, firstname, lastname, email, mobile")
        .or(searchConditions.join(','));

      if (checkError) {
        console.warn("⚠️ Duplicate check failed:", checkError.message);
      }
      
      if (existing && existing.length > 0) {
        console.warn("⚠️ Customer already exists:", existing[0]);
        throw new Error("Customer already exists with same email or mobile number.");
      }
    }

    // ✅ Step 2: Insert new record with all fields
    const customerToInsert = {
      firstname: firstname || "",
      lastname: lastname || "",
      email: email || null,
      mobile: mobile || null,
      telephone: customerData.telephone || null,
      address: customerData.address || null,
      postcode: customerData.postcode || null,
      contact_preference: customerData.contact_preference || "email",
      created_at: new Date().toISOString(),
    };

    console.log("📝 Inserting customer:", customerToInsert); // debug log

    const { data, error } = await supabase
      .from("customers")
      .insert([customerToInsert])
      .select(`
        id,
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode,
        contact_preference,
        created_at,
        updated_at
      `)
      .single();

    if (error) throw error;

    console.log("✅ Customer created successfully:", data); // debug log
    return data;
  } catch (err) {
    console.error("❌ addCustomerToDatabase error:", err.message);
    throw new Error(err.message || "Failed to add new customer.");
  }
};

/* ============================================
   UPDATE CUSTOMER
   ✅ Enhanced with better error handling
============================================ */
export const updateCustomer = async (customerId, customerData) => {
  console.log("🔄 updateCustomer:", customerId, customerData); // debug log
  
  try {
    const updateData = {
      ...customerData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select(`
        id,
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode,
        contact_preference,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error("❌ updateCustomer error:", error.message);
      return { success: false, error };
    }

    console.log("✅ Customer updated successfully:", data); // debug log
    return { success: true, data };
  } catch (err) {
    console.error("❌ updateCustomer exception:", err.message);
    return { success: false, error: { message: err.message } };
  }
};

/* ============================================
   DELETE CUSTOMER
   ✅ NEW: Delete a customer (soft delete could be added)
============================================ */
export const deleteCustomer = async (customerId) => {
  console.log("🗑️ deleteCustomer:", customerId); // debug log
  
  try {
    // ✅ Check if customer has linked vehicles or jobs
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("vehicle_id")
      .eq("customer_id", customerId)
      .limit(1);

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("customer_id", customerId)
      .limit(1);

    if (vehicles && vehicles.length > 0) {
      throw new Error("Cannot delete customer with linked vehicles. Remove vehicle links first.");
    }

    if (jobs && jobs.length > 0) {
      throw new Error("Cannot delete customer with linked jobs. Archive jobs first.");
    }

    // ✅ Proceed with deletion
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    if (error) throw error;

    console.log("✅ Customer deleted successfully"); // debug log
    return { success: true };
  } catch (err) {
    console.error("❌ deleteCustomer error:", err.message);
    return { success: false, error: { message: err.message } };
  }
};

/* ============================================
   CHECK IF CUSTOMER EXISTS
   ✅ NEW: Quick check for duplicate customers
============================================ */
export const checkCustomerExists = async (email = null, mobile = null) => {
  console.log("🔍 checkCustomerExists - email:", email, "mobile:", mobile); // debug log
  
  if (!email && !mobile) {
    return { exists: false, customer: null };
  }

  try {
    let searchConditions = [];
    
    if (email) {
      searchConditions.push(`email.eq.${email}`);
    }
    
    if (mobile) {
      searchConditions.push(`mobile.eq.${mobile}`);
    }

    const { data, error } = await supabase
      .from("customers")
      .select("id, firstname, lastname, email, mobile")
      .or(searchConditions.join(','))
      .maybeSingle();

    if (error) {
      console.error("❌ checkCustomerExists error:", error.message);
      return { exists: false, customer: null, error };
    }

    if (data) {
      console.log("✅ Customer exists:", data); // debug log
      return { exists: true, customer: data };
    }

    console.log("✅ Customer does not exist"); // debug log
    return { exists: false, customer: null };
  } catch (err) {
    console.error("❌ checkCustomerExists exception:", err.message);
    return { exists: false, customer: null, error: { message: err.message } };
  }
};