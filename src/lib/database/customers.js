// ✅ File location: src/lib/database/customers.js
import { supabase } from "../supabaseClient"; // import Supabase client

/* ============================================
   GET CUSTOMER BY ID
============================================ */
export const getCustomerById = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error) {
    console.error("❌ getCustomerById error:", error.message);
    return null;
  }

  return data;
};

/* ============================================
   SEARCH CUSTOMERS
   Used by: Customer lookup popups
============================================ */
export const searchCustomers = async (searchTerm) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .or(
      `firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`
    )
    .limit(10);

  if (error) {
    console.error("❌ searchCustomers error:", error.message);
    return [];
  }

  return data;
};

/* ============================================
   GET CUSTOMER VEHICLES
   Used by: Customer detail page
============================================ */
export const getCustomerVehicles = async (customerId) => {
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      vehicle_id,
      reg_number,
      make,
      model,
      year,
      colour
    `)
    .eq("customer_id", customerId);

  if (error) {
    console.error("❌ getCustomerVehicles error:", error.message);
    return [];
  }

  return data;
};

/* ============================================
   ADD / CREATE CUSTOMER
   - Checks for duplicates by email or full name
   - Inserts a new customer
   - Returns the inserted row
============================================ */
export const addCustomerToDatabase = async (customerData) => {
  const { firstname, lastname, email } = customerData;

  try {
    // Step 1: check for duplicate
    if (email || (firstname && lastname)) {
      const { data: existing, error: checkError } = await supabase
        .from("customers")
        .select("id, firstname, lastname, email")
        .or(
          [
            email ? `email.ilike.${email}` : "",
            firstname && lastname
              ? `and(firstname.ilike.${firstname},lastname.ilike.${lastname})`
              : "",
          ]
            .filter(Boolean)
            .join(",")
        );

      if (checkError) console.warn("⚠️ duplicate check failed:", checkError.message);
      if (existing && existing.length > 0)
        throw new Error("Customer already exists with same name or email.");
    }

    // Step 2: insert new record
    const { data, error } = await supabase
      .from("customers")
      .insert([customerData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ addCustomerToDatabase error:", err.message);
    throw new Error(err.message || "Failed to add new customer.");
  }
};

/* ============================================
   UPDATE CUSTOMER
============================================ */
export const updateCustomer = async (customerId, customerData) => {
  const { data, error } = await supabase
    .from("customers")
    .update(customerData)
    .eq("id", customerId)
    .select()
    .single();

  if (error) {
    console.error("❌ updateCustomer error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
