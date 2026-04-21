// file location: src/lib/services/createJobService.js
// Service layer for job creation — consolidates all write operations
// into a single orchestrated flow used by both the create page and the legacy API.

import { getDatabaseClient } from "@/lib/database/client"; // database client
import { addJobToDatabase } from "@/lib/database/jobs"; // shared job insert helper
import { createOrUpdateVehicle } from "@/lib/database/vehicles"; // vehicle upsert
import {
  addCustomerToDatabase,
  checkCustomerExists,
  updateCustomer,
} from "@/lib/database/customers"; // customer helpers
import { detectJobTypesForRequests } from "@/lib/ai/jobTypeDetection"; // AI job-type detection
import { attachMobileFieldsToJob } from "@/lib/mobile/mobileJobs"; // mobile service_mode extension

const supabase = getDatabaseClient(); // server-side database client

/* ------------------------------------------------------------------
   saveJobRequests
   Persists each job request as its own row in the job_requests table.
   Moved from create/index.js to be shared across callers.
------------------------------------------------------------------ */
export const saveJobRequests = async (jobId, jobRequestEntries) => {
  if (!jobId || !Array.isArray(jobRequestEntries) || jobRequestEntries.length === 0) { // guard against invalid inputs
    return []; // nothing to do when payload missing
  }

  const timestamp = new Date().toISOString(); // reuse timestamp for created/updated columns

  const payload = jobRequestEntries // begin mapping job requests into insert payload
    .map((entry, index) => { // iterate each request to normalize fields
      const trimmedDescription = (entry.text || "").trim(); // sanitize description text
      if (!trimmedDescription) { // skip empty descriptions
        return null; // produce null placeholder removed later
      }

      const parsedHours = entry.time === "" || entry.time === null || entry.time === undefined ? null : Number(entry.time); // parse numeric hours when present
      const safeHours = Number.isFinite(parsedHours) ? Number(parsedHours.toFixed(2)) : null; // ensure NaN becomes null and keep 2dp precision

      return { // build insert row
        job_id: jobId, // link to parent job id
        description: trimmedDescription, // set description text
        hours: safeHours, // store parsed hours or null
        job_request_preset_id: entry.presetId || null, // link to preset when chosen
        job_type: (entry.paymentType || "Customer").trim() || "Customer", // persist job type label
        sort_order: index + 1, // keep order for UI grouping
        created_at: timestamp, // assign creation timestamp
        updated_at: timestamp, // assign update timestamp
      };
    })
    .filter(Boolean); // remove null rows from skipped descriptions

  if (payload.length === 0) { // guard when all rows skipped
    return []; // nothing to insert
  }

  const { data, error } = await supabase
    .from("job_requests")
    .insert(payload)
    .select("request_id, description, sort_order, hours"); // insert payload into Supabase table

  if (error) { // check for insert failure
    throw new Error(error.message || "Failed to save job requests"); // bubble error so caller can abort
  }

  return data || []; // return inserted rows
};

/* ------------------------------------------------------------------
   saveJobRequestDetections
   Persists AI-detected job type classifications for each request.
   Moved from create/index.js to be shared across callers.
------------------------------------------------------------------ */
export const saveJobRequestDetections = async (jobId, jobNumber, insertedRequests, jobRequestEntries) => {
  if (!jobId || !Array.isArray(insertedRequests) || insertedRequests.length === 0) { // guard against invalid inputs
    return; // nothing to do
  }

  const detections = detectJobTypesForRequests(jobRequestEntries); // run detection engine
  if (!detections.length) return; // no detections to persist

  const requestIdByOrder = new Map( // map sort_order → request_id for linking
    insertedRequests.map((row) => [row.sort_order, row.request_id])
  );

  const timestamp = new Date().toISOString(); // shared timestamp
  const payload = detections.map((detection) => ({ // build detection rows
    job_id: jobId, // link to parent job
    job_number: jobNumber || null, // human-readable job number
    request_id: requestIdByOrder.get(detection.requestIndex + 1) || null, // link to specific request
    request_index: detection.requestIndex + 1, // 1-based index
    source_text: detection.sourceText, // original text that triggered detection
    job_type: detection.jobType, // detected job type label
    item_category: detection.itemCategory, // detected item category
    confidence: Number.isFinite(detection.confidence) ? detection.confidence : null, // confidence score
    explanation: detection.explanation || null, // reason for detection
    created_at: timestamp, // track creation
    updated_at: timestamp, // track update
  }));

  const { error } = await supabase.from("job_request_detections").insert(payload); // persist detections
  if (error) { // handle insert failure
    throw new Error(error.message || "Failed to save job request detections"); // propagate
  }
};

