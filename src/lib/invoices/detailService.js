// file location: src/lib/invoices/detailService.js // describe where this helper lives
import supabase from "@/lib/supabaseClient"; // import shared Supabase client for DB access
import { createClient } from "@supabase/supabase-js";

const DEFAULT_VAT_RATE = 20; // default VAT percentage when configuration missing
const DEFAULT_LABOUR_RATE = 85; // default labour rate per hour fallback

const RATE_KEYS = ["vat_rate", "default_labour_rate"]; // configuration keys stored in company_settings table
const serviceRoleClient =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

async function fetchCompanyRates() { // fetch VAT + labour rate snapshot
  const { data, error } = await supabase // run Supabase query
    .from("company_settings") // target key-value table
    .select("setting_key, setting_value") // pull key + value
    .in("setting_key", RATE_KEYS); // filter for relevant keys
  if (error) { // handle errors
    console.warn("fetchCompanyRates error", error); // log warning
    return { vatRate: DEFAULT_VAT_RATE, labourRate: DEFAULT_LABOUR_RATE }; // fallback defaults
  }
  const map = Object.fromEntries( // map key -> value
    (data || []).map((entry) => [entry.setting_key, entry.setting_value]) // build entry pairs
  ); // finish object map
  const vatRate = Number(map.vat_rate) || DEFAULT_VAT_RATE; // parse VAT rate
  const labourRate = Number(map.default_labour_rate) || DEFAULT_LABOUR_RATE; // parse labour rate
  return { vatRate, labourRate }; // return numeric values
} // end fetchCompanyRates

async function fetchCompanyProfile() { // fetch company + bank profile row
  const { data, error } = await supabase // execute query
    .from("company_profile_settings") // target profile table
    .select("*") // fetch all columns
    .order("updated_at", { ascending: false }) // prefer latest update
    .limit(1) // return single row
    .maybeSingle(); // expect zero or one row
  if (error && error.code !== "PGRST116") { // check for real error excluding no rows
    console.warn("fetchCompanyProfile error", error); // log warning
  }
  return (data || null); // return row or null
} // end fetchCompanyProfile

async function fetchInvoiceRecord({ jobNumber, orderNumber }) { // fetch invoice header by job or order number
  let query = supabase.from("invoices").select("*"); // start query for invoices table
  if (jobNumber) { // filter by job number when provided
    query = query.eq("job_number", jobNumber); // apply filter
  } else if (orderNumber) { // otherwise filter by order number
    query = query.eq("order_number", orderNumber); // apply filter
  }
  const { data, error } = await query.limit(1).maybeSingle(); // execute query expecting single row
  if (error && error.code !== "PGRST116") { // handle unexpected errors
    throw error; // surface error to caller
  }
  return data || null; // return invoice row or null
} // end fetchInvoiceRecord

async function fetchJobSnapshot(jobNumber, jobId) { // fetch job, customer, and vehicle snapshot
  if (!jobNumber && !jobId) { // require at least one identifier
    return { job: null, customer: null, vehicle: null }; // return empty snapshot
  }
  let jobQuery = supabase // start job query
    .from("jobs") // target jobs table
    .select("id, job_number, job_source, status, created_at, completed_at, milage, customer_id, customer, vehicle_reg, vehicle_make_model, vehicle_id, account_number") // fetch needed columns
    .limit(1); // limit to one row
  if (jobId) { // filter by job id when provided
    jobQuery = jobQuery.eq("id", jobId); // apply filter
  } else if (jobNumber) { // otherwise filter by job number
    jobQuery = jobQuery.eq("job_number", jobNumber); // apply filter
  }
  const { data: job, error: jobError } = await jobQuery.maybeSingle(); // run query
  if (jobError && jobError.code !== "PGRST116") { // check for real error
    throw jobError; // propagate error
  }
  let customer = null; // initialize customer snapshot
  let vehicle = null; // initialize vehicle snapshot
  if (job?.customer_id) { // fetch customer when available
    const { data, error } = await supabase // query customers table
      .from("customers") // table name
      .select("id, firstname, lastname, name, email, mobile, telephone, address, postcode") // fields needed for invoice
      .eq("id", job.customer_id) // filter by ID
      .maybeSingle(); // expect one row
    if (error && error.code !== "PGRST116") { // handle error
      throw error; // propagate
    }
    customer = data || null; // store row
  }
  if (job?.vehicle_id) { // fetch vehicle when available
    const { data, error } = await supabase // query vehicles table
      .from("vehicles") // table name
      .select("vehicle_id, registration, reg_number, make, model, make_model, chassis, engine, engine_number, mileage, month_of_first_registration, service_plan_supplier") // required vehicle fields
      .eq("vehicle_id", job.vehicle_id) // filter by ID
      .maybeSingle(); // expect single
    if (error && error.code !== "PGRST116") { // handle actual errors
      throw error; // propagate to caller
    }
    vehicle = data || null; // store row
  }
  return { job, customer, vehicle }; // return snapshot
} // end fetchJobSnapshot

async function fetchInvoiceRequests(invoiceId) { // fetch invoice_requests + items if available
  const { data: requests, error } = await supabase // query invoice_requests
    .from("invoice_requests") // table name
    .select("*") // fetch columns
    .eq("invoice_id", invoiceId) // filter by invoice
    .order("request_number", { ascending: true }); // order by request number
  if (error && error.code !== "PGRST116") { // handle real errors
    throw error; // propagate error
  }
  if (!requests || requests.length === 0) { // no structured requests stored
    return []; // return empty array
  }
  const ids = requests.map((req) => req.id); // collect request IDs
  const { data: items, error: itemsError } = await supabase // query request items
    .from("invoice_request_items") // table name
    .select("*") // fetch columns
    .in("request_id", ids); // filter by collected IDs
  if (itemsError && itemsError.code !== "PGRST116") { // handle errors
    throw itemsError; // propagate error
  }
  const grouped = {}; // map request_id -> items array
  (items || []).forEach((item) => { // iterate items
    if (!grouped[item.request_id]) { // create bucket when missing
      grouped[item.request_id] = []; // initialize array
    }
    grouped[item.request_id].push(item); // push item into bucket
  }); // finish grouping
  return requests.map((request) => ({ // attach items array to each request
    ...request, // spread original row
    items: grouped[request.id] || [] // add child list
  })); // return structured requests
} // end fetchInvoiceRequests

