// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/customers.js
import { supabase } from "@/lib/database/supabaseClient"; // import Supabase client
import { normalizeCustomerSlug, splitCustomerSlugParts } from "@/lib/customers/slug";
import { logFailure } from "@/lib/utils/logFailure";

// One canonical column list so every read of a customer returns the same shape.
// `notes` (internal staff notes), `preferences` (marketing/contact opt-ins),
// `name` (legacy single-field name) and the work address are all existing
// columns on public.customers that the record hub surfaces.
const CUSTOMER_SELECT_FIELDS = `
  id,
  firstname,
  lastname,
  name,
  email,
  mobile,
  telephone,
  address,
  postcode,
  work_address,
  work_postcode,
  contact_preference,
  preferences,
  notes,
  slug_key,
  created_at,
  updated_at
`;

/* ============================================
   GET CUSTOMER BY ID
   ✅ Returns complete customer data
============================================ */
export const getCustomerById = async (customerId) => {
  console.log("🔍 getCustomerById:", customerId); // debug log
  
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS)
    .eq("id", customerId)
    .single();

  if (error) {
    logFailure("❌ getCustomerById error:", error.message);
    return null;
  }

  console.log("✅ Customer found:", data); // debug log
  return data;
};

const sanitizeLikeValue = (value = "") => value.replace(/[%_]/g, "");

const fallbackCustomerLookupBySlug = async (rawSlug) => {
  const { firstName, lastName } = splitCustomerSlugParts(rawSlug);
  if (!firstName && !lastName) {
    return null;
  }

  const safeFirst = sanitizeLikeValue(firstName);
  const safeLast = sanitizeLikeValue(lastName);
  const nameFilters = [];

  if (safeFirst && safeLast) {
    nameFilters.push(
      `and(firstname.ilike.${safeFirst}%,lastname.ilike.${safeLast}%)`,
      `and(firstname.ilike.${safeLast}%,lastname.ilike.${safeFirst}%)`
    );
  } else {
    const single = sanitizeLikeValue(safeFirst || safeLast);
    if (single) {
      nameFilters.push(
        `firstname.ilike.${single}%`,
        `lastname.ilike.${single}%`
      );
    }
  }

  if (nameFilters.length === 0) {
    return null;
  }

  const filterExpression = nameFilters.join(",");

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS)
    .or(filterExpression)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logFailure("❌ fallback customer lookup error:", error.message);
    return null;
  }

  return data?.[0] || null;
};

export const getCustomerBySlug = async (customerSlug) => {
  const slugKey = normalizeCustomerSlug(customerSlug);
  if (!slugKey) {
    return fallbackCustomerLookupBySlug(customerSlug);
  }

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS)
    .eq("slug_key", slugKey)
    .maybeSingle();

  if (error) {
    logFailure("❌ getCustomerBySlug error:", error.message);
    return fallbackCustomerLookupBySlug(customerSlug);
  }

  if (data) {
    return data;
  }

  return fallbackCustomerLookupBySlug(customerSlug);
};

/* ============================================
   GET ALL CUSTOMERS
   ✅ Returns all customers with pagination support
============================================ */
export const getAllCustomers = async (limit = 100, offset = 0) => {
  console.log("🔍 getAllCustomers - limit:", limit, "offset:", offset); // debug log
  
  const { data, error, count } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS, { count: "exact" })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logFailure("❌ getAllCustomers error:", error.message);
    return { data: [], count: 0 };
  }

  console.log("✅ Customers fetched:", data?.length || 0, "Total:", count); // debug log
  return { data: data || [], count: count || 0 };
};

