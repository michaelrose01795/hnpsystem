// file location: src/lib/invoices/detailService.js // describe where this helper lives
import supabase from "@/lib/supabaseClient"; // import shared Supabase client for DB access

const DEFAULT_VAT_RATE = 20; // default VAT percentage when configuration missing
const DEFAULT_LABOUR_RATE = 85; // default labour rate per hour fallback

const RATE_KEYS = ["vat_rate", "default_labour_rate"]; // configuration keys stored in company_settings table

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
    .select("id, job_number, job_source, status, created_at, completed_at, mileage_at_service, customer_id, customer, vehicle_reg, vehicle_make_model, vehicle_id, account_number") // fetch needed columns
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
    .select("request_id, description, hours, job_type") // fetch relevant columns
    .eq("job_id", jobId) // filter by job id
    .order("sort_order", { ascending: true }); // keep same order as job
  if (error && error.code !== "PGRST116") { // handle real errors
    throw error; // propagate
  }
  return data || []; // return rows or empty list
} // end fetchJobRequests

async function fetchJobPartAllocations(jobId) { // fetch parts allocated to job for grouping
  const { data, error } = await supabase // query parts_job_items joined with catalog
    .from("parts_job_items") // table name
    .select(`
      id,
      allocated_to_request_id,
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
    mileage: job?.mileage_at_service || vehicle?.mileage || "",
    delivery_date: job?.completed_at || "",
    engine_no: vehicle?.engine_number || vehicle?.engine || ""
  }; // return detail object
} // end buildVehicleDetails

function enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate) { // fallback builder for request payload
  const groupedParts = {}; // map request_id -> part items
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
  }); // done grouping
  const fallbackRequests = jobRequests.length > 0 ? jobRequests : [{ // ensure at least one request exists
    request_id: 0, // pseudo id
    description: "Customer Request", // fallback description
    hours: 0, // no labour info
    job_type: "Customer" // default type
  }]; // end fallback
  return fallbackRequests.map((request, index) => { // transform each request to invoice-friendly shape
    const labourHours = Number(request.hours) || 0; // parse hours
    const labourNet = labourHours * labourRate; // compute net labour
    const labourVat = labourNet * (vatRate / 100); // compute VAT value
    const bucketKey =
      request.request_id !== null && request.request_id !== undefined
        ? request.request_id
        : "unassigned"; // choose parts bucket key
    const requestParts = groupedParts[bucketKey] || groupedParts.unassigned || []; // fallback to unassigned bucket
    const parts = requestParts.map((item) => { // map part allocations
      const qty = Number(item.quantity_allocated || 0); // parse quantity
      const net = (Number(item.unit_price) || 0) * qty; // compute net amount
      const vat = net * (vatRate / 100); // compute VAT amount
      return { // return simplified part entry
        id: item.id, // part link id
        part_number: item.part?.part_number || "", // part number
        description: item.part?.name || item.part?.description || "Part", // description fallback
        retail: item.part?.unit_price || null, // optional retail price
        qty, // quantity sold
        price: Number(item.unit_price) || 0, // unit price stored on allocation
        vat, // VAT amount
        rate: vatRate, // VAT rate percent
        net_price: net // net amount
      }; // end part entry
    }); // finish mapping
    const partsNet = parts.reduce((sum, part) => sum + part.net_price, 0); // sum net parts
    const partsVat = parts.reduce((sum, part) => sum + part.vat, 0); // sum VAT parts
    return { // return normalized request block
      request_number: index + 1, // sequential request number
      title: request.description || `Request ${index + 1}`, // display title
      summary: request.job_type || "Customer", // summary label
      labour: { // labour summary object
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

function normalizeInvoiceRequests(structuredRequests) { // convert invoice_requests rows into API shape
  return structuredRequests.map((request, index) => { // iterate stored rows
    const labour = { // build labour block from stored values
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
    return { // return normalized request object
      request_number: request.request_number || index + 1, // preserve stored request number
      title: request.title || `Request ${index + 1}`, // title fallback
      summary: request.notes || "", // summary derived from notes
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

async function buildJobInvoiceFallback({ jobNumber, vatRate, labourRate, companyProfile }) { // build proforma payload from job data
  if (!jobNumber) {
    return null;
  }
  const { job, customer, vehicle } = await fetchJobSnapshot(jobNumber, null); // reuse snapshot helper
  if (!job) { // job missing => cannot build proforma
    return null;
  }
  const [jobRequests, partAllocations] = await Promise.all([
    fetchJobRequests(job.id),
    fetchJobPartAllocations(job.id)
  ]); // collect request + parts info
  const requests = enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate); // derive request blocks
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
    .from("parts_job_cards")
    .select(
      `
        *,
        items:parts_job_card_items(
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
  if (invoiceRequests.length > 0) { // use stored requests when available
    requests = normalizeInvoiceRequests(invoiceRequests); // convert to API shape
  } else if (job?.id) { // fallback to job data
    const [jobRequests, partAllocations] = await Promise.all([ // fetch job requests + parts
      fetchJobRequests(job.id), // job requests
      fetchJobPartAllocations(job.id) // part allocations
    ]); // finish fetching
    requests = enrichRequestsFromJob(jobRequests, partAllocations, vatRate, labourRate); // build from job data
  } else { // fallback when no job at all
    requests = []; // keep empty list
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
