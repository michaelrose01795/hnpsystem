// file location: src/lib/database/jobs.js
import { supabase } from "../supabaseClient";
import { ensureUserIdForDisplayName } from "../users/devUsers";
import dayjs from "dayjs";

/* ============================================
   FETCH ALL JOBS
   Gets all jobs along with linked vehicles, customers,
   technicians, appointments, VHC checks, parts, notes, write-ups, and files
============================================ */
export const getAllJobs = async () => {
  console.log("🔍 getAllJobs: Starting fetch..."); // Debug log
  
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      maintenance_info,
      created_at,
      updated_at,
      vehicle:vehicle_id(
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
      ),
      technician:assigned_to(user_id, first_name, last_name, email, role),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at),
      parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, created_at, updated_at),
      parts_job_items(
        id,
        part_id,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        status,
        origin,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        part:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      job_notes(note_id, note_text, user_id, created_at, updated_at),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, labour_time, technician_id, created_at, updated_at),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at)
    `)
    .order('created_at', { ascending: false }); // Order by newest first

  if (error) {
    console.error("❌ getAllJobs error:", error);
    return [];
  }

  console.log("✅ getAllJobs fetched:", data?.length || 0, "jobs"); // Debug log

  return data.map((job) => formatJobData(job));
};

/* ============================================
   GET DASHBOARD DATA
   Returns all jobs and today's appointments
============================================ */
export const getDashboardData = async () => {
  const allJobs = await getAllJobs();

  const today = dayjs().format("YYYY-MM-DD");
  const { data: appointmentsData, error } = await supabase
    .from("appointments")
    .select(`
      appointment_id,
      scheduled_time,
      notes,
      status,
      created_at,
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        vehicle:vehicle_id(
          registration,
          reg_number,
          make,
          model,
          make_model
        )
      )
    `)
    .gte("scheduled_time", `${today}T00:00:00`)
    .lte("scheduled_time", `${today}T23:59:59`)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error("❌ Error fetching today's appointments:", error);
    return { allJobs, appointments: [] };
  }

  const appointments = (appointmentsData || []).map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    status: a.status,
    createdAt: a.created_at,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle_reg || a.job?.vehicle?.registration || a.job?.vehicle?.reg_number || "",
      make: a.job?.vehicle?.make || "",
      model: a.job?.vehicle?.model || "",
      makeModel: a.job?.vehicle_make_model || a.job?.vehicle?.make_model || "",
    },
  }));

  return { allJobs, appointments };
};

/* ============================================
   FETCH JOB BY JOB NUMBER
   Retrieves complete job data by job number
============================================ */
export const getJobByNumber = async (jobNumber) => {
  console.log("🔍 getJobByNumber: Searching for:", jobNumber); // Debug log
  
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      maintenance_info,
      created_at,
      updated_at,
      vehicle:vehicle_id(
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
        customer:customer_id(
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
        )
      ),
      technician:assigned_to(user_id, first_name, last_name, email, role, phone),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at),
      parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, created_at, updated_at),
      parts_job_items(
        id,
        part_id,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        status,
        origin,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        part:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      job_notes(note_id, note_text, user_id, created_at, updated_at),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, labour_time, technician_id, created_at, updated_at),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at)
    `)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (jobError) {
    console.error("❌ getJobByNumber error:", jobError);
    return { data: null, error: jobError };
  }

  if (!jobData) {
    console.log("⚠️ Job not found by job_number"); // Debug log
    return { data: null, error: { message: "Job not found" } };
  }

  console.log("✅ Job found by job_number:", jobData.job_number); // Debug log
  
  // Return structured data with customer and vehicle history
  return { 
    data: {
      jobCard: formatJobData(jobData),
      customer: jobData.vehicle?.customer ? {
        customerId: jobData.vehicle.customer.id,
        firstName: jobData.vehicle.customer.firstname,
        lastName: jobData.vehicle.customer.lastname,
        email: jobData.vehicle.customer.email,
        mobile: jobData.vehicle.customer.mobile,
        telephone: jobData.vehicle.customer.telephone,
        address: jobData.vehicle.customer.address,
        postcode: jobData.vehicle.customer.postcode,
        contactPreference: jobData.vehicle.customer.contact_preference,
        createdAt: jobData.vehicle.customer.created_at,
        updatedAt: jobData.vehicle.customer.updated_at,
      } : null,
      vehicle: jobData.vehicle ? {
        vehicleId: jobData.vehicle.vehicle_id,
        reg: jobData.vehicle.registration || jobData.vehicle.reg_number,
        make: jobData.vehicle.make,
        model: jobData.vehicle.model,
        makeModel: jobData.vehicle.make_model,
        year: jobData.vehicle.year,
        colour: jobData.vehicle.colour,
        vin: jobData.vehicle.vin,
        chassis: jobData.vehicle.chassis,
        engineNumber: jobData.vehicle.engine_number,
        engine: jobData.vehicle.engine,
        mileage: jobData.vehicle.mileage,
        fuelType: jobData.vehicle.fuel_type,
        transmission: jobData.vehicle.transmission,
        bodyStyle: jobData.vehicle.body_style,
        motDue: jobData.vehicle.mot_due,
        serviceHistory: jobData.vehicle.service_history,
        warrantyType: jobData.vehicle.warranty_type,
        warrantyExpiry: jobData.vehicle.warranty_expiry,
        insuranceProvider: jobData.vehicle.insurance_provider,
        insurancePolicyNumber: jobData.vehicle.insurance_policy_number,
      } : null,
      customerJobHistory: [], // TODO: Fetch customer's other jobs
      vehicleJobHistory: [], // TODO: Fetch vehicle's other jobs
    }, 
    error: null 
  };
};