/* ============================================
   SEARCH CUSTOMERS
   ✅ Used by: Customer lookup popups
   ✅ Enhanced with better search logic including full name search
============================================ */
export const searchCustomers = async (searchTerm) => {
  console.log("🔍 searchCustomers:", searchTerm); // debug log

  if (!searchTerm || searchTerm.trim().length === 0) {
    console.warn("⚠️ Empty search term"); // debug log
    return [];
  }

  const term = searchTerm.trim();

  // Check if search term contains a space (potential full name search)
  const nameParts = term.split(/\s+/);

  let query = supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS);

  // If multiple words, try to match as firstname + lastname combination
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' '); // Handle cases like "John van Smith"

    query = query.or(
      `and(firstname.ilike.%${firstName}%,lastname.ilike.%${lastName}%),and(firstname.ilike.%${lastName}%,lastname.ilike.%${firstName}%),firstname.ilike.%${term}%,lastname.ilike.%${term}%,email.ilike.%${term}%,mobile.ilike.%${term}%,telephone.ilike.%${term}%,postcode.ilike.%${term}%`
    );
  } else {
    // Single word search - search across all fields
    query = query.or(
      `firstname.ilike.%${term}%,lastname.ilike.%${term}%,email.ilike.%${term}%,mobile.ilike.%${term}%,telephone.ilike.%${term}%,postcode.ilike.%${term}%`
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20); // limit to 20 results for performance

  if (error) {
    logFailure("❌ searchCustomers error:", error.message);
    throw error;
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
      engine,
      engine_capacity,
      mileage,
      fuel_type,
      transmission,
      body_style,
      mot_due,
      tax_status,
      tax_due_date,
      service_history,
      service_plan_supplier,
      service_plan_type,
      service_plan_expiry,
      warranty_type,
      warranty_expiry,
      insurance_provider,
      lease_co,
      created_at,
      updated_at
    `)
    .eq("customer_id", customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logFailure("❌ getCustomerVehicles error:", error.message);
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
      job_division,
      service_mode,
      service_address,
      service_postcode,
      access_notes,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      milage,
      requests,
      job_source,
      waiting_status,
      assigned_to,
      booked_by,
      checked_in_at,
      completed_at,
      delivery_confirmed_at,
      vhc_sent_at,
      vhc_completed_at,
      appointment_window_start,
      appointment_window_end,
      created_at,
      updated_at,
      technician:assigned_to(first_name, last_name),
      advisor:booked_by(first_name, last_name),
      parts_job_items(status, stock_status, quantity_allocated, quantity_fitted),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      job_booking_requests(request_id, status, description, price_estimate, estimated_completion, loan_car_details, confirmation_notes, submitted_at, submitted_by_name, approved_at, approved_by_name),
      delivery_stops(id, status, address, postcode, notes, stop_number, created_at),
      job_notes(
        note_id,
        job_id,
        user_id,
        note_text,
        hidden_from_customer,
        created_at,
        updated_at,
        user:user_id(first_name, last_name, email, role)
      ),
      job_requests(
        request_id,
        job_id,
        description,
        hours,
        job_type,
        sort_order,
        status,
        request_source,
        vhc_item_id,
        pre_pick_location,
        note_text,
        created_at,
        updated_at
      ),
      vhc_checks(
        vhc_id,
        section,
        issue_title,
        issue_description,
        approval_status,
        authorization_state,
        display_status,
        severity,
        approved_at,
        request_id,
        created_at,
        updated_at
      ),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at),
      invoices(
        id,
        invoice_id,
        invoice_number,
        payment_status,
        payment_method,
        paid,
        total,
        grand_total,
        invoice_total,
        due_date,
        created_at,
        invoice_date,
        sent_email_at,
        sent_portal_at,
        invoice_payments(payment_id, amount, payment_method, reference, payment_date, created_at)
      )
    `)
    .eq("customer_id", customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logFailure("❌ getCustomerJobs error:", error.message);
    return [];
  }

  console.log("✅ Customer jobs found:", data?.length || 0); // debug log
  return data || [];
};

export const getCustomerPaymentMethods = async (customerId) => {
  if (!customerId) return [];

  try {
    const response = await fetch(
      `/api/customer/payment-methods?customerId=${encodeURIComponent(customerId)}`,
      { credentials: "include" }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || "Unable to load customer payment methods.");
    }
    return Array.isArray(payload.methods) ? payload.methods : [];
  } catch (error) {
    logFailure("❌ getCustomerPaymentMethods error:", error.message);
    return [];
  }
};

export const getCustomerActivityEvents = async (customerId, { limit = 50 } = {}) => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from("customer_activity_events")
    .select(`
      event_id,
      customer_id,
      job_id,
      vehicle_id,
      activity_type,
      activity_source,
      activity_payload,
      occurred_at,
      created_by,
      creator:created_by(first_name, last_name, role)
    `)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("❌ getCustomerActivityEvents error:", error.message);
    return [];
  }

  return data || [];
};