/* ------------------------------------------------------------------
   saveCosmeticDamage
   Upserts cosmetic damage flag and notes for a job.
   Moved from create/index.js to be shared across callers.
------------------------------------------------------------------ */
export const saveCosmeticDamage = async (jobId, hasDamage, notes) => {
  if (!jobId) { // ensure job id provided
    return; // skip when no job id available
  }

  const timestamp = new Date().toISOString(); // shared timestamp for audit columns
  const payload = { // build upsert payload
    job_id: jobId, // link to parent job
    has_damage: hasDamage === true, // coerce boolean flag
    notes: (notes || "").trim() || null, // store trimmed notes or null
    created_at: timestamp, // track creation time
    updated_at: timestamp, // track update time
  };

  const { error } = await supabase // insert or upsert record
    .from("job_cosmetic_damage") // target cosmetic table
    .upsert(payload, { onConflict: "job_id" }); // enforce single record per job

  if (error) { // handle supabase error
    throw new Error(error.message || "Failed to save cosmetic damage details"); // propagate for caller to handle
  }
};

/* ------------------------------------------------------------------
   saveCustomerStatus
   Inserts the customer waiting status row for scheduling hooks.
   Moved from create/index.js to be shared across callers.
------------------------------------------------------------------ */
export const saveCustomerStatus = async (jobId, status) => {
  if (!jobId) { // ensure we have a job id before writing
    return; // skip when job missing
  }

  const timestamp = new Date().toISOString(); // shared timestamp for audit trail
  const payload = { // build insert payload for customer status table
    job_id: jobId, // link to parent job
    customer_status: status || "Neither", // default to Neither
    created_at: timestamp, // track creation
    updated_at: timestamp, // track update
  };

  const { error } = await supabase.from("job_customer_statuses").insert([payload]); // insert status row
  if (error) { // log but don't block job creation
    console.error("Failed to save customer status", error.message); // non-fatal
  }
};

/* ------------------------------------------------------------------
   ensureCustomer
   Resolves or creates a customer record, returning a normalized
   customer object with an `id` field. Used by the legacy API wrapper
   to match what the create page does via popups.
------------------------------------------------------------------ */
export const ensureCustomer = async ({ customerId, firstName, lastName, email, mobile, telephone, address, postcode }) => {
  if (customerId) { // caller provided an existing customer id
    const updated = await updateCustomer(customerId, { // update customer details
      firstname: firstName, // sync first name
      lastname: lastName, // sync last name
      email, // sync email
      mobile, // sync mobile
      telephone, // sync telephone
      address, // sync address
      postcode, // sync postcode
    });
    if (updated.success) { // update worked
      return { id: customerId, firstName, lastName, email, mobile, telephone, address, postcode }; // return normalized
    }
  }

  // Check if customer already exists by email or mobile
  if (email || mobile) { // at least one contact detail available
    const { exists, customer: existing } = await checkCustomerExists(email, mobile); // check for match
    if (exists && existing?.id) { // found existing customer
      await updateCustomer(existing.id, { // refresh their details
        firstname: firstName, // sync first name
        lastname: lastName, // sync last name
        email, // sync email
        mobile, // sync mobile
        telephone, // sync telephone
        address, // sync address
        postcode, // sync postcode
      });
      return { id: existing.id, firstName, lastName, email, mobile, telephone, address, postcode }; // return normalized
    }
  }

  // Create new customer through the shared database layer
  const inserted = await addCustomerToDatabase({ // insert new customer
    firstname: firstName, // set first name
    lastname: lastName, // set last name
    email, // set email
    mobile, // set mobile
    telephone, // set telephone
    address, // set address
    postcode, // set postcode
  });

  if (!inserted?.id) { // creation failed
    throw new Error("Failed to create customer record"); // abort
  }

  return { id: inserted.id, firstName, lastName, email, mobile, telephone, address, postcode }; // return normalized
};