/* ============================================
   FETCH JOB BY JOB NUMBER OR VEHICLE REG
   Updated to work with actual table structure
============================================ */
export const getJobByNumberOrReg = async (searchTerm) => {
  console.log("🔍 getJobByNumberOrReg: Searching for:", searchTerm); // Debug log
  
  // Try searching by job_number first
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      maintenance_info,
      created_at,
      updated_at,
      vehicle:vehicle_id(
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
      ),
      technician:assigned_to(user_id, first_name, last_name, email),
      appointments(appointment_id, scheduled_time, status, notes),
      vhc_checks(vhc_id, section, issue_title, issue_description),
      parts_requests(request_id, part_id, quantity, status),
      parts_job_items(
        id,
        part_id,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        status,
        origin,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        part:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      job_notes(note_id, note_text, created_at),
      job_writeups(writeup_id, work_performed, parts_used, recommendations),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_at)
    `)
    .eq("job_number", searchTerm)
    .maybeSingle();

  if (jobError) {
    console.error("❌ getJobByNumberOrReg error:", jobError);
    return null;
  }

  if (!jobData) {
    console.log("⚠️ Job not found by job_number, trying registration..."); // Debug log
    
    // If not found by job number, try by vehicle_reg field
    const { data: vehicleJobs, error: vehicleError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        customer_id,
        vehicle_id,
        vehicle_reg,
        vehicle_make_model,
        waiting_status,
        job_source,
        job_categories,
        requests,
        cosmetic_notes,
        vhc_required,
        maintenance_info,
        created_at,
        updated_at,
        vehicle:vehicle_id(
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
        ),
        technician:assigned_to(user_id, first_name, last_name, email),
        appointments(appointment_id, scheduled_time, status, notes),
        vhc_checks(vhc_id, section, issue_title, issue_description),
        parts_requests(request_id, part_id, quantity, status),
        parts_job_items(
          id,
          part_id,
          quantity_requested,
          quantity_allocated,
          quantity_fitted,
          status,
          origin,
          pre_pick_location,
          storage_location,
          unit_cost,
          unit_price,
          request_notes,
          allocated_by,
          picked_by,
          fitted_by,
          created_at,
          updated_at,
          part:part_id(
            id,
            part_number,
            name,
            description,
            unit_cost,
            unit_price,
            qty_in_stock,
            qty_reserved,
            qty_on_order,
            storage_location
          )
        ),
        job_notes(note_id, note_text, created_at),
        job_writeups(writeup_id, work_performed, parts_used, recommendations),
        job_files(file_id, file_name, file_url, file_type, folder, uploaded_at)
      `)
      .eq("vehicle_reg", searchTerm.toUpperCase());

    if (vehicleError || !vehicleJobs || vehicleJobs.length === 0) {
      console.log("❌ Job not found by registration either"); // Debug log
      return null;
    }

    const data = vehicleJobs[0];
    console.log("✅ Job found by registration:", data.job_number); // Debug log
    
    return formatJobData(data);
  }

  console.log("✅ Job found by job_number:", jobData.job_number); // Debug log
  return formatJobData(jobData);
};

const normalizeBooleanField = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return Boolean(value);
};