export const getCustomerAccounts = async (customerId) => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      account_id,
      customer_id,
      account_type,
      balance,
      credit_limit,
      status,
      billing_name,
      billing_email,
      billing_phone,
      billing_address_line1,
      billing_city,
      billing_postcode,
      created_at,
      updated_at
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("❌ getCustomerAccounts error:", error.message);
    return [];
  }

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
  
  const firstname =
    (typeof customerData.firstname === "string" && customerData.firstname.trim()) ||
    (typeof customerData.firstName === "string" && customerData.firstName.trim()) ||
    "";
  const lastname =
    (typeof customerData.lastname === "string" && customerData.lastname.trim()) ||
    (typeof customerData.lastName === "string" && customerData.lastName.trim()) ||
    "";
  const email = customerData.email || null;
  const mobile = customerData.mobile || null;

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
      contact_preference: customerData.contact_preference || customerData.contactPreference || "email",
      created_at: new Date().toISOString(),
    };

    console.log("📝 Inserting customer:", customerToInsert); // debug log

    const { data, error } = await supabase
      .from("customers")
      .insert([customerToInsert])
      .select(CUSTOMER_SELECT_FIELDS)
      .single();

    if (error) throw error;

    console.log("✅ Customer created successfully:", data); // debug log
    return data;
  } catch (err) {
    logFailure("❌ addCustomerToDatabase error:", err.message);
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
    // slug_key is a GENERATED column: Postgres derives it from firstname +
    // lastname on every write, so it re-computes itself on a rename and CANNOT
    // be written to. Sending it — even unchanged — fails the whole statement
    // with "cannot insert a non-DEFAULT value into column slug_key", so it is
    // stripped here rather than maintained.
    const { slug_key: _ignoredSlugKey, ...writableFields } = customerData || {};
    const updateData = {
      ...writableFields,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select(CUSTOMER_SELECT_FIELDS)
      .single();

    if (error) {
      logFailure("❌ updateCustomer error:", error.message);
      return { success: false, error };
    }

    console.log("✅ Customer updated successfully:", data); // debug log
    return { success: true, data };
  } catch (err) {
    logFailure("❌ updateCustomer exception:", err.message);
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
    logFailure("❌ deleteCustomer error:", err.message);
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
      logFailure("❌ checkCustomerExists error:", error.message);
      return { exists: false, customer: null, error };
    }

    if (data) {
      console.log("✅ Customer exists:", data); // debug log
      return { exists: true, customer: data };
    }

    console.log("✅ Customer does not exist"); // debug log
    return { exists: false, customer: null };
  } catch (err) {
    logFailure("❌ checkCustomerExists exception:", err.message);
    return { exists: false, customer: null, error: { message: err.message } };
  }
};
export const createCustomer = async (customerData) => {
  try {
    const data = await addCustomerToDatabase(customerData); // Reuse existing insert helper
    return { success: true, data }; // Provide status wrapper expected by API routes
  } catch (error) {
    logFailure("createCustomer error", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};

/* ============================================
   CUSTOMER RECORD HUB READS
   Everything below backs /customers/[customerSlug]. Each helper stays a thin
   Supabase read so page and component files never query Supabase directly
   (CLAUDE.md §5).
============================================ */

/* Invoices owned by the customer, including any raised without a job. The
   job-embedded invoices in getCustomerJobs only cover invoices attached to a
   job, so the payment tab reads this instead to get the full ledger. */
export const getCustomerInvoices = async (customerId) => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_id,
      invoice_number,
      job_id,
      job_number,
      account_id,
      payment_status,
      payment_method,
      paid,
      total,
      grand_total,
      invoice_total,
      due_date,
      invoice_date,
      created_at,
      sent_email_at,
      sent_portal_at,
      invoice_payments(payment_id, amount, payment_method, reference, payment_date, created_at)
    `)
    .eq("customer_id", customerId)
    .order("invoice_date", { ascending: false });

  if (error) {
    logFailure("❌ getCustomerInvoices error:", error.message);
    return [];
  }

  return data || [];
};

/* Appointments booked against the customer directly. Appointments raised from a
   job carry job_id but not always customer_id, so the hub merges these with the
   job-embedded appointments from getCustomerJobs. */
export const getCustomerAppointments = async (customerId) => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      appointment_id,
      job_id,
      scheduled_time,
      status,
      notes,
      created_at,
      updated_at,
      created_by,
      creator:created_by(first_name, last_name),
      job:job_id(
        id,
        job_number,
        type,
        status,
        service_mode,
        vehicle_reg,
        vehicle_make_model,
        requests,
        technician:assigned_to(first_name, last_name),
        advisor:booked_by(first_name, last_name)
      )
    `)
    .eq("customer_id", customerId)
    .order("scheduled_time", { ascending: false });

  if (error) {
    logFailure("❌ getCustomerAppointments error:", error.message);
    return [];
  }

  return data || [];
};

