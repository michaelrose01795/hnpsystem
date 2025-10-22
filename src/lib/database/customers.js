// ✅ File location: src/lib/database/customers.js
import { supabase } from "../supabaseClient";

/* ============================================
   GET CUSTOMER BY ID
============================================ */
export const getCustomerById = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  return error ? null : data;
};

/* ============================================
   SEARCH CUSTOMERS
   Used by: Customer lookup popups
============================================ */
export const searchCustomers = async (searchTerm) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .or(`firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`)
    .limit(10);

  return error ? [] : data;
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

  return error ? [] : data;
};

/* ============================================
   CREATE CUSTOMER
============================================ */
export const createCustomer = async (customerData) => {
  const { data, error } = await supabase
    .from("customers")
    .insert([customerData])
    .select()
    .single();

  return { success: !error, data, error };
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

  return { success: !error, data, error };
};