/* ------------------------------------------------------------------
   ensureVehicle
   Upserts a vehicle record using the shared database helper,
   returning the vehicle record with a vehicle_id.
------------------------------------------------------------------ */
export const ensureVehicle = async ({ reg, makeModel, colour, chassis, engine, mileage, customerId }) => {
  const regUpper = (reg || "").trim().toUpperCase(); // normalize registration
  if (!regUpper) { // guard against missing registration
    throw new Error("Vehicle registration is required"); // abort
  }

  const makeModelParts = (makeModel || "").trim().split(/\s+/); // split make and model
  const primaryMake = makeModelParts[0] || "Unknown"; // extract make
  const modelName = makeModelParts.slice(1).join(" "); // extract model

  const vehiclePayload = { // build vehicle payload matching database/vehicles.js contract
    registration: regUpper, // primary registration field
    reg_number: regUpper, // legacy registration field
    make_model: makeModel || "", // combined make model display string
    make: primaryMake, // separate make field
    model: modelName, // separate model field
    colour: colour || null, // vehicle colour
    chassis: chassis || null, // chassis/VIN
    vin: chassis || null, // VIN alias
    engine: engine || null, // engine number
    engine_number: engine || null, // engine alias
    mileage: mileage === "" || mileage === null || mileage === undefined // parse mileage
      ? null
      : Number.isFinite(Number(mileage))
        ? parseInt(mileage, 10)
        : null,
    customer_id: customerId, // link to customer
  };

  const vehicleResult = await createOrUpdateVehicle(vehiclePayload); // upsert vehicle

  if (!vehicleResult.success || !vehicleResult.data) { // check for failure
    throw new Error(vehicleResult.error?.message || "Failed to save vehicle"); // abort
  }

  return vehicleResult.data; // return vehicle record with vehicle_id
};