async function fetchJobRequests(jobId) { // fetch job requests fallback
  const { data, error } = await supabase // query job_requests table
    .from("job_requests") // table name
    .select("request_id, description, hours, job_type, request_source, sort_order") // fetch relevant columns
    .eq("job_id", jobId) // filter by job id
    .order("sort_order", { ascending: true }); // keep same order as job
  if (error && error.code !== "PGRST116") { // handle real errors
    throw error; // propagate
  }
  return data || []; // return rows or empty list
} // end fetchJobRequests

async function fetchAuthorizedVhcRequests(jobId) { // fetch authorised VHC rows linked to job requests
  const { data, error } = await supabase
    .from("vhc_checks")
    .select("vhc_id, request_id, issue_title, issue_description, labour_hours, parts_cost, approval_status, authorization_state, section")
    .eq("job_id", jobId);
  if (error && error.code !== "PGRST116") {
    throw error;
  }
  const isAuthorisedDecision = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "authorized" || normalized === "authorised" || normalized === "completed";
  };
  return (data || []).filter((row) => {
    const section = String(row?.section || "").trim();
    if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
    // Accept either field because legacy rows and sync races can leave one stale.
    return isAuthorisedDecision(row?.authorization_state) || isAuthorisedDecision(row?.approval_status);
  });
} // end fetchAuthorizedVhcRequests

async function fetchJobPartAllocations(jobId) { // fetch parts allocated to job for grouping
  const { data, error } = await supabase // query parts_job_items joined with catalog
    .from("parts_job_items") // table name
    .select(`
      id,
      allocated_to_request_id,
      vhc_item_id,
      quantity_allocated,
      unit_price,
      unit_cost,
      status,
      part:parts_catalog (
        part_number,
        name,
        description
      )
    `) // include nested part info
    .eq("job_id", jobId); // filter by job
  if (error && error.code !== "PGRST116") { // handle actual errors
    throw error; // propagate
  }
  return (data || []).filter((item) => item.status !== "cancelled"); // return non-cancelled allocations
} // end fetchJobPartAllocations

async function fetchJobWriteUp(jobId) {
  if (!jobId) return null;
  const { data, error } = await supabase
    .from("job_writeups")
    .select("fault, rectification, cause_entries, task_checklist, updated_at")
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw error;
  }
  return data || null;
}

function parseChecklistPayload(raw = null) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function compactWriteUpText(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
}

function decodeRequestSourceKey(rawKey) {
  const key = String(rawKey || "").trim().toLowerCase();
  if (!key) return { requestId: null, sortOrder: null };
  const reqIdMatch = key.match(/^reqid-(\d+)$/);
  if (reqIdMatch) {
    return { requestId: Number(reqIdMatch[1]), sortOrder: null };
  }
  const sortMatch = key.match(/^req-(\d+)$/);
  if (sortMatch) {
    return { requestId: null, sortOrder: Number(sortMatch[1]) };
  }
  const numeric = Number(key);
  if (Number.isFinite(numeric)) {
    return { requestId: numeric, sortOrder: null };
  }
  return { requestId: null, sortOrder: null };
}

function attachWriteUpDetailsToRequests(requests = [], writeUp = null) {
  if (!writeUp || !Array.isArray(requests) || requests.length === 0) return requests;

  const faultByRequestId = {};
  const faultBySortOrder = {};
  const rectificationByRequestId = {};
  const rectificationBySortOrder = {};

  (Array.isArray(writeUp.cause_entries) ? writeUp.cause_entries : []).forEach((entry) => {
    const text = compactWriteUpText(entry?.cause_text || entry?.text || "");
    if (!text) return;
    const { requestId, sortOrder } = decodeRequestSourceKey(
      entry?.request_id ?? entry?.requestKey ?? entry?.requestId
    );
    if (requestId !== null && requestId !== undefined) {
      faultByRequestId[String(requestId)] = text;
      return;
    }
    if (sortOrder !== null && sortOrder !== undefined) {
      faultBySortOrder[String(sortOrder)] = text;
    }
  });

  const checklist = parseChecklistPayload(writeUp.task_checklist);
  const checklistTasks = Array.isArray(checklist?.tasks) ? checklist.tasks : [];
  checklistTasks
    .filter((task) => String(task?.source || "").toLowerCase() === "request")
    .forEach((task) => {
      const cleanedLabel = compactWriteUpText(
        String(task?.label || "").replace(/^request\s*\d+\s*:\s*/i, "")
      );
      if (!cleanedLabel) return;
      const { requestId, sortOrder } = decodeRequestSourceKey(task?.sourceKey || task?.source_key);
      if (requestId !== null && requestId !== undefined) {
        rectificationByRequestId[String(requestId)] = cleanedLabel;
        return;
      }
      if (sortOrder !== null && sortOrder !== undefined) {
        rectificationBySortOrder[String(sortOrder)] = cleanedLabel;
      }
    });

  return requests.map((request) => {
    const requestId = request?.request_id ?? null;
    const sortOrder = request?.request_sort_order ?? request?.request_number ?? null;
    const keyById =
      requestId !== null && requestId !== undefined ? String(requestId) : null;
    const keyBySort =
      sortOrder !== null && sortOrder !== undefined ? String(sortOrder) : null;

    const fault =
      (keyById ? faultByRequestId[keyById] : "") ||
      (keyBySort ? faultBySortOrder[keyBySort] : "");
    const rectification =
      (keyById ? rectificationByRequestId[keyById] : "") ||
      (keyBySort ? rectificationBySortOrder[keyBySort] : "");

    if (!fault && !rectification) return request;
    return {
      ...request,
      writeup: {
        fault,
        rectification,
      },
    };
  });
}