/* Ledger movements for the customer's account(s). Drives the running balance
   and the "outstanding payment records" list on the Payments tab. */
export const getCustomerAccountTransactions = async (accountIds = []) => {
  const ids = (accountIds || []).filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("account_transactions")
    .select(`
      transaction_id,
      account_id,
      transaction_date,
      amount,
      type,
      description,
      job_number,
      payment_method,
      created_by,
      created_at
    `)
    .in("account_id", ids)
    .order("transaction_date", { ascending: false })
    .limit(200);

  if (error) {
    logFailure("❌ getCustomerAccountTransactions error:", error.message);
    return [];
  }

  return data || [];
};

/* Other customer rows that look like the same person. Matches on the two
   columns the create flow already treats as unique (email, mobile) plus
   surname + postcode, which is how reception spots a duplicate on the phone. */
export const findDuplicateCustomers = async (customer) => {
  if (!customer?.id) return [];

  const filters = [];
  const email = String(customer.email || "").trim();
  const mobile = String(customer.mobile || "").trim();
  const telephone = String(customer.telephone || "").trim();
  const lastname = sanitizeLikeValue(String(customer.lastname || "").trim());
  const postcode = sanitizeLikeValue(String(customer.postcode || "").trim());

  if (email) filters.push(`email.ilike.${email}`);
  if (mobile) filters.push(`mobile.eq.${mobile}`);
  if (telephone) filters.push(`telephone.eq.${telephone}`);
  if (lastname && postcode) {
    filters.push(`and(lastname.ilike.${lastname},postcode.ilike.${postcode})`);
  }

  if (!filters.length) return [];

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT_FIELDS)
    .or(filters.join(","))
    .neq("id", customer.id)
    .limit(10);

  if (error) {
    logFailure("❌ findDuplicateCustomers error:", error.message);
    return [];
  }

  return data || [];
};

/* Write one row to customer_activity_events. Used for the staff contact log and
   for recording that a staff action (statement sent, payment link issued) was
   taken against the record, so the Activity tab is a real audit trail rather
   than a portal-only feed. */