/* ==================================================================
   createFullJob
   Orchestrates the complete job creation flow for a single job tab.

   Params:
   - customer:     { id, firstName, lastName, email, mobile, telephone, address, postcode }
   - vehicle:      { reg, makeModel, colour, chassis, engine, mileage }
   - requests:     [{ text, time, paymentType, presetId }]
   - options:      { waitingStatus, jobSource, jobDivision, cosmeticNotes,
                     cosmeticDamagePresent, vhcRequired, washRequired,
                     primeJobId, asPrimeJob, isFirstJob }

   Returns: { success, data: { job, insertedRequests } } or throws.
================================================================== */
export const createFullJob = async ({ customer, vehicle, requests, options = {} }) => {
  const {
    waitingStatus = "Neither", // customer waiting preference
    jobSource = "Retail", // job source channel
    jobDivision = "Retail", // job division
    cosmeticNotes = null, // cosmetic damage notes
    cosmeticDamagePresent = false, // cosmetic damage flag
    vhcRequired = false, // VHC required flag
    washRequired = false, // wash required flag
    primeJobId = null, // prime job id for sub-job linking
    asPrimeJob = false, // create as prime job flag
    isFirstJob = true, // whether this is the first job in a multi-tab batch
  } = options;

  // Step 1: Resolve vehicle (upsert)
  const vehicleRecord = await ensureVehicle({ // upsert vehicle record
    reg: vehicle.reg, // registration number
    makeModel: vehicle.makeModel, // make and model
    colour: vehicle.colour, // colour
    chassis: vehicle.chassis, // chassis/VIN
    engine: vehicle.engine, // engine number
    mileage: vehicle.mileage, // mileage
    customerId: customer.id, // link to customer
  });

  const vehicleId = vehicleRecord.vehicle_id || vehicleRecord.id; // resolve vehicle id
  if (!vehicleId) { // guard against missing id
    throw new Error("Vehicle ID not returned after save"); // abort
  }

  // Step 2: Sanitize requests
  const sanitizedRequests = (requests || []) // filter and clean request entries
    .map((req) => ({ ...req, text: (req.text || "").trim() })) // trim text
    .filter((req) => req.text.length > 0); // remove empty rows

  if (sanitizedRequests.length === 0) { // at least one request required
    throw new Error("At least one job request is required"); // abort
  }

  const regUpper = (vehicle.reg || "").trim().toUpperCase(); // normalize registration
  const jobDescription = sanitizedRequests.map((req) => req.text).join("\n"); // combine request text
  const detectedJobTypes = Array.from( // detect categories from request text
    new Set(detectJobTypesForRequests(sanitizedRequests).map((d) => d.jobType))
  );

  // Step 3: Insert the job row via shared helper
  const jobPayload = { // build payload matching addJobToDatabase contract
    regNumber: regUpper, // vehicle registration
    jobNumber: null, // auto-generated by addJobToDatabase
    description: jobDescription || `Job card for ${regUpper}`, // job description
    type: jobSource === "Warranty" ? "Warranty" : "Service", // job type
    assignedTo: null, // assigned later
    customerId: customer.id, // link to customer
    vehicleId, // link to vehicle
    waitingStatus, // customer waiting status
    jobSource, // source channel
    jobDivision, // division
    jobCategories: detectedJobTypes, // detected categories
    requests: sanitizedRequests, // request list for JSON column
    cosmeticNotes: isFirstJob ? cosmeticNotes : null, // cosmetic notes (first job only)
    vhcRequired: isFirstJob ? vhcRequired : false, // VHC flag (first job only)
    maintenanceInfo: isFirstJob ? { cosmeticDamagePresent, washRequired } : {}, // maintenance metadata
    primeJobId: primeJobId || null, // prime job for sub-job linking
    asPrimeJob, // create as prime flag
  };

  const jobResult = await addJobToDatabase(jobPayload); // insert job row

  if (!jobResult.success || !jobResult.data) { // check for failure
    throw new Error(jobResult.error?.message || "Failed to create job card"); // abort
  }

  const insertedJob = jobResult.data; // get the inserted job record
  const jobId = insertedJob.id || insertedJob.jobId || insertedJob.job_id; // resolve job id

  if (!jobId) { // guard against missing id
    throw new Error("Job ID missing after creation"); // abort
  }

  // Step 4: Save cosmetic damage details (first job only)
  if (isFirstJob) { // only first job gets cosmetic data
    await saveCosmeticDamage(jobId, cosmeticDamagePresent, cosmeticNotes); // persist damage info
  }

  // Step 5: Save customer waiting status
  await saveCustomerStatus(jobId, waitingStatus); // persist status row

  // Step 6: Save job requests to dedicated table
  const insertedRequests = await saveJobRequests(jobId, sanitizedRequests); // persist request rows

  // Step 7: Save job request detections
  await saveJobRequestDetections( // persist AI detections
    jobId, // parent job
    insertedJob.jobNumber || insertedJob.job_number || null, // job number for reference
    insertedRequests, // inserted request rows for linking
    sanitizedRequests // original entries for detection
  );

  return { // return result
    success: true, // success flag
    data: { // payload
      job: insertedJob, // the full job record
      insertedRequests, // the inserted request rows
      vehicleId, // resolved vehicle id
    },
  };
};