function formatAddress(customer) { // build address lines for invoice header
  if (!customer) { // handle missing data
    return { name: "Customer", lines: [], postcode: "" }; // fallback placeholder
  }
  const name =
    customer.name ||
    [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
    "Customer"; // compute name string
  const lines = (customer.address || "") // start from raw address string
    .split("\n") // split by newline
    .map((line) => line.trim()) // trim each line
    .filter(Boolean); // remove empty strings
  const postcode = customer.postcode || ""; // read postcode value
  return { name, lines, postcode }; // return structured address
} // end formatAddress

function buildVehicleDetails(invoice, job, vehicle) { // build vehicle row snapshot
  const vehicleInfo = invoice?.vehicle_details || {}; // prefer invoice snapshot
  if (Object.keys(vehicleInfo).length > 0) { // reuse stored snapshot when present
    return vehicleInfo; // return snapshot
  }
  return { // build fallback object from job + vehicle
    reg: job?.vehicle_reg || vehicle?.registration || vehicle?.reg_number || "",
    vehicle:
      vehicle?.make_model ||
      [vehicle?.make, vehicle?.model].filter(Boolean).join(" ").trim() ||
      job?.vehicle_make_model ||
      "",
    chassis: vehicle?.chassis || "",
    engine: vehicle?.engine || vehicle?.engine_number || "",
    reg_date: vehicle?.month_of_first_registration || "",
    mileage: job?.milage || vehicle?.mileage || "",
    delivery_date: job?.completed_at || "",
    engine_no: vehicle?.engine_number || vehicle?.engine || ""
  }; // return detail object
} // end buildVehicleDetails

function enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate, authorizedVhcRows = []) { // fallback builder for request payload
  const groupedParts = {}; // map request_id -> part items
  const groupedPartsByVhcId = {}; // map vhc_item_id -> part items
  partAllocations.forEach((allocation) => { // iterate all part allocations
    const key =
      allocation.allocated_to_request_id !== null &&
      allocation.allocated_to_request_id !== undefined
        ? allocation.allocated_to_request_id
        : "unassigned"; // determine grouping key handling null/undefined
    if (!groupedParts[key]) { // ensure bucket exists
      groupedParts[key] = []; // create array
    }
    groupedParts[key].push(allocation); // push allocation

    const vhcKey =
      allocation.vhc_item_id !== null && allocation.vhc_item_id !== undefined
        ? String(allocation.vhc_item_id)
        : null;
    if (vhcKey) {
      if (!groupedPartsByVhcId[vhcKey]) groupedPartsByVhcId[vhcKey] = [];
      groupedPartsByVhcId[vhcKey].push(allocation);
    }
  }); // done grouping
  const authorisedByRequestId = {};
  (authorizedVhcRows || []).forEach((row) => {
    const requestId = row?.request_id ?? null;
    if (requestId === null || requestId === undefined) return;
    const key = String(requestId);
    const issueTitle = String(row?.issue_title || "").trim();
    const issueDescription = String(row?.issue_description || "").trim();
    const label = issueDescription ? `${issueTitle} - ${issueDescription}` : issueTitle;
    const labourHoursRaw = row?.labour_hours;
    const labourHours =
      labourHoursRaw !== null && labourHoursRaw !== undefined && labourHoursRaw !== ""
        ? Number(labourHoursRaw)
        : null;
    const partsCostRaw = row?.parts_cost;
    const partsCost =
      partsCostRaw !== null && partsCostRaw !== undefined && partsCostRaw !== ""
        ? Number(partsCostRaw)
        : null;
    const existing = authorisedByRequestId[key];
    const candidate = {
      label,
      issueTitle,
      issueDescription,
      labourHours: Number.isFinite(labourHours) ? labourHours : null,
      partsCost: Number.isFinite(partsCost) ? partsCost : null,
      vhcItemId: row?.vhc_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? null,
    };
    if (!existing) {
      authorisedByRequestId[key] = candidate;
      return;
    }
    const existingScore =
      (existing.label ? 1 : 0) +
      (existing.labourHours !== null ? 1 : 0) +
      (existing.partsCost !== null ? 1 : 0);
    const candidateScore =
      (candidate.label ? 1 : 0) +
      (candidate.labourHours !== null ? 1 : 0) +
      (candidate.partsCost !== null ? 1 : 0);
    if (candidateScore >= existingScore) authorisedByRequestId[key] = candidate;
  });
  const authorisedRequestIdSet = new Set(Object.keys(authorisedByRequestId));

  const sourceRequests = jobRequests.length > 0 ? jobRequests : [{ // ensure at least one request exists
    request_id: 0, // pseudo id
    description: "Customer Request", // fallback description
    hours: 0, // no labour info
    job_type: "Customer" // default type
  }]; // end fallback
  const fallbackRequests = sourceRequests.filter((request) => {
    const source = String(request?.request_source || request?.requestSource || "").toLowerCase().trim();
    const requestId = request?.request_id ?? request?.requestId ?? null;
    if (source !== "vhc_authorised" && source !== "vhc_authorized") {
      const sortOrderRaw = request?.sort_order ?? request?.sortOrder ?? null;
      const sortOrder = Number(sortOrderRaw);
      const isLikelyLegacyVhcRequest =
        !source &&
        Number.isFinite(sortOrder) &&
        sortOrder === 0 &&
        requestId !== null &&
        requestId !== undefined &&
        !authorisedRequestIdSet.has(String(requestId));
      return !isLikelyLegacyVhcRequest;
    }
    if (requestId === null || requestId === undefined) return false;
    return authorisedRequestIdSet.has(String(requestId));
  });
  const sorted = [...fallbackRequests].sort((a, b) => { // sort customer requests first, authorised last
    const aMeta =
      a?.request_id !== null && a?.request_id !== undefined
        ? authorisedByRequestId[String(a.request_id)] || null
        : null;
    const bMeta =
      b?.request_id !== null && b?.request_id !== undefined
        ? authorisedByRequestId[String(b.request_id)] || null
        : null;
    const aType = String(a?.job_type || "").toLowerCase();
    const bType = String(b?.job_type || "").toLowerCase();
    const aSource = String(a?.request_source || a?.requestSource || "").toLowerCase();
    const bSource = String(b?.request_source || b?.requestSource || "").toLowerCase();
    const aIsAuthorised =
      Boolean(aMeta) ||
      aType === "authorised" ||
      aType === "authorized" ||
      aSource === "vhc_authorised" ||
      aSource === "vhc_authorized";
    const bIsAuthorised =
      Boolean(bMeta) ||
      bType === "authorised" ||
      bType === "authorized" ||
      bSource === "vhc_authorised" ||
      bSource === "vhc_authorized";
    if (aIsAuthorised === bIsAuthorised) return 0;
    return aIsAuthorised ? 1 : -1;
  }); // end sort
  let customerCount = 0; // counter for customer request labels
  let authorisedCount = 0; // counter for authorised request labels
  return sorted.map((request, index) => { // transform each request to invoice-friendly shape
    const vhcMeta =
      request?.request_id !== null && request?.request_id !== undefined
        ? authorisedByRequestId[String(request.request_id)] || null
        : null;
    const labourHours = (vhcMeta?.labourHours ?? Number(request.hours)) || 0; // parse hours
    const labourNet = labourHours * labourRate; // compute net labour
    const labourVat = labourNet * (vatRate / 100); // compute VAT value
    const bucketKey =
      request.request_id !== null && request.request_id !== undefined
        ? request.request_id
        : "unassigned"; // choose parts bucket key
    const requestParts = groupedParts[bucketKey] || []; // keep strictly linked parts for this request
    const vhcParts =
      vhcMeta?.vhcItemId !== null && vhcMeta?.vhcItemId !== undefined
        ? groupedPartsByVhcId[String(vhcMeta.vhcItemId)] || []
        : [];
    const mergedRequestParts = [...requestParts];
    const seenPartRowIds = new Set(mergedRequestParts.map((row) => String(row?.id)));
    vhcParts.forEach((row) => {
      const rowId = String(row?.id);
      if (seenPartRowIds.has(rowId)) return;
      seenPartRowIds.add(rowId);
      mergedRequestParts.push(row);
    });
    const parts = mergedRequestParts
      .map((item) => { // map part allocations
      const qty = Number(item.quantity_allocated || 0); // parse quantity
      const unitGross = Number(item.unit_price) || 0; // stored unit price includes VAT
      const vatFactor = 1 + vatRate / 100;
      const unitNet = vatFactor > 0 ? unitGross / vatFactor : unitGross; // back-calc net from VAT-inclusive price
      const net = unitNet * qty; // compute net amount
      const gross = unitGross * qty;
      const vat = gross - net; // VAT extracted from VAT-inclusive amount
      return { // return simplified part entry
        id: item.id, // part link id
        part_number: item.part?.part_number || "", // part number
        description: item.part?.name || item.part?.description || "Part", // description fallback
        retail: item.part?.unit_price || null, // optional retail price
        qty, // quantity sold
        price: unitNet, // net unit price
        vat, // VAT amount
        rate: vatRate, // VAT rate percent
        net_price: net // net amount
      }; // end part entry
      })
      .filter((part) => part.qty > 0); // suppress zero-qty rows on invoice/proforma
    const partsFromAllocationsNet = parts.reduce((sum, part) => sum + part.net_price, 0); // sum net parts from allocated rows
    const vhcPartsCostRaw = vhcMeta?.partsCost;
    const vhcPartsCost =
      vhcPartsCostRaw !== null && vhcPartsCostRaw !== undefined && vhcPartsCostRaw !== ""
        ? Number(vhcPartsCostRaw)
        : null;
    const fallbackPartsNet = Number.isFinite(vhcPartsCost) ? vhcPartsCost : 0;
    const partsNet = partsFromAllocationsNet > 0 ? partsFromAllocationsNet : fallbackPartsNet; // fallback to vhc_checks.parts_cost when allocations are missing
    const partsVat =
      partsFromAllocationsNet > 0
        ? parts.reduce((sum, part) => sum + part.vat, 0)
        : partsNet * (vatRate / 100); // derive VAT from fallback parts net
    const requestTypeLower = String(request.job_type || "").toLowerCase();
    const requestSourceLower = String(request.request_source || request.requestSource || "").toLowerCase();
    const isAuthorised =
      Boolean(vhcMeta) ||
      requestTypeLower === "authorised" ||
      requestTypeLower === "authorized" ||
      requestSourceLower === "vhc_authorised" ||
      requestSourceLower === "vhc_authorized"; // check request type/source
    if (isAuthorised) { authorisedCount++; } else { customerCount++; } // increment appropriate counter
    const requestLabel = isAuthorised ? `Authorised ${authorisedCount}` : `Request ${customerCount}`; // build label
    const summaryBits = [];
    if (isAuthorised && labourHours > 0) summaryBits.push(`Labour: ${labourHours}h`);
    if (isAuthorised && partsNet > 0) summaryBits.push(`Authorised parts: £${Number(partsNet).toFixed(2)}`);
    return { // return normalized request block
      request_id: request.request_id ?? null, // retain original job request id for stable UI linking
      request_sort_order: request.sort_order ?? request.sortOrder ?? null,
      request_kind: isAuthorised ? "authorised" : "request", // explicit row type for frontend ordering/labels
      request_number: index + 1, // sequential request number
      request_label: requestLabel, // typed request label (e.g. "Customer Request 1")
      title: vhcMeta?.label || request.description || requestLabel, // display title with full description
      summary: isAuthorised ? summaryBits.join(" | ") : request.job_type || "Customer", // summary label
      job_type: request.job_type || "Customer",
      labour: { // labour summary object
        hours: labourHours, // labour hours
        net: labourNet, // net amount
        vat: labourVat, // VAT amount
        rate: vatRate // VAT rate percent
      }, // end labour object
      parts: parts.map((part) => ({ // map part to API shape
        part_number: part.part_number, // part number
        description: part.description, // description
        retail: part.retail, // optional retail
        qty: part.qty, // quantity
        price: part.price, // unit price
        vat: part.vat, // VAT amount
        rate: part.rate // VAT percent
      })), // end parts mapping
      totals: { // net/vat/gross totals per request
        request_total_net: labourNet + partsNet, // combined net
        request_total_vat: labourVat + partsVat, // combined VAT
        request_total_gross: labourNet + partsNet + labourVat + partsVat // combined gross
      } // end totals block
    }; // end request return
  }); // finish fallback mapping
} // end enrichRequestsFromJob

