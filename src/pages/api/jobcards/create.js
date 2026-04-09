// file location: src/pages/api/jobcards/create.js
// Legacy API endpoint for job creation — now delegates to the shared service layer.
// Preserves the original request/response contract for backwards compatibility.

import { ensureCustomer, ensureVehicle, createFullJob } from "@/lib/services/createJobService"; // shared service layer
import { getDatabaseClient } from "@/lib/database/client"; // database client for history counts
import { withRoleGuard } from "@/lib/auth/roleGuard";

const supabase = getDatabaseClient(); // server-side database client

/**
 * API endpoint to create a new job card
 * POST /api/jobcards/create
 *
 * This endpoint:
 * 1. Validates incoming job card data
 * 2. Creates/updates customer record (via service layer)
 * 3. Creates/updates vehicle record (via service layer)
 * 4. Creates job card with all relationships (via service layer)
 * 5. Saves job requests, detections, cosmetic damage, and customer status (via service layer)
 * 6. Returns complete job card with relationship info (same response shape as before)
 */
async function handler(req, res, session) {
  if (req.method !== "POST") { // only accept POST
    res.setHeader("Allow", ["POST"]); // inform client of allowed methods
    return res.status(405).json({ // reject with 405
      message: `Method ${req.method} not allowed`, // error message
      code: "METHOD_NOT_ALLOWED" // error code
    });
  }

  try {
    const jobCard = req.body; // extract request body
    console.log('📝 Creating job card for vehicle:', jobCard.vehicle?.reg || "unknown"); // debug log

    // ✅ Validate required fields (same checks as original)
    if (!jobCard.vehicle || !jobCard.vehicle.reg) { // vehicle registration required
      return res.status(400).json({ // 400 bad request
        message: "Missing required field: vehicle registration", // error message
        code: "MISSING_VEHICLE" // error code
      });
    }

    if (!jobCard.customer) { // customer details required
      return res.status(400).json({ // 400 bad request
        message: "Missing required field: customer details", // error message
        code: "MISSING_CUSTOMER" // error code
      });
    }

    if (!jobCard.requests || jobCard.requests.length === 0) { // at least one request required
      return res.status(400).json({ // 400 bad request
        message: "Missing required field: at least one job request", // error message
        code: "MISSING_REQUESTS" // error code
      });
    }

    // ✅ Step 1: Resolve customer via service layer
    const customerRecord = await ensureCustomer({ // create or update customer
      customerId: jobCard.customer.customerId || null, // existing customer id
      firstName: jobCard.customer.firstName, // first name
      lastName: jobCard.customer.lastName, // last name
      email: jobCard.customer.email, // email
      mobile: jobCard.customer.mobile, // mobile
      telephone: jobCard.customer.telephone || "", // telephone
      address: jobCard.customer.address || "", // address
      postcode: jobCard.customer.postcode || "", // postcode
    });

    const customerId = customerRecord.id; // resolved customer id
    console.log('✅ Customer resolved:', customerId); // debug log

    // ✅ Step 2: Normalize requests into the service layer format
    const normalizedRequests = (jobCard.requests || []).map((r) => ({ // map to expected shape
      text: r.description || r.text || "", // request description text
      time: r.time || r.hours || "", // estimated hours
      paymentType: r.paymentType || r.jobType || "Customer", // payment type
      presetId: r.presetId || null, // preset reference
    }));

    // ✅ Step 3: Create the job via service layer (handles vehicle, job, requests, detections, cosmetic, status)
    const result = await createFullJob({ // delegate to service
      customer: customerRecord, // resolved customer
      vehicle: { // vehicle data from request body
        reg: jobCard.vehicle.reg, // registration
        makeModel: jobCard.vehicle.makeModel || `${jobCard.vehicle.make || ""} ${jobCard.vehicle.model || ""}`.trim(), // make model
        colour: jobCard.vehicle.colour || "", // colour
        chassis: jobCard.vehicle.chassis || jobCard.vehicle.vin || "", // chassis/VIN
        engine: jobCard.vehicle.engine || "", // engine
        mileage: jobCard.vehicle.mileage || "", // mileage
      },
      requests: normalizedRequests, // normalized request list
      options: { // job options
        waitingStatus: jobCard.waitingStatus || "Neither", // waiting status
        jobSource: jobCard.jobSource || "Retail", // job source
        jobDivision: jobCard.jobDivision || "Retail", // job division
        cosmeticNotes: jobCard.cosmeticNotes || null, // cosmetic notes
        cosmeticDamagePresent: !!jobCard.cosmeticDamagePresent, // cosmetic flag
        vhcRequired: !!jobCard.vhcRequired, // VHC flag
        washRequired: !!jobCard.washRequired, // wash flag
        isFirstJob: true, // single job creation
      },
    });

    const insertedJob = result.data.job; // the created job record
    const jobNumber = insertedJob.jobNumber || insertedJob.job_number || null; // job number
    console.log('✅ Job card created successfully:', jobNumber); // debug log

    // ✅ Get job history counts (same as original for response compatibility)
    const { count: customerJobCount } = await supabase // count customer jobs
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    const regUpper = jobCard.vehicle.reg.toUpperCase(); // normalize reg
    const { count: vehicleJobCount } = await supabase // count vehicle jobs
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('vehicle_reg', regUpper);

    // Build description for response (same format as original)
    const description = (jobCard.requests || []).map(r => r.description || r.text || "").join(', '); // comma-joined descriptions

    // Determine job type for response (same logic as original)
    let jobType = 'Service'; // default
    if (jobCard.jobCategories?.includes('MOT')) jobType = 'MOT'; // MOT override
    else if (jobCard.jobCategories?.includes('Repair')) jobType = 'Repair'; // Repair override
    else if (jobCard.jobCategories?.includes('Diagnostic')) jobType = 'Diagnostic'; // Diagnostic override

    // ✅ Respond with success (same response shape as original)
    return res.status(200).json({ // 200 success
      message: `Job Card ${jobNumber} created successfully!`, // success message
      code: "SUCCESS", // success code
      jobCard: { // job card details
        jobNumber: jobNumber, // assigned job number
        createdAt: jobCard.createdAt || new Date().toISOString(), // creation timestamp
        status: "Open", // initial status (corrected from legacy 'pending')
        vehicleReg: jobCard.vehicle.reg, // vehicle registration
        customerId: customerId, // customer id
        description: description, // combined description
        type: jobType, // resolved job type
        requests: jobCard.requests, // original requests
        cosmeticNotes: jobCard.cosmeticNotes || "", // cosmetic notes
        vhcRequired: jobCard.vhcRequired || false, // VHC flag
        waitingStatus: jobCard.waitingStatus || "Neither", // waiting status
        jobSource: jobCard.jobSource || "Retail", // job source
        jobCategories: jobCard.jobCategories || ["Other"] // job categories
      },
      relationships: { // relationship info
        customer: { // customer details
          id: customerId, // customer id
          name: `${customerRecord.firstName} ${customerRecord.lastName}`, // full name
          totalJobs: customerJobCount || 0 // total job count
        },
        vehicle: { // vehicle details
          reg: regUpper, // normalized registration
          makeModel: jobCard.vehicle.makeModel || `${jobCard.vehicle.make || ""} ${jobCard.vehicle.model || ""}`.trim(), // make model
          totalJobs: vehicleJobCount || 0 // total job count
        }
      }
    });

  } catch (error) { // handle errors
    console.error("❌ Error creating job card:", error); // log error
    return res.status(500).json({ // 500 server error
      message: "Failed to create job card", // error message
      code: "SERVER_ERROR", // error code
      error: error.message // error detail
    });
  }
}

export default withRoleGuard(handler);