/* ------------------------------------------------------------------
   createFullJobBatch
   Orchestrates multi-tab job creation. Creates all jobs in sequence,
   linking subsequent jobs as sub-jobs when asPrimeJob is enabled.

   Params:
   - customer:  normalized customer object with id
   - vehicle:   { reg, makeModel, colour, chassis, engine, mileage }
   - tabs:      array of tab objects matching the create page shape
   - sharedOptions: { cosmeticNotes, cosmeticDamagePresent, vhcRequired,
                      washRequired, isSubJobMode, primeJobData, asPrimeJob }

   Returns: { success, data: { createdJobs, primaryJob } }
------------------------------------------------------------------ */
export const createFullJobBatch = async ({ customer, vehicle, tabs, sharedOptions = {} }) => {
  const {
    cosmeticNotes = null, // cosmetic notes
    cosmeticDamagePresent = false, // cosmetic damage flag
    vhcRequired = false, // VHC required flag
    washRequired = false, // wash required flag
    isSubJobMode = false, // sub-job mode flag
    primeJobData = null, // prime job data when in sub-job mode
    asPrimeJob = false, // create as prime job flag
    // Mobile Mechanic extension — when the create page marks a job as
    // eligible+selected for mobile mechanic, it passes a mobileDetails
    // object here. We patch the primary job with service_mode='mobile'
    // and the on-site contact fields after it's been inserted, reusing
    // the existing attachMobileFieldsToJob helper.
    mobileDetails = null,
    mobileUserId = null,
  } = sharedOptions;

  const createdJobs = []; // accumulator for created job results
  let primeJobId = null; // stores first job's id for sub-job linking

  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) { // iterate each tab
    const tab = tabs[tabIndex]; // current tab
    const isFirstTab = tabIndex === 0; // flag for first tab

    const result = await createFullJob({ // create single job via service
      customer, // resolved customer
      vehicle, // vehicle data
      requests: tab.requests, // tab requests
      options: { // per-tab options
        waitingStatus: tab.waitingStatus, // customer waiting status
        jobSource: tab.jobSource, // source channel
        jobDivision: tab.jobDivision, // division
        cosmeticNotes, // cosmetic notes (shared)
        cosmeticDamagePresent, // cosmetic flag (shared)
        vhcRequired, // VHC flag (shared)
        washRequired, // wash flag (shared)
        primeJobId: isSubJobMode && primeJobData // prime job linking
          ? primeJobData.id
          : (!isFirstTab && primeJobId ? primeJobId : null),
        // Job 1 is always the prime/host when creating multiple jobs together
        asPrimeJob: !isSubJobMode && (asPrimeJob || tabs.length > 1) && isFirstTab,
        isFirstJob: isFirstTab, // cosmetic/VHC only on first
      },
    });

    createdJobs.push(result.data); // accumulate result

    // Store the prime job ID for linking subsequent tabs
    // Always prime the first tab when multiple tabs are being created
    if (isFirstTab && (asPrimeJob || tabs.length > 1) && !isSubJobMode) {
      const job = result.data.job; // get job record
      primeJobId = job.id || job.jobId || job.job_id; // store id for linking
    }
  }

  // Apply Mobile Mechanic fields to the primary (first) job after creation.
  // Skipped entirely for workshop jobs so the existing flow is untouched.
  const primaryJob = createdJobs[0]?.job || null;
  if (mobileDetails && primaryJob) {
    const primaryJobId = primaryJob.id || primaryJob.jobId || primaryJob.job_id;
    if (primaryJobId) {
      try {
        await attachMobileFieldsToJob({
          jobId: primaryJobId,
          mobileDetails,
          userId: mobileUserId,
        });
      } catch (mobileErr) {
        // Surface as a console warning rather than aborting — the job itself
        // was created successfully. The caller can retry the mobile-mode
        // patch from the job page if needed.
        console.warn("Failed to attach mobile fields to job:", mobileErr?.message || mobileErr);
      }
    }
  }

  return { // return batch result
    success: true, // success flag
    data: { // payload
      createdJobs, // array of { job, insertedRequests, vehicleId }
      primaryJob, // first job for redirect
    },
  };
};