function normalizeInvoiceRequests(structuredRequests, options = {}) { // convert invoice_requests rows into API shape
  const authorisedRequestIdSet = new Set(
    (Array.isArray(options.authorisedRequestIds) ? options.authorisedRequestIds : [])
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
  );
  const isAuthorisedStructuredRequest = (request = {}) => {
    const explicitKind = String(request?.request_kind || "").trim().toLowerCase();
    if (explicitKind === "authorised" || explicitKind === "authorized") return true;
    if (explicitKind === "request") return false;

    const requestId = request?.request_id;
    if (requestId !== null && requestId !== undefined && authorisedRequestIdSet.has(String(requestId))) {
      return true;
    }

    const jobType = String(request?.job_type || "").trim().toLowerCase();
    if (jobType === "authorised" || jobType === "authorized") return true;

    const notes = String(request?.notes || "").toLowerCase();
    return notes.includes("authorised") || notes.includes("authorized");
  };

  const sorted = [...structuredRequests].sort((a, b) => { // sort customer requests first, authorised last
    const aIsAuthorised = isAuthorisedStructuredRequest(a);
    const bIsAuthorised = isAuthorisedStructuredRequest(b);
    if (aIsAuthorised === bIsAuthorised) return 0;
    return aIsAuthorised ? 1 : -1;
  }); // end sort
  let customerCount = 0; // counter for customer request labels
  let authorisedCount = 0; // counter for authorised request labels
  return sorted.map((request, index) => { // iterate stored rows
    const labour = { // build labour block from stored values
      hours: Number(request.labour_hours) || 0, // stored labour hours
      net: Number(request.labour_net) || 0, // stored net
      vat: Number(request.labour_vat) || 0, // stored VAT
      rate: Number(request.labour_vat_rate) || DEFAULT_VAT_RATE // stored VAT rate
    }; // end labour block
    const parts = (request.items || []).map((item) => ({ // map stored part items
      part_number: item.part_number || "", // part number
      description: item.description || "Part", // description fallback
      retail: item.retail ? Number(item.retail) : null, // optional retail
      qty: Number(item.qty) || 0, // quantity
      price: Number(item.net_price) || 0, // treat stored net as unit price
      vat: Number(item.vat_amount) || 0, // VAT amount
      rate: Number(item.vat_rate) || DEFAULT_VAT_RATE // VAT percentage
    })); // end parts map
    const partsNet = parts.reduce((sum, part) => sum + part.price * part.qty, 0); // compute net
    const partsVat = parts.reduce((sum, part) => sum + part.vat, 0); // compute VAT
    const isAuthorised = isAuthorisedStructuredRequest(request); // check type
    if (isAuthorised) { authorisedCount++; } else { customerCount++; } // increment counter
    const requestLabel = isAuthorised ? `Authorised ${authorisedCount}` : `Request ${customerCount}`; // build label
    return { // return normalized request object
      request_id: request.request_id ?? null, // available when schema includes it
      request_kind: isAuthorised ? "authorised" : "request", // explicit row type for frontend
      request_source: request.request_source || request.requestSource || null,
      request_number: request.request_number || index + 1, // preserve stored request number
      request_label: requestLabel, // typed request label
      title: request.title || requestLabel, // title fallback with full description
      summary: request.notes || "", // summary derived from notes
      job_type: request.job_type || "",
      labour, // labour block
      parts, // parts array
      totals: { // aggregated totals
        request_total_net: labour.net + partsNet, // net total
        request_total_vat: labour.vat + partsVat, // VAT total
        request_total_gross: labour.net + partsNet + labour.vat + partsVat // gross total
      } // totals block
    }; // end object
  }); // finish mapping
} // end normalizeInvoiceRequests