export const logCustomerActivity = async ({
  customerId,
  activityType,
  activitySource = "staff",
  payload = {},
  jobId = null,
  vehicleId = null,
  createdBy = null,
}) => {
  if (!customerId || !activityType) {
    return { success: false, error: { message: "customerId and activityType are required." } };
  }

  const { data, error } = await supabase
    .from("customer_activity_events")
    .insert([
      {
        customer_id: customerId,
        job_id: jobId,
        vehicle_id: vehicleId,
        activity_type: activityType,
        activity_source: activitySource,
        activity_payload: payload || {},
        created_by: createdBy,
      },
    ])
    .select(`
      event_id,
      customer_id,
      job_id,
      vehicle_id,
      activity_type,
      activity_source,
      activity_payload,
      occurred_at,
      created_by,
      creator:created_by(first_name, last_name, role)
    `)
    .single();

  if (error) {
    logFailure("❌ logCustomerActivity error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

/* One round-trip for the whole record page. Everything is fetched in parallel
   and every helper already fails soft to an empty list, so a single slow or
   restricted table can never blank the page. */
export const getCustomerRecordBundle = async (customerId) => {
  if (!customerId) {
    return {
      vehicles: [],
      jobs: [],
      paymentMethods: [],
      activityEvents: [],
      invoices: [],
      appointments: [],
      accounts: [],
      transactions: [],
    };
  }

  const [vehicles, jobs, paymentMethods, activityEvents, invoices, appointments, accounts] =
    await Promise.all([
      getCustomerVehicles(customerId),
      getCustomerJobs(customerId),
      getCustomerPaymentMethods(customerId),
      getCustomerActivityEvents(customerId, { limit: 200 }),
      getCustomerInvoices(customerId),
      getCustomerAppointments(customerId),
      getCustomerAccounts(customerId),
    ]);

  const transactions = await getCustomerAccountTransactions(
    (accounts || []).map((account) => account.account_id)
  );

  return {
    vehicles: vehicles || [],
    jobs: jobs || [],
    paymentMethods: paymentMethods || [],
    activityEvents: activityEvents || [],
    invoices: invoices || [],
    appointments: appointments || [],
    accounts: accounts || [],
    transactions: transactions || [],
  };
};

/* ============================================
   CUSTOMER DIRECTORY (list view)
   ✅ Used by: /customers list page
   ✅ Server-side search, sort, pagination and the
      vehicle/job counts in a single round trip.
============================================ */

// Sort keys the list page offers, mapped to the column they order on.
const CUSTOMER_DIRECTORY_SORTS = {
  recent: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  name: { column: "lastname", ascending: true },
};

export const CUSTOMER_DIRECTORY_PAGE_SIZE = 25;

// PostgREST parses `or=(...)` positionally, so a comma or bracket typed into
// the search box would split the filter into nonsense. Strip them up front.
const sanitiseCustomerSearchTerm = (value) =>
  String(value || "")
    .replace(/[,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildCustomerSearchFilter = (term) => {
  const fieldMatches = [
    `firstname.ilike.%${term}%`,
    `lastname.ilike.%${term}%`,
    `name.ilike.%${term}%`,
    `email.ilike.%${term}%`,
    `mobile.ilike.%${term}%`,
    `telephone.ilike.%${term}%`,
    `postcode.ilike.%${term}%`,
  ].join(",");

  const parts = term.split(" ").filter(Boolean);
  if (parts.length < 2) return fieldMatches;

  // "John Smith" should match firstname+lastname in either order as well as
  // any single field containing the whole phrase.
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return [
    `and(firstname.ilike.%${first}%,lastname.ilike.%${last}%)`,
    `and(firstname.ilike.%${last}%,lastname.ilike.%${first}%)`,
    fieldMatches,
  ].join(",");
};

// Embedded aggregates come back as [{ count }]. A missing key means the
// fallback select ran, so report null rather than a misleading zero.
const readEmbeddedCount = (value) => {
  if (Array.isArray(value)) return Number(value[0]?.count) || 0;
  if (value && typeof value === "object") return Number(value.count) || 0;
  return null;
};

const mapCustomerDirectoryRow = (row) => {
  const firstname = row?.firstname || "";
  const lastname = row?.lastname || "";
  const fullName = `${firstname} ${lastname}`.trim();
  return {
    ...row,
    displayName: fullName || row?.name || "Unnamed customer",
    vehicleCount: readEmbeddedCount(row?.vehicles),
    jobCount: readEmbeddedCount(row?.jobs),
  };
};

export const getCustomersDirectory = async ({
  limit = CUSTOMER_DIRECTORY_PAGE_SIZE,
  offset = 0,
  search = "",
  sort = "recent",
} = {}) => {
  const sortConfig = CUSTOMER_DIRECTORY_SORTS[sort] || CUSTOMER_DIRECTORY_SORTS.recent;
  const term = sanitiseCustomerSearchTerm(search);

  const runQuery = (selectFields) => {
    let query = supabase.from("customers").select(selectFields, { count: "exact" });
    if (term) query = query.or(buildCustomerSearchFilter(term));
    query = query.order(sortConfig.column, {
      ascending: sortConfig.ascending,
      nullsFirst: false,
    });
    if (sortConfig.column === "lastname") {
      query = query.order("firstname", { ascending: true, nullsFirst: false });
    }
    return query.range(offset, Math.max(offset, offset + limit - 1));
  };

  let { data, error, count } = await runQuery(
    `${CUSTOMER_SELECT_FIELDS}, vehicles(count), jobs(count)`
  );

  if (error) {
    // The list is more useful without the counts than not at all, so retry on
    // the plain column list if the embedded aggregates are unavailable.
    logFailure("❌ getCustomersDirectory embed error:", error.message);
    ({ data, error, count } = await runQuery(CUSTOMER_SELECT_FIELDS));
  }

  if (error) {
    logFailure("❌ getCustomersDirectory error:", error.message);
    return { data: [], count: 0, error: error.message };
  }

  return {
    data: (data || []).map(mapCustomerDirectoryRow),
    count: count || 0,
    error: null,
  };
};