// ✅ Ensure note fields always render with bullet (-) prefixes per requirements
const ensureBulletFormat = (value = "") => {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const cleaned = trimmed.replace(/^-+\s*/, "");
      return `- ${cleaned}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
};

// ✅ Convert stored requests (array/object/string) into numbered checklist items
const normaliseRequestsForWriteUp = (requests) => {
  if (!requests) return [];

  let requestArray = [];

  if (Array.isArray(requests)) {
    requestArray = requests;
  } else if (typeof requests === "string") {
    try {
      const parsed = JSON.parse(requests);
      if (Array.isArray(parsed)) {
        requestArray = parsed;
      } else if (requests.includes("\n")) {
        requestArray = requests.split(/\r?\n/);
      } else if (requests.trim()) {
        requestArray = [requests];
      }
    } catch (error) {
      const segments = requests.split(/\r?\n/).map((segment) => segment.trim()).filter(Boolean);
      requestArray = segments;
    }
  }

  return requestArray
    .map((entry, index) => {
      const rawText =
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry !== null
            ? entry.text ?? entry.note ?? entry.description ?? ""
            : "";
      const cleaned = (rawText || "").toString().trim();
      if (!cleaned) return null;
      return {
        source: "request",
        sourceKey: `req-${index + 1}`,
        label: `Request ${index + 1}: ${cleaned}`,
        raw: cleaned,
      };
    })
    .filter(Boolean);
};

// ✅ Extract authorised VHC items for checklist integration
const deriveAuthorisedWorkItems = (authorizationRows = []) => {
  if (!Array.isArray(authorizationRows) || authorizationRows.length === 0) {
    return [];
  }

  const latestAuthorization = authorizationRows[0];
  const rawItems = Array.isArray(latestAuthorization?.authorized_items)
    ? latestAuthorization.authorized_items
    : [];

  return rawItems
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const descriptorParts = [
        item.category,
        item.item ?? item.description ?? item.text ?? item.note ?? "",
      ].filter((segment) => Boolean(segment && `${segment}`.trim()));

      const amountCandidate =
        item.total_price ?? item.amount ?? item.authorized ?? item.price ?? item.cost ?? null;

      if (amountCandidate !== null && amountCandidate !== undefined) {
        const numericAmount = Number.parseFloat(amountCandidate);
        if (Number.isFinite(numericAmount)) {
          descriptorParts.push(`£${numericAmount.toFixed(2)}`);
        } else if (typeof amountCandidate === "string" && amountCandidate.trim()) {
          descriptorParts.push(amountCandidate.trim());
        }
      }

      const descriptor = descriptorParts.join(" • ");
      if (!descriptor) return null;

      return {
        source: "vhc",
        sourceKey: `vhc-${latestAuthorization.id}-${item.id ?? index + 1}`,
        label: `Authorized Work: ${descriptor}`,
        raw: descriptor,
        authorizationId: latestAuthorization.id,
      };
    })
    .filter(Boolean);
};

// ✅ Normalise stored task status values
const sanitiseTaskStatus = (status) => (status === "complete" ? "complete" : "additional_work");

// ✅ Merge stored tasks with live request/VHC sources
const buildWriteUpTaskList = ({ storedTasks = [], requestItems = [], authorisedItems = [] }) => {
  const registry = new Map();

  (storedTasks || []).forEach((task) => {
    if (!task) return;
    const key = `${task.source}:${task.source_key}`;
    registry.set(key, {
      taskId: task.task_id,
      source: task.source,
      sourceKey: task.source_key,
      label: task.label,
      status: sanitiseTaskStatus(task.status),
    });
  });

  const merged = [];

  requestItems.forEach((item) => {
    const key = `${item.source}:${item.sourceKey}`;
    const existing = registry.get(key);
    if (existing) {
      merged.push({ ...existing, label: item.label });
      registry.delete(key);
    } else {
      merged.push({
        taskId: null,
        source: item.source,
        sourceKey: item.sourceKey,
        label: item.label,
        status: "additional_work",
      });
    }
  });

  authorisedItems.forEach((item) => {
    const key = `${item.source}:${item.sourceKey}`;
    const existing = registry.get(key);
    if (existing) {
      merged.push({ ...existing, label: item.label });
      registry.delete(key);
    } else {
      merged.push({
        taskId: null,
        source: item.source,
        sourceKey: item.sourceKey,
        label: item.label,
        status: "additional_work",
      });
    }
  });

  registry.forEach((task) => {
    merged.push(task);
  });

  return merged;
};

// ✅ Decide write-up completion state from checklist
const determineCompletionStatus = (tasks, fallbackStatus = "additional_work") => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return fallbackStatus || "additional_work";
  }
  return tasks.every((task) => task.status === "complete") ? "complete" : "additional_work";
};

/* ============================================
   HELPER: FORMAT JOB DATA
   Converts database format to application format
   NOW INCLUDES ALL FIELDS FROM DATABASE
============================================ */
const hydrateVhcChecks = (checks = []) =>
  (checks || []).map((check) => {
    if (!check || typeof check !== "object") return check;

    let structuredData = null;
    const candidate = check.data ?? check.issue_description;

    if (candidate) {
      try {
        const parsed =
          typeof candidate === "string" ? JSON.parse(candidate) : candidate;

        if (parsed && typeof parsed === "object") {
          structuredData = parsed;
        }
      } catch (_err) {
        // Ignore parse errors – some legacy rows store plain text
      }
    }

    return { ...check, data: structuredData };
  });

const formatJobData = (data) => {
  if (!data) return null;

  // Normalise technician information so UI layers can rely on assignedTech
  const assignedTech = (() => {
    const technicianRecord =
      (data.technician_user && typeof data.technician_user === "object"
        ? data.technician_user
        : null) ||
      (data.technician && typeof data.technician === "object"
        ? data.technician
        : null);

    if (technicianRecord) {
      const firstName = technicianRecord.first_name?.trim() || "";
      const lastName = technicianRecord.last_name?.trim() || "";
      const derivedName = [firstName, lastName].filter(Boolean).join(" ").trim();

      return {
        id: technicianRecord.user_id || null,
        name: derivedName || firstName || technicianRecord.email || "",
        fullName: derivedName || firstName || technicianRecord.email || "",
        email: technicianRecord.email || "",
        role: technicianRecord.role || "",
      };
    }

    const assignedName =
      typeof data.technician === "string"
        ? data.technician.trim()
        : typeof data.assigned_to === "string"
        ? data.assigned_to.trim()
        : null;

    if (assignedName) {
      return {
        id: null,
        name: assignedName,
        fullName: assignedName,
        email: "",
        role: "",
      };
    }

    return null;
  })();

  const partsRequests = (data.parts_requests || []).map((partRequest) => ({
    requestId: partRequest.request_id,
    request_id: partRequest.request_id,
    partId: partRequest.part_id,
    part_id: partRequest.part_id,
    quantity: partRequest.quantity ?? null,
    status: partRequest.status || null,
    requestedBy: partRequest.requested_by || null,
    approvedBy: partRequest.approved_by || null,
    createdAt: partRequest.created_at || null,
    updatedAt: partRequest.updated_at || null,
    part: partRequest.part
      ? {
          id: partRequest.part.id || null,
          partNumber: partRequest.part.part_number || "",
          name: partRequest.part.name || "",
        }
      : null,
  }));

  const partsAllocations = (data.parts_job_items || []).map((item) => ({
    id: item.id,
    partId: item.part_id,
    quantityRequested: item.quantity_requested ?? 0,
    quantityAllocated: item.quantity_allocated ?? 0,
    quantityFitted: item.quantity_fitted ?? 0,
    status: item.status || "pending",
    origin: item.origin || null,
    prePickLocation: item.pre_pick_location || null,
    storageLocation: item.storage_location || item.part?.storage_location || null,
    unitCost: item.unit_cost ?? item.part?.unit_cost ?? 0,
    unitPrice: item.unit_price ?? item.part?.unit_price ?? 0,
    requestNotes: item.request_notes || "",
    allocatedBy: item.allocated_by || null,
    pickedBy: item.picked_by || null,
    fittedBy: item.fitted_by || null,
    createdAt: item.created_at || null,
    updatedAt: item.updated_at || null,
    part: item.part
      ? {
          id: item.part.id,
          partNumber: item.part.part_number,
          name: item.part.name,
          description: item.part.description,
          unitCost: item.part.unit_cost,
          unitPrice: item.part.unit_price,
          qtyInStock: item.part.qty_in_stock,
          qtyReserved: item.part.qty_reserved,
          qtyOnOrder: item.part.qty_on_order,
          storageLocation: item.part.storage_location,
        }
      : null,
  }));

  return {
    id: data.id,
    jobNumber: data.job_number,
    description: data.description,
    type: data.type,
    status: data.status,
    
    // ✅ Vehicle info from both direct fields and joined table
    reg: data.vehicle_reg || data.vehicle?.registration || data.vehicle?.reg_number || "",
    make: data.vehicle?.make || "",
    model: data.vehicle?.model || "",
    makeModel: data.vehicle_make_model || data.vehicle?.make_model || "",
    year: data.vehicle?.year || "",
    colour: data.vehicle?.colour || "",
    vin: data.vehicle?.vin || "",
    chassis: data.vehicle?.chassis || "",
    engineNumber: data.vehicle?.engine_number || "",
    engine: data.vehicle?.engine || "",
    mileage: data.vehicle?.mileage || "",
    fuelType: data.vehicle?.fuel_type || "",
    transmission: data.vehicle?.transmission || "",
    bodyStyle: data.vehicle?.body_style || "",
    motDue: data.vehicle?.mot_due || "",
    
    // ✅ NEW: Job-specific fields
    waitingStatus: data.waiting_status || "Neither",
    jobSource: data.job_source || "Retail",
    jobCategories: data.job_categories || [],
    requests: data.requests || [],
    cosmeticNotes: data.cosmetic_notes || "",
    vhcRequired: normalizeBooleanField(data.vhc_required),
    maintenanceInfo: data.maintenance_info || {},
    
    // ✅ Technician info
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : assignedTech?.name || "",
    technicianEmail: data.technician?.email || assignedTech?.email || "",
    technicianRole: data.technician?.role || assignedTech?.role || "",
    assignedTo: data.assigned_to,
    assignedTech,
    
    // ✅ Customer info
    customer: data.vehicle?.customer
      ? `${data.vehicle.customer.firstname} ${data.vehicle.customer.lastname}`
      : "",
    customerId: data.customer_id || data.vehicle?.customer?.id || null,
    customerPhone: data.vehicle?.customer?.mobile || data.vehicle?.customer?.telephone || "",
    customerEmail: data.vehicle?.customer?.email || "",
    customerAddress: data.vehicle?.customer?.address || "",
    customerPostcode: data.vehicle?.customer?.postcode || "",
    customerContactPreference: data.vehicle?.customer?.contact_preference || "email",
    
    // ✅ Appointment info
    appointment: data.appointments?.[0]
      ? {
          appointmentId: data.appointments[0].appointment_id,
          date: dayjs(data.appointments[0].scheduled_time).format("YYYY-MM-DD"),
          time: dayjs(data.appointments[0].scheduled_time).format("HH:mm"),
          status: data.appointments[0].status,
          notes: data.appointments[0].notes || "",
          createdAt: data.appointments[0].created_at,
          updatedAt: data.appointments[0].updated_at,
        }
      : null,
    
    // ✅ Related data
    vhcChecks: hydrateVhcChecks(data.vhc_checks),
    partsRequests,
    partsAllocations,
    notes: data.job_notes || [],
    writeUp: data.job_writeups?.[0] || null,
    files: data.job_files || [], // ✅ NEW: File attachments
    
    // ✅ Timestamps
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

/* ============================================
   ADD JOB TO DATABASE
   Creates a new job and links it to vehicle and customer
   ✅ NOW SAVES ALL FIELDS
============================================ */
export const addJobToDatabase = async ({ 
  regNumber, 
  jobNumber, 
  description, 
  type, 
  assignedTo,
  customerId,
  vehicleId,
  waitingStatus,
  jobSource,
  jobCategories,
  requests,
  cosmeticNotes,
  vhcRequired,
  maintenanceInfo,
}) => {
  try {
    console.log("➕ addJobToDatabase called with:", { 
      regNumber, jobNumber, description, type, assignedTo, customerId, vehicleId,
      waitingStatus, jobSource, jobCategories, requests, cosmeticNotes, vhcRequired, maintenanceInfo
    });

    // Find the vehicle by registration number if vehicleId not provided
    let finalVehicleId = vehicleId;
    let vehicleData = null;
    
    if (!finalVehicleId && regNumber) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .select("vehicle_id, registration, reg_number, make_model, customer_id")
        .or(`registration.eq.${regNumber},reg_number.eq.${regNumber}`)
        .maybeSingle();

      if (vehicleError) {
        console.error("❌ Error finding vehicle:", vehicleError);
        throw vehicleError;
      }

      if (!vehicle) {
        console.error("❌ Vehicle not found for reg:", regNumber);
        return { 
          success: false, 
          error: { message: `Vehicle with registration ${regNumber} not found` } 
        };
      }

      finalVehicleId = vehicle.vehicle_id;
      vehicleData = vehicle;
      console.log("✅ Vehicle found:", vehicle);
    }

    // ✅ Create the job with ALL fields
    const jobInsert = {
      job_number: jobNumber,
      vehicle_id: finalVehicleId,
      customer_id: customerId || vehicleData?.customer_id || null,
      vehicle_reg: regNumber?.toUpperCase() || "",
      vehicle_make_model: vehicleData?.make_model || "",
      assigned_to: assignedTo || null,
      type: type || "Service",
      description: description || "",
      status: "Open",
      waiting_status: waitingStatus || "Neither",
      job_source: jobSource || "Retail",
      job_categories: jobCategories || [],
      requests: requests || [],
      cosmetic_notes: cosmeticNotes || null,
      vhc_required: normalizeBooleanField(vhcRequired),
      maintenance_info: maintenanceInfo || {},
      created_at: new Date().toISOString(),
    };

    console.log("📝 Inserting job with data:", jobInsert);

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert([jobInsert])
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle_reg,
        vehicle_make_model,
        waiting_status,
        job_source,
        job_categories,
        requests,
        cosmetic_notes,
        vhc_required,
        maintenance_info,
        created_at,
        vehicle:vehicle_id(
          vehicle_id,
          registration,
          reg_number,
          make,
          model,
          make_model,
          customer:customer_id(
            id,
            firstname,
            lastname,
            email,
            mobile
          )
        )
      `)
      .single();

    if (jobError) {
      console.error("❌ Error creating job:", jobError);
      throw jobError;
    }

    console.log("✅ Job successfully added:", job);

    return { success: true, data: formatJobData(job) };
  } catch (error) {
    console.error("❌ Error adding job:", error);
    return { 
      success: false, 
      error: { message: error.message || "Failed to create job" } 
    };
  }
};