function appendMissingAuthorisedRowsFromVhcChecks({
  requests = [],
  partAllocations = [],
  authorizedVhcRows = [],
  vatRate = DEFAULT_VAT_RATE,
  labourRate = DEFAULT_LABOUR_RATE,
}) {
  const existingRequestIdSet = new Set(
    (Array.isArray(requests) ? requests : [])
      .map((request) => request?.request_id)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
  );

  const groupedPartsByVhcId = {};
  (Array.isArray(partAllocations) ? partAllocations : []).forEach((allocation) => {
    const vhcId = allocation?.vhc_item_id;
    if (vhcId === null || vhcId === undefined) return;
    const key = String(vhcId);
    if (!groupedPartsByVhcId[key]) groupedPartsByVhcId[key] = [];
    groupedPartsByVhcId[key].push(allocation);
  });

  const missingRows = [];
  (Array.isArray(authorizedVhcRows) ? authorizedVhcRows : []).forEach((row) => {
    const requestId = row?.request_id ?? null;
    if (requestId !== null && requestId !== undefined && existingRequestIdSet.has(String(requestId))) {
      return;
    }

    const labourHoursRaw = row?.labour_hours;
    const labourHours =
      labourHoursRaw !== null && labourHoursRaw !== undefined && labourHoursRaw !== ""
        ? Number(labourHoursRaw)
        : 0;
    const safeLabourHours = Number.isFinite(labourHours) ? labourHours : 0;
    const labourNet = safeLabourHours * labourRate;
    const labourVat = labourNet * (vatRate / 100);

    const vhcId = row?.vhc_id ?? null;
    const linkedParts = vhcId !== null && vhcId !== undefined ? groupedPartsByVhcId[String(vhcId)] || [] : [];
    const parts = linkedParts
      .map((item) => {
        const qty = Number(item.quantity_allocated || 0);
        const unitGross = Number(item.unit_price) || 0;
        const vatFactor = 1 + vatRate / 100;
        const unitNet = vatFactor > 0 ? unitGross / vatFactor : unitGross;
        const net = unitNet * qty;
        const gross = unitGross * qty;
        const vat = gross - net;
        return {
          part_number: item.part?.part_number || "",
          description: item.part?.name || item.part?.description || "Part",
          retail: item.part?.unit_price || null,
          qty,
          price: unitNet,
          vat,
          rate: vatRate,
          net_price: net,
        };
      })
      .filter((part) => part.qty > 0);

    const partsFromAllocationsNet = parts.reduce((sum, part) => sum + Number(part.net_price || 0), 0);
    const vhcPartsCostRaw =
      row?.parts_cost !== null && row?.parts_cost !== undefined && row?.parts_cost !== ""
        ? Number(row.parts_cost)
        : null;
    const vhcPartsCost = Number.isFinite(vhcPartsCostRaw) ? vhcPartsCostRaw : 0;
    const partsNet = partsFromAllocationsNet > 0 ? partsFromAllocationsNet : vhcPartsCost;
    const partsVat =
      partsFromAllocationsNet > 0
        ? parts.reduce((sum, part) => sum + Number(part.vat || 0), 0)
        : partsNet * (vatRate / 100);

    const issueTitle = String(row?.issue_title || "").trim();
    const issueDescription = String(row?.issue_description || "").trim();
    const title = issueDescription ? `${issueTitle} - ${issueDescription}` : issueTitle || "Authorised VHC Item";

    const summaryBits = [];
    if (safeLabourHours > 0) summaryBits.push(`Labour: ${safeLabourHours}h`);
    if (partsNet > 0) summaryBits.push(`Authorised parts: £${partsNet.toFixed(2)}`);

    missingRows.push({
      request_id: requestId,
      request_kind: "authorised",
      request_source: "vhc_authorised",
      request_number: 0, // normalized below
      request_label: "",
      title,
      summary: summaryBits.join(" | "),
      job_type: "Authorised",
      labour: {
        hours: safeLabourHours,
        net: labourNet,
        vat: labourVat,
        rate: vatRate,
      },
      parts: parts.map((part) => ({
        part_number: part.part_number,
        description: part.description,
        retail: part.retail,
        qty: part.qty,
        price: part.price,
        vat: part.vat,
        rate: part.rate,
      })),
      totals: {
        request_total_net: labourNet + partsNet,
        request_total_vat: labourVat + partsVat,
        request_total_gross: labourNet + partsNet + labourVat + partsVat,
      },
    });
  });

  if (missingRows.length === 0) return requests;

  const base = Array.isArray(requests) ? [...requests] : [];
  const existingMaxNumber = base.reduce(
    (max, request) => Math.max(max, Number(request?.request_number || 0)),
    0
  );
  missingRows.forEach((row, index) => {
    row.request_number = existingMaxNumber + index + 1;
  });
  return [...base, ...missingRows];
}

function buildCompanyBlock(profile) { // shape company object for API
  return { // return structure
    name: profile?.company_name || "Humphries & Parks", // default name fallback
    address: [profile?.address_line1, profile?.address_line2, profile?.city] // combine address lines
      .filter(Boolean) // drop empty
      .map((line) => line.trim()), // trim each line
    postcode: profile?.postcode || "", // postcode string
    phone_service: profile?.phone_service || "", // service phone
    phone_parts: profile?.phone_parts || "", // parts phone
    website: profile?.website || "" // website link
  }; // end object
} // end buildCompanyBlock

function buildPaymentBlock(profile) { // shape payment block for API
  return { // return object
    bank_name: profile?.bank_name || "", // bank name
    sort_code: profile?.sort_code || "", // sort code
    account_number: profile?.account_number || "", // account number
    account_name: profile?.account_name || "", // account name
    payment_reference_hint: profile?.payment_reference_hint || "Use invoice number as reference" // default reference hint
  }; // end object
} // end buildPaymentBlock

function aggregateRequestTotals(requests = []) { // summarize request totals into header-level values
  return requests.reduce(
    (acc, request) => ({
      service_total: acc.service_total + (request.totals?.request_total_net || 0),
      vat_total: acc.vat_total + (request.totals?.request_total_vat || 0),
      invoice_total: acc.invoice_total + (request.totals?.request_total_gross || 0)
    }),
    { service_total: 0, vat_total: 0, invoice_total: 0 }
  );
} // end aggregateRequestTotals

const buildProformaRequestKey = ({ requestId, requestKind, requestNumber }) => {
  const kind = requestKind === "authorised" ? "authorised" : "request";
  if (requestId !== null && requestId !== undefined) {
    return `${kind}:id:${String(requestId)}`;
  }
  return `${kind}:idx:${Number(requestNumber || 0)}`;
};