/* ============================================
   UPDATE JOB
   ✅ NEW: Update any job field
============================================ */
export const updateJob = async (jobId, updates) => {
  try {
    console.log("🔄 Updating job:", jobId, "with updates:", updates);

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(updates, "vhc_required")) {
      payload.vhc_required = normalizeBooleanField(updates.vhc_required);
    }
    
    const { data, error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", jobId)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating job:", error);
      return { success: false, error };
    }

    console.log("✅ Job updated successfully:", data);
    return { success: true, data: formatJobData(data) };
  } catch (error) {
    console.error("❌ Exception updating job:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   UPDATE JOB STATUS
============================================ */
export const updateJobStatus = async (jobId, newStatus) => {
  return updateJob(jobId, { status: newStatus });
};

/* ============================================
   ASSIGN TECHNICIAN TO JOB
   Assigns a technician and updates status to "Assigned"
============================================ */
export const assignTechnicianToJob = async (
  jobId,
  technicianIdentifier,
  technicianName
) => {
  let resolvedTechnicianId = null;

  if (typeof technicianIdentifier !== "undefined" && technicianIdentifier !== null) {
    const parsed = Number(technicianIdentifier);
    if (Number.isInteger(parsed) && !Number.isNaN(parsed)) {
      resolvedTechnicianId = parsed;
    }
  }

  if (resolvedTechnicianId == null) {
    const displayName = String(technicianName || technicianIdentifier || "").trim();

    if (!displayName) {
      return {
        success: false,
        error: { message: "Technician name or id is required" },
      };
    }

    try {
      const ensuredId = await ensureUserIdForDisplayName(displayName);
      if (ensuredId != null) {
        resolvedTechnicianId = ensuredId;
      }
    } catch (err) {
      console.error("❌ Failed to resolve technician id:", err);
      return {
        success: false,
        error: { message: err?.message || "Failed to resolve technician id" },
      };
    }
  }

  if (resolvedTechnicianId == null) {
    return {
      success: false,
      error: { message: "Unable to resolve technician id" },
    };
  }

  return updateJob(jobId, {
    assigned_to: resolvedTechnicianId,
    status: "Assigned",
  });
};

/* ============================================
   UNASSIGN TECHNICIAN FROM JOB
   Removes technician and resets status to "Open"
============================================ */
export const unassignTechnicianFromJob = async (jobId) => {
  return updateJob(jobId, {
    assigned_to: null,
    status: "Open",
  });
};

/* ============================================
   CREATE OR UPDATE APPOINTMENT
   Handle appointment booking
============================================ */
export const createOrUpdateAppointment = async (jobNumber, appointmentDate, appointmentTime, notes) => {
  try {
    console.log("📅 createOrUpdateAppointment called with:", { jobNumber, appointmentDate, appointmentTime, notes });
    
    // Validate inputs
    if (!jobNumber || !appointmentDate || !appointmentTime) {
      return { 
        success: false, 
        error: { message: "Job number, date, and time are required" } 
      };
    }

    // Find the job first
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber, jobError);
      return { 
        success: false, 
        error: { message: `Job ${jobNumber} not found in database` } 
      };
    }

    // Combine date and time into a timestamp
    const scheduledDateTime = `${appointmentDate}T${appointmentTime}:00`;

    // Check if appointment already exists for this job
    const { data: existingAppointment, error: checkError } = await supabase
      .from("appointments")
      .select("appointment_id")
      .eq("job_id", job.id)
      .maybeSingle();

    let appointmentData;

    if (existingAppointment) {
      // Update existing appointment
      const { data, error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_time: scheduledDateTime,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("appointment_id", existingAppointment.appointment_id)
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log("✅ Appointment updated successfully:", appointmentData);
    } else {
      // Create new appointment
      const { data, error } = await supabase
        .from("appointments")
        .insert([{
          job_id: job.id,
          scheduled_time: scheduledDateTime,
          status: "Scheduled",
          notes: notes || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log("✅ Appointment created successfully:", appointmentData);
    }

    // Update job status to "Booked"
    await updateJobStatus(job.id, "Booked");

    return { 
      success: true, 
      data: {
        appointment: appointmentData,
        jobId: job.id
      }
    };
  } catch (error) {
    console.error("❌ Error creating/updating appointment:", error);
    return { 
      success: false, 
      error: { message: error.message || "Failed to create/update appointment" } 
    };
  }
};

/* ============================================
   GET JOBS BY DATE
============================================ */
export const getJobsByDate = async (date) => {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      appointment_id,
      scheduled_time,
      notes,
      status,
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        vehicle:vehicle_id(
          registration,
          reg_number,
          make,
          model,
          customer:customer_id(
            firstname,
            lastname
          )
        )
      )
    `)
    .gte("scheduled_time", `${date}T00:00:00`)
    .lte("scheduled_time", `${date}T23:59:59`)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error("❌ Error fetching jobs by date:", error);
    return [];
  }

  return data.map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    status: a.status,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle_reg || a.job?.vehicle?.registration || a.job?.vehicle?.reg_number || "",
      make: a.job?.vehicle?.make || "",
      model: a.job?.vehicle?.model || "",
      makeModel: a.job?.vehicle_make_model || "",
      customer: a.job?.vehicle?.customer
        ? `${a.job.vehicle.customer.firstname} ${a.job.vehicle.customer.lastname}`
        : "",
    },
  }));
};

/* ============================================
   ✅ NEW: ADD FILE TO JOB
============================================ */
export const addJobFile = async (jobId, fileName, fileUrl, fileType, folder, uploadedBy) => {
  try {
    const { data, error } = await supabase
      .from("job_files")
      .insert([{
        job_id: jobId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        folder: folder || "general",
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    console.log("✅ File added to job:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error adding file to job:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   ✅ NEW: GET JOB FILES
============================================ */
export const getJobFiles = async (jobId, folder = null) => {
  try {
    let query = supabase
      .from("job_files")
      .select("*")
      .eq("job_id", jobId)
      .order('uploaded_at', { ascending: false });

    if (folder) {
      query = query.eq("folder", folder);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log("✅ Job files retrieved:", data?.length || 0);
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting job files:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ NEW: DELETE JOB FILE
============================================ */
export const deleteJobFile = async (fileId) => {
  try {
    const { error } = await supabase
      .from("job_files")
      .delete()
      .eq("file_id", fileId);

    if (error) throw error;

    console.log("✅ File deleted from job");
    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting file:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   ✅ NEW: GET CUSTOMER JOB HISTORY
============================================ */
export const getCustomerJobHistory = async (customerId) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        created_at,
        updated_at
      `)
      .eq("customer_id", customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log("✅ Customer job history retrieved:", data?.length || 0, "jobs");
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting customer job history:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ NEW: GET VEHICLE JOB HISTORY
============================================ */
export const getVehicleJobHistory = async (vehicleId) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        type,
        status,
        created_at,
        updated_at
      `)
      .eq("vehicle_id", vehicleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log("✅ Vehicle job history retrieved:", data?.length || 0, "jobs");
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting vehicle job history:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ FIX: UPDATE JOB POSITION
   Moves a job to a new position or stage (e.g., from 'waiting' to 'in progress')
============================================ */
export const updateJobPosition = async (jobId, newPosition) => {
  try {
    console.log("🔄 updateJobPosition:", jobId, newPosition); // Debug log

    const { data, error } = await supabase
      .from("jobs")
      .update({
        waiting_status: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select();

    if (error) throw error;
    console.log("✅ Job position updated:", data);
    return data;
  } catch (err) {
    console.error("❌ Error in updateJobPosition:", err.message);
    throw err;
  }
};

/* ============================================
   GET WRITE-UP BY JOB NUMBER (ENHANCED VERSION)
   ✅ WITH ALL FIELDS & CHECKLIST TASKS
============================================ */
export const getWriteUpByJobNumber = async (jobNumber) => {
  console.log("🔍 getWriteUpByJobNumber:", jobNumber);

  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, description, requests")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber);
      return null;
    }

    const { data: writeUp, error } = await supabase
      .from("job_writeups")
      .select("*")
      .eq("job_id", job.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error fetching write-up:", error);
      return null;
    }

    const { data: taskRows, error: taskError } = await supabase
      .from("job_writeup_tasks")
      .select("task_id, source, source_key, label, status")
      .eq("job_id", job.id)
      .order("task_id", { ascending: true });

    if (taskError) {
      console.error("⚠️ Error fetching write-up tasks:", taskError);
    }

    const { data: authorizationRows } = await supabase
      .from("vhc_authorizations")
      .select("id, authorized_items, authorized_at")
      .eq("job_id", job.id)
      .order("authorized_at", { ascending: false });

    const requestItems = normaliseRequestsForWriteUp(job.requests);
    const authorisedItems = deriveAuthorisedWorkItems(authorizationRows || []);
    const tasks = buildWriteUpTaskList({
      storedTasks: taskRows || [],
      requestItems,
      authorisedItems,
    });

    const completionStatus = determineCompletionStatus(tasks, writeUp?.completion_status);
    const latestAuthorizationId = authorisedItems.length > 0 ? authorisedItems[0].authorizationId : null;

    return {
      fault: ensureBulletFormat(writeUp?.work_performed || job.description || ""),
      caused: ensureBulletFormat(writeUp?.recommendations || ""),
      rectification: ensureBulletFormat(
        writeUp?.ratification || writeUp?.rectification_notes || ""
      ),
      warrantyClaim: writeUp?.warranty_claim || "",
      tsrNumber: writeUp?.tsr_number || "",
      pwaNumber: writeUp?.pwa_number || "",
      technicalBulletins: ensureBulletFormat(writeUp?.technical_bulletins || ""),
      technicalSignature: writeUp?.technical_signature || "",
      qualityControl: writeUp?.quality_control || "",
      additionalParts: ensureBulletFormat(writeUp?.parts_used || ""),
      qty: writeUp?.qty || Array(10).fill(false),
      booked: writeUp?.booked || Array(10).fill(false),
      completionStatus,
      jobDescription: ensureBulletFormat(
        job.description || writeUp?.job_description_snapshot || ""
      ),
      tasks,
      requests: requestItems,
      authorisedItems,
      vhcAuthorizationId: latestAuthorizationId,
    };
  } catch (error) {
    console.error("❌ getWriteUpByJobNumber error:", error);
    return null;
  }
};

/* ============================================
   SAVE WRITE-UP TO DATABASE (ENHANCED VERSION)
   ✅ WITH ALL FIELDS
============================================ */
export const saveWriteUpToDatabase = async (jobNumber, writeUpData) => {
  console.log("💾 saveWriteUpToDatabase:", jobNumber);

  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, assigned_to, description")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber);
      return { success: false, error: "Job not found" };
    }

    const { data: existing } = await supabase
      .from("job_writeups")
      .select("writeup_id")
      .eq("job_id", job.id)
      .maybeSingle();

    const rawTasks = Array.isArray(writeUpData?.tasks) ? writeUpData.tasks : [];
    const filteredTasks = rawTasks
      .map((task) => ({
        taskId: task?.taskId || null,
        source: task?.source || "request",
        sourceKey: task?.sourceKey || `${task?.source || "request"}-${task?.label || "task"}`,
        label: (task?.label || "").toString().trim(),
        status: sanitiseTaskStatus(task?.status),
      }))
      .filter((task) => Boolean(task.label));

    const completionStatus = determineCompletionStatus(
      filteredTasks,
      writeUpData?.completionStatus
    );

    const formattedFault = ensureBulletFormat(writeUpData?.fault || "");
    const formattedCaused = ensureBulletFormat(writeUpData?.caused || "");
    const formattedRectification = ensureBulletFormat(writeUpData?.rectification || "");
    const formattedAdditionalParts = ensureBulletFormat(writeUpData?.additionalParts || "");
    const formattedBulletins = ensureBulletFormat(writeUpData?.technicalBulletins || "");
    const formattedJobDescription = ensureBulletFormat(
      writeUpData?.jobDescription || writeUpData?.fault || ""
    );

    if (formattedJobDescription && formattedJobDescription !== (job.description || "")) {
      const jobUpdateResult = await updateJob(job.id, { description: formattedJobDescription });
      if (!jobUpdateResult.success) {
        console.error("⚠️ Failed to synchronise job description:", jobUpdateResult.error);
      }
    }

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from("job_writeup_tasks")
      .select("task_id, source, source_key")
      .eq("job_id", job.id);

    if (existingTasksError) {
      console.error("❌ Error loading existing write-up tasks:", existingTasksError);
      return { success: false, error: existingTasksError.message };
    }

    const existingTaskMap = new Map(
      (existingTasks || []).map((task) => [`${task.source}:${task.source_key}`, task])
    );

    const seenTaskKeys = new Set();
    const tasksToInsert = [];
    const tasksToUpdate = [];

    filteredTasks.forEach((task) => {
      const taskKey = `${task.source}:${task.sourceKey}`;
      seenTaskKeys.add(taskKey);
      const payload = {
        job_id: job.id,
        source: task.source,
        source_key: task.sourceKey,
        label: task.label,
        status: task.status,
      };

      const existingTask = existingTaskMap.get(taskKey);
      if (existingTask) {
        tasksToUpdate.push({ taskId: existingTask.task_id, payload });
      } else {
        tasksToInsert.push(payload);
      }
    });

    if (tasksToInsert.length > 0) {
      const { error: insertTasksError } = await supabase
        .from("job_writeup_tasks")
        .insert(tasksToInsert);

      if (insertTasksError) {
        console.error("❌ Error inserting write-up tasks:", insertTasksError);
        return { success: false, error: insertTasksError.message };
      }
    }

    for (const task of tasksToUpdate) {
      const { error: updateTaskError } = await supabase
        .from("job_writeup_tasks")
        .update({ label: task.payload.label, status: task.payload.status })
        .eq("task_id", task.taskId);

      if (updateTaskError) {
        console.error("❌ Error updating write-up task:", updateTaskError);
        return { success: false, error: updateTaskError.message };
      }
    }

    const tasksToRemove = (existingTasks || []).filter(
      (task) => !seenTaskKeys.has(`${task.source}:${task.source_key}`)
    );

    if (tasksToRemove.length > 0) {
      const { error: deleteTasksError } = await supabase
        .from("job_writeup_tasks")
        .delete()
        .in(
          "task_id",
          tasksToRemove.map((task) => task.task_id)
        );

      if (deleteTasksError) {
        console.error("❌ Error deleting stale write-up tasks:", deleteTasksError);
        return { success: false, error: deleteTasksError.message };
      }
    }

    // Map ALL form fields to database fields
    const writeUpToSave = {
      job_id: job.id,
      work_performed: formattedFault || null,
      parts_used: formattedAdditionalParts || null,
      recommendations: formattedCaused || null,
      ratification: formattedRectification || null,
      warranty_claim: writeUpData?.warrantyClaim || null,
      tsr_number: writeUpData?.tsrNumber || null,
      pwa_number: writeUpData?.pwaNumber || null,
      technical_bulletins: formattedBulletins || null,
      technical_signature: writeUpData?.technicalSignature || null,
      quality_control: writeUpData?.qualityControl || null,
      qty: writeUpData.qty || Array(10).fill(false),
      booked: writeUpData.booked || Array(10).fill(false),
      labour_time: null, // Calculate if needed
      technician_id: job.assigned_to || null, // Get from job
      updated_at: new Date().toISOString(),
      completion_status: completionStatus,
      rectification_notes: formattedRectification || null,
      job_description_snapshot: formattedJobDescription || null,
      vhc_authorization_reference: writeUpData?.vhcAuthorizationId || null,
      task_checklist: filteredTasks.map((task) => ({
        source: task.source,
        sourceKey: task.sourceKey,
        label: task.label,
        status: task.status,
      })),
    };

    let persistenceResult = null;

    if (existing) {
      console.log("🔄 Updating existing write-up");
      const { data: updatedWriteUp, error: updateWriteUpError } = await supabase
        .from("job_writeups")
        .update(writeUpToSave)
        .eq("writeup_id", existing.writeup_id)
        .select()
        .single();

      if (updateWriteUpError) {
        console.error("❌ Error updating write-up:", updateWriteUpError);
        return { success: false, error: updateWriteUpError.message };
      }

      persistenceResult = updatedWriteUp;
    } else {
      console.log("➕ Creating new write-up");
      writeUpToSave.created_at = new Date().toISOString();
      const { data: insertedWriteUp, error: insertWriteUpError } = await supabase
        .from("job_writeups")
        .insert([writeUpToSave])
        .select()
        .single();

      if (insertWriteUpError) {
        console.error("❌ Error inserting write-up:", insertWriteUpError);
        return { success: false, error: insertWriteUpError.message };
      }

      persistenceResult = insertedWriteUp;
    }

    console.log("✅ Write-up saved successfully");
    return { success: true, data: persistenceResult, completionStatus };
  } catch (error) {
    console.error("❌ saveWriteUpToDatabase error:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   SAVE / UPDATE VHC CHECKSHEET
   Persists technician VHC builder data against a job
============================================ */
const upsertVhcJsonBlob = async ({ jobId, section, title, data }) => {
  const now = new Date().toISOString();
  const safeJson = data != null ? JSON.stringify(data) : null;

  const { data: existing, error: existingError } = await supabase
    .from("vhc_checks")
    .select("vhc_id")
    .eq("job_id", jobId)
    .eq("section", section)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  const payload = {
    job_id: jobId,
    section,
    issue_title: title,
    issue_description: safeJson,
    measurement: null,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase
      .from("vhc_checks")
      .update(payload)
      .eq("vhc_id", existing.vhc_id);

    if (error) throw error;
    return existing.vhc_id;
  }

  const insertPayload = {
    ...payload,
    created_at: now,
  };

  const { data: inserted, error } = await supabase
    .from("vhc_checks")
    .insert([insertPayload])
    .select("vhc_id")
    .single();

  if (error) throw error;
  return inserted.vhc_id;
};

export const saveChecksheet = async (jobNumber, vhcData) => {
  console.log("💾 saveChecksheet:", jobNumber);

  try {
    if (!jobNumber) {
      throw new Error("Job number is required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return { success: false, error: { message: "Job not found" } };
    }

    await upsertVhcJsonBlob({
      jobId: job.id,
      section: "VHC_CHECKSHEET",
      title: "Technician VHC Checksheet",
      data: vhcData,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ saveChecksheet error:", error);
    return { success: false, error: { message: error.message } };
  }
};

export const updateJobVhcCheck = async (jobNumber, checkData) => {
  console.log("💾 updateJobVhcCheck:", jobNumber);

  try {
    if (!jobNumber) {
      throw new Error("Job number is required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return { success: false, error: { message: "Job not found" } };
    }

    await upsertVhcJsonBlob({
      jobId: job.id,
      section: "TECHNICIAN_CHECKSHEET",
      title: "Technician Check Sheet",
      data: checkData,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ updateJobVhcCheck error:", error);
    return { success: false, error: { message: error.message } };
  }
};