async function fetchProformaOverrides(jobId) {
  if (!jobId) return [];
  const db = serviceRoleClient || supabase;
  const { data, error } = await db
    .from("proforma_request_overrides")
    .select("*")
    .eq("job_id", jobId);
  if (error && error.code !== "PGRST116") {
    console.warn("fetchProformaOverrides error", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

function applyProformaOverrides(requests = [], overrides = []) {
  if (!Array.isArray(requests) || requests.length === 0 || !Array.isArray(overrides) || overrides.length === 0) {
    return requests;
  }
  const byKey = new Map();
  overrides.forEach((row) => {
    const key = String(row?.request_key || "").trim();
    if (key) byKey.set(key, row);
  });

  return requests.map((request) => {
    const key = buildProformaRequestKey({
      requestId: request?.request_id ?? null,
      requestKind: request?.request_kind || "request",
      requestNumber: request?.request_number || 0,
    });
    const row = byKey.get(key);
    if (!row) {
      return { ...request, proforma_key: key, proforma_override: null };
    }

    const isAuthorisedRequest =
      String(request?.request_kind || "").trim().toLowerCase() === "authorised" ||
      String(request?.job_type || "").trim().toLowerCase() === "authorised" ||
      String(request?.request_source || "").trim().toLowerCase() === "vhc_authorised" ||
      String(request?.request_source || "").trim().toLowerCase() === "vhc_authorized";

    const labourHours =
      row.labour_hours_override !== null && row.labour_hours_override !== undefined
        ? Number(row.labour_hours_override) || 0
        : Number(request?.labour?.hours || 0);
    const labourNet =
      row.labour_total_override !== null && row.labour_total_override !== undefined
        ? Number(row.labour_total_override) || 0
        : Number(request?.labour?.net || 0);
    const partsNetCurrent = Number(request?.totals?.request_total_net || 0) - Number(request?.labour?.net || 0);
    const hasPartsOverride =
      row.parts_total_override !== null && row.parts_total_override !== undefined;
    const overriddenPartsNet = hasPartsOverride ? Number(row.parts_total_override) || 0 : partsNetCurrent;
    // Historical proforma rows can persist stale 0.00 parts override values for authorised VHC items.
    // If live data now has a positive parts total, prefer the live total so proforma stays in sync.
    const hasStaleAuthorisedZeroPartsOverride =
      isAuthorisedRequest &&
      hasPartsOverride &&
      overriddenPartsNet === 0 &&
      partsNetCurrent > 0;
    const partsNet = hasStaleAuthorisedZeroPartsOverride ? partsNetCurrent : overriddenPartsNet;
    const vatValue =
      row.tax_total_override !== null && row.tax_total_override !== undefined
        ? hasStaleAuthorisedZeroPartsOverride
          ? Number(request?.totals?.request_total_vat || 0)
          : Number(row.tax_total_override) || 0
        : Number(request?.totals?.request_total_vat || 0);
    const grossValue =
      row.total_override !== null && row.total_override !== undefined
        ? hasStaleAuthorisedZeroPartsOverride
          ? labourNet + partsNet + vatValue
          : Number(row.total_override) || 0
        : labourNet + partsNet + vatValue;

    return {
      ...request,
      title: row.title_override || request.title,
      summary: row.summary_override || request.summary,
      labour: {
        ...(request.labour || {}),
        hours: labourHours,
        net: labourNet,
      },
      totals: {
        ...(request.totals || {}),
        request_total_net: labourNet + partsNet,
        request_total_vat: vatValue,
        request_total_gross: grossValue,
      },
      proforma_key: key,
      proforma_override: {
        title_override: row.title_override || "",
        summary_override: row.summary_override || "",
        labour_hours_override:
          row.labour_hours_override !== null && row.labour_hours_override !== undefined
            ? Number(row.labour_hours_override)
            : null,
        labour_total_override:
          row.labour_total_override !== null && row.labour_total_override !== undefined
            ? Number(row.labour_total_override)
            : null,
        parts_total_override:
          row.parts_total_override !== null && row.parts_total_override !== undefined
            ? Number(row.parts_total_override)
            : null,
        tax_total_override:
          row.tax_total_override !== null && row.tax_total_override !== undefined
            ? Number(row.tax_total_override)
            : null,
        total_override:
          row.total_override !== null && row.total_override !== undefined
            ? Number(row.total_override)
            : null,
      },
    };
  });
}

async function buildJobInvoiceFallback({ jobNumber, vatRate, labourRate, companyProfile }) { // build proforma payload from job data
  if (!jobNumber) {
    return null;
  }
  const { job, customer, vehicle } = await fetchJobSnapshot(jobNumber, null); // reuse snapshot helper
  if (!job) { // job missing => cannot build proforma
    return null;
  }
  const [jobRequests, partAllocations, authorizedVhcRows] = await Promise.all([
    fetchJobRequests(job.id),
    fetchJobPartAllocations(job.id),
    fetchAuthorizedVhcRequests(job.id)
  ]); // collect request + parts info
  const derivedRequests = enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate, authorizedVhcRows); // derive request blocks
  const requestsWithMissingAuthorised = appendMissingAuthorisedRowsFromVhcChecks({
    requests: derivedRequests,
    partAllocations,
    authorizedVhcRows,
    vatRate,
    labourRate,
  });
  const writeUp = await fetchJobWriteUp(job.id);
  const requestsWithWriteUp = attachWriteUpDetailsToRequests(requestsWithMissingAuthorised, writeUp);
  const overrides = await fetchProformaOverrides(job.id);
  const requests = applyProformaOverrides(requestsWithWriteUp, overrides);
  const totals = aggregateRequestTotals(requests); // compute totals
  const invoiceTo = formatAddress(customer); // build customer address
  const companyBlock = buildCompanyBlock(companyProfile); // company snapshot
  const paymentBlock = buildPaymentBlock(companyProfile); // payment snapshot
  const invoiceBlock = {
    invoice_number: `PROFORMA-${job.job_number || jobNumber}`,
    invoice_date: new Date().toISOString(),
    account_number: job.account_number || "",
    job_number: job.job_number || jobNumber,
    order_number: "",
    page_count: 1,
    invoice_to: invoiceTo,
    deliver_to: invoiceTo,
    vehicle_details: buildVehicleDetails(null, job, vehicle),
    totals
  };
  return {
    company: companyBlock,
    invoice: invoiceBlock,
    requests,
    payment: paymentBlock,
    meta: {
      isProforma: true,
      source: "job",
      notice: "Proforma totals generated from live job data until all invoice prerequisites are complete."
    }
  };
} // end buildJobInvoiceFallback

function formatOrderAddressBlock(name, address) { // helper to format order address strings
  const lines = (address || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    name: name || "Customer",
    lines,
    postcode: ""
  };
}

async function buildOrderInvoiceFallback({ orderNumber, vatRate, companyProfile }) { // build proforma payload from order data
  if (!orderNumber) {
    return null;
  }
  const { data: order, error } = await supabase
    .from("parts_order_cards")
    .select(
      `
        *,
        items:parts_order_card_items(
          id,
          part_number,
          part_name,
          quantity,
          unit_price,
          unit_cost
        )
      `
    )
    .eq("order_number", orderNumber)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw error;
  }
  if (!order) {
    return null;
  }
  const parts = (order.items || []).map((item) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const net = unitPrice * qty;
    const vat = net * (vatRate / 100);
    return {
      part_number: item.part_number || "",
      description: item.part_name || "Part",
      retail: unitPrice || null,
      qty,
      price: unitPrice,
      vat,
      rate: vatRate
    };
  });
  const partsNet = parts.reduce((sum, part) => sum + part.price * part.qty, 0);
  const partsVat = parts.reduce((sum, part) => sum + part.vat, 0);
  const requests = [
    {
      request_number: 1,
      title: "Parts Order Items",
      summary: `Order ${orderNumber}`,
      labour: { net: 0, vat: 0, rate: vatRate },
      parts,
      totals: {
        request_total_net: partsNet,
        request_total_vat: partsVat,
        request_total_gross: partsNet + partsVat
      }
    }
  ];
  const totals = aggregateRequestTotals(requests);
  const invoiceTo = formatOrderAddressBlock(order.customer_name, order.customer_address);
  const deliverAddressBlock = order.delivery_address
    ? formatOrderAddressBlock(order.delivery_contact || order.customer_name, order.delivery_address)
    : invoiceTo;
  const vehicleDetails = {
    reg: order.vehicle_reg || "",
    vehicle: [order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ").trim(),
    chassis: order.vehicle_vin || "",
    engine: "",
    reg_date: "",
    mileage: "",
    delivery_date: order.delivery_eta || order.updated_at || ""
  };
  const invoiceBlock = {
    invoice_number: `PROFORMA-${orderNumber}`,
    invoice_date: new Date().toISOString(),
    account_number: "",
    job_number: order.job_number || "",
    order_number: orderNumber,
    page_count: 1,
    invoice_to,
    deliver_to: deliverAddressBlock,
    vehicle_details: vehicleDetails,
    totals
  };
  return {
    company: buildCompanyBlock(companyProfile),
    invoice: invoiceBlock,
    requests,
    payment: buildPaymentBlock(companyProfile),
    meta: {
      isProforma: true,
      source: "order",
      notice: "Proforma totals generated from the live parts order until it is invoiced."
    }
  };
} // end buildOrderInvoiceFallback

export async function getInvoiceDetailPayload({ jobNumber, orderNumber }) { // main orchestration helper for API routes
  if (!jobNumber && !orderNumber) { // ensure identifier provided
    throw new Error("MISSING_IDENTIFIER"); // throw descriptive error
  }
  const invoice = await fetchInvoiceRecord({ jobNumber, orderNumber }); // fetch invoice header
  const configPromise = Promise.all([ // fetch shared config concurrently
    fetchCompanyRates(),
    fetchCompanyProfile()
  ]);
  const [{ vatRate, labourRate }, companyProfile] = await configPromise; // await shared config
  if (!invoice) { // handle missing invoice by building fallback payloads
    if (jobNumber) {
      const fallbackFromJob = await buildJobInvoiceFallback({ jobNumber, vatRate, labourRate, companyProfile });
      if (fallbackFromJob) {
        return fallbackFromJob;
      }
    } else if (orderNumber) {
      const fallbackFromOrder = await buildOrderInvoiceFallback({ orderNumber, vatRate, companyProfile });
      if (fallbackFromOrder) {
        return fallbackFromOrder;
      }
    }
    const error = new Error("NOT_FOUND"); // create descriptive error
    error.status = 404; // attach HTTP status
    throw error; // propagate error
  }
  const { job, customer, vehicle } = await fetchJobSnapshot( // fetch job snapshot
    invoice.job_number || jobNumber || null, // job number fallback
    invoice.job_id || null // job id fallback
  ); // finish snapshot fetch
  const invoiceRequests = await fetchInvoiceRequests(invoice.id); // try fetching stored invoice requests
  let requests = []; // prepare array
  let livePartAllocations = [];
  let liveAuthorizedVhcRows = [];
  if (invoiceRequests.length > 0) { // use stored requests when available
    let authorisedRequestIds = [];
    if (job?.id) {
      const [jobRequests, authorizedVhcRows, partAllocations] = await Promise.all([
        fetchJobRequests(job.id),
        fetchAuthorizedVhcRequests(job.id),
        fetchJobPartAllocations(job.id)
      ]);
      liveAuthorizedVhcRows = Array.isArray(authorizedVhcRows) ? authorizedVhcRows : [];
      livePartAllocations = Array.isArray(partAllocations) ? partAllocations : [];
      const fromJobRequests = (Array.isArray(jobRequests) ? jobRequests : [])
        .filter((row) => {
          const source = String(row?.request_source || row?.requestSource || "").trim().toLowerCase();
          const type = String(row?.job_type || row?.jobType || "").trim().toLowerCase();
          return (
            source === "vhc_authorised" ||
            source === "vhc_authorized" ||
            type === "authorised" ||
            type === "authorized"
          );
        })
        .map((row) => row?.request_id ?? row?.requestId)
        .filter((value) => value !== null && value !== undefined);
      const fromVhcChecks = liveAuthorizedVhcRows
        .map((row) => row?.request_id ?? row?.requestId)
        .filter((value) => value !== null && value !== undefined);
      authorisedRequestIds = [...new Set([...fromJobRequests, ...fromVhcChecks].map((value) => String(value)))];
    }
    requests = normalizeInvoiceRequests(invoiceRequests, { authorisedRequestIds }); // convert to API shape
  } else if (job?.id) { // fallback to job data
    const [jobRequests, partAllocations, authorizedVhcRows] = await Promise.all([ // fetch job requests + parts
      fetchJobRequests(job.id), // job requests
      fetchJobPartAllocations(job.id), // part allocations
      fetchAuthorizedVhcRequests(job.id)
    ]); // finish fetching
    livePartAllocations = Array.isArray(partAllocations) ? partAllocations : [];
    liveAuthorizedVhcRows = Array.isArray(authorizedVhcRows) ? authorizedVhcRows : [];
    requests = enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate, authorizedVhcRows); // build from job data
  } else { // fallback when no job at all
    requests = []; // keep empty list
  }
  if (job?.id && liveAuthorizedVhcRows.length > 0) {
    requests = appendMissingAuthorisedRowsFromVhcChecks({
      requests,
      partAllocations: livePartAllocations,
      authorizedVhcRows: liveAuthorizedVhcRows,
      vatRate,
      labourRate,
    });
  }
  if (job?.id && requests.length > 0) {
    const writeUp = await fetchJobWriteUp(job.id);
    requests = attachWriteUpDetailsToRequests(requests, writeUp);
  }
  const totals = aggregateRequestTotals(requests); // compute aggregated totals
  const invoiceTo = invoice.invoice_to && Object.keys(invoice.invoice_to).length > 0 // check stored invoice_to snapshot
    ? invoice.invoice_to // reuse stored JSON
    : formatAddress(customer); // fallback to derived customer address
  const deliverTo = invoice.deliver_to && Object.keys(invoice.deliver_to).length > 0 // check deliver_to snapshot
    ? invoice.deliver_to // reuse stored JSON
    : invoiceTo; // fallback to invoice address
  const vehicleDetails = buildVehicleDetails(invoice, job, vehicle); // build or reuse vehicle snapshot
  const companyBlock = buildCompanyBlock(companyProfile); // shape company info
  const paymentBlock = buildPaymentBlock(companyProfile); // shape payment info
  const invoiceBlock = { // shape invoice header block
    invoice_number: invoice.invoice_number || invoice.invoice_id || "INV-DRAFT", // friendly invoice number fallback
    invoice_date: invoice.invoice_date || invoice.created_at || new Date().toISOString(), // date fallback
    account_number: invoice.account_number || job?.account_number || invoice.account_id || "", // account number snapshot
    job_number: invoice.job_number || job?.job_number || jobNumber || "", // ensure job number
    order_number: invoice.order_number || orderNumber || "", // optional order reference
    page_count: 1, // this layout renders as single page by default
    invoice_to: invoiceTo, // invoice contact info
    deliver_to: deliverTo, // delivery contact info
    vehicle_details: vehicleDetails, // vehicle snapshot
    totals: { // total block combining cached + computed values
      service_total: invoice.service_total || totals.service_total, // prefer cached totals
      vat_total: invoice.vat_total || totals.vat_total, // prefer cached VAT
      invoice_total: invoice.invoice_total || totals.invoice_total // prefer cached gross
    } // end totals block
  }; // end invoice block
  return { // final payload
    company: companyBlock, // company info
    invoice: invoiceBlock, // invoice header
    requests, // request blocks
    payment: paymentBlock, // bank/payment info
    meta: {
      isProforma: false,
      source: "invoice",
      notice: ""
    }
  }; // end payload
} // end getInvoiceDetailPayload
