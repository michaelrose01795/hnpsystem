// file location: src/pages/api/jobcards/create.js

import { supabase } from "@/lib/supabaseClient"; // Import Supabase client
import { addJobToDatabase } from "@/lib/database/jobs";

const toNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const insertJobRequests = async (jobId, requests = []) => {
  if (!jobId || !Array.isArray(requests) || requests.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = requests
    .map((entry, index) => {
      const rawText =
        entry?.text ||
        entry?.description ||
        "";
      const text = rawText.trim();
      if (!text) {
        return null;
      }

      const parsedHours =
        entry?.time === "" || entry?.time === null || entry?.time === undefined
          ? null
          : Number(entry.time);
      const hours = Number.isFinite(parsedHours) ? parsedHours : null;

      return {
        job_id: jobId,
        description: text,
        hours,
        job_type: toNullableString(entry?.paymentType) || "Customer",
        sort_order: index + 1,
        created_at: timestamp,
        updated_at: timestamp,
      };
    })
    .filter(Boolean);

  if (payload.length === 0) {
    return;
  }

  const { error } = await supabase.from("job_requests").insert(payload);
  if (error) {
    throw error;
  }
};

const saveCosmeticDamage = async (jobId, { present = false, notes = null } = {}) => {
  if (!jobId) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = {
    job_id: jobId,
    has_damage: Boolean(present),
    notes: toNullableString(notes),
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { error } = await supabase
    .from("job_cosmetic_damage")
    .upsert(payload, { onConflict: "job_id" });

  if (error) {
    throw error;
  }
};

const saveCustomerStatus = async (jobId, status) => {
  if (!jobId) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = {
    job_id: jobId,
    status: status || "Neither",
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { error } = await supabase.from("job_customer_statuses").insert([payload]);
  if (error) {
    throw error;
  }
};

/**
 * API endpoint to create a new job card
 * POST /api/jobcards/create
 *
 * This endpoint:
 * 1. Validates incoming job card data
 * 2. Creates/updates customer record
 * 3. Creates/updates vehicle record
 * 4. Creates job card with all relationships
 * 5. Returns complete job card with relationship info
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({
      message: `Method ${req.method} not allowed`,
      code: "METHOD_NOT_ALLOWED"
    })
  }

  try {
    const jobCard = req.body
    console.log('📝 Creating job card for vehicle:', jobCard.vehicle?.reg || "unknown")

    // ✅ Validate required fields
    if (!jobCard.vehicle || !jobCard.vehicle.reg) {
      return res.status(400).json({
        message: "Missing required field: vehicle registration",
        code: "MISSING_VEHICLE"
      })
    }

    if (!jobCard.customer) {
      return res.status(400).json({
        message: "Missing required field: customer details",
        code: "MISSING_CUSTOMER"
      })
    }

    if (!jobCard.requests || jobCard.requests.length === 0) {
      return res.status(400).json({
        message: "Missing required field: at least one job request",
        code: "MISSING_REQUESTS"
      })
    }

    // ✅ Step 1: Create or Update Customer
    let customerId = jobCard.customer.customerId
    let customerRecord

    if (customerId) {
      // Try to get existing customer
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (data) {
        console.log('✅ Found existing customer:', customerId)
        customerRecord = data
        
        // Update customer details
        await supabase
          .from('customers')
          .update({
            firstname: jobCard.customer.firstName,
            lastname: jobCard.customer.lastName,
            email: jobCard.customer.email,
            mobile: jobCard.customer.mobile,
            telephone: jobCard.customer.telephone,
            address: jobCard.customer.address,
            postcode: jobCard.customer.postcode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId)
      }
    }

    if (!customerRecord) {
      // Create new customer
      console.log('➕ Creating new customer')
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          firstname: jobCard.customer.firstName,
          lastname: jobCard.customer.lastName,
          email: jobCard.customer.email,
          mobile: jobCard.customer.mobile,
          telephone: jobCard.customer.telephone,
          address: jobCard.customer.address,
          postcode: jobCard.customer.postcode,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (error) {
        return res.status(500).json({
          message: "Failed to create customer",
          code: "CUSTOMER_ERROR",
          error: error.message
        })
      }

      customerRecord = data
      customerId = customerRecord.id
      console.log('✅ Customer created:', customerId)
    }

    // ✅ Step 2: Create or Update Vehicle
    const { data: existingVehicle, error: vehicleCheckError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('reg_number', jobCard.vehicle.reg.toUpperCase())
      .single()

    let vehicleRecord

    if (!existingVehicle) {
      console.log('➕ Creating new vehicle:', jobCard.vehicle.reg)
      const { data, error } = await supabase
        .from('vehicles')
        .insert([{
          reg_number: jobCard.vehicle.reg.toUpperCase(),
          colour: jobCard.vehicle.colour,
          make: jobCard.vehicle.makeModel?.split(' ')[0] || '',
          model: jobCard.vehicle.makeModel?.split(' ').slice(1).join(' ') || '',
          vin: jobCard.vehicle.chassis,
          engine_number: jobCard.vehicle.engine,
          mileage: jobCard.vehicle.mileage,
          customer_id: customerId,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (error) {
        return res.status(500).json({
          message: "Failed to create vehicle",
          code: "VEHICLE_ERROR",
          error: error.message
        })
      }

      vehicleRecord = data
      console.log('✅ Vehicle created')
    } else {
      console.log('✅ Found existing vehicle:', jobCard.vehicle.reg)
      vehicleRecord = existingVehicle
      
      // Update vehicle if mileage is higher
      if (jobCard.vehicle.mileage > vehicleRecord.mileage) {
        await supabase
          .from('vehicles')
          .update({
            mileage: jobCard.vehicle.mileage,
            customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('reg_number', jobCard.vehicle.reg.toUpperCase())
        
        console.log('✅ Vehicle mileage updated')
      }
    }

    // ✅ Step 3: Create Job Card & related metadata
    const sanitizedRequests = Array.isArray(jobCard.requests)
      ? jobCard.requests.map((entry) => ({
          text:
            (entry?.text ||
              entry?.description ||
              "").trim(),
          time: entry?.time ?? null,
          paymentType: entry?.paymentType || entry?.job_type || "Customer",
        }))
      : [];

    const description = sanitizedRequests
      .map((r) => r.text)
      .filter(Boolean)
      .join(", ");

    const jobType = (() => {
      if (jobCard.jobCategories?.includes("MOT")) return "MOT";
      if (jobCard.jobCategories?.includes("Repair")) return "Repair";
      if (jobCard.jobCategories?.includes("Diagnostic")) return "Diagnostic";
      return jobCard.jobSource === "Warranty" ? "Warranty" : "Service";
    })();

    const jobPayload = {
      regNumber: jobCard.vehicle.reg.toUpperCase(),
      jobNumber: jobCard.jobNumber || null,
      description: description || `Job card for ${jobCard.vehicle.reg}`,
      type: jobType,
      assignedTo: jobCard.assignedTo || null,
      customerId,
      vehicleId: vehicleRecord.vehicle_id || vehicleRecord.id || null,
      waitingStatus: jobCard.waitingStatus || "Neither",
      jobSource: jobCard.jobSource || "Retail",
      jobCategories: jobCard.jobCategories || ["Other"],
      requests: sanitizedRequests,
      cosmeticNotes: jobCard.cosmeticNotes || null,
      vhcRequired: jobCard.vhcRequired || false,
      maintenanceInfo: jobCard.maintenanceInfo || {
        cosmeticDamagePresent: jobCard.cosmeticDamage?.present || false,
      },
    };

    const jobResult = await addJobToDatabase(jobPayload);

    if (!jobResult.success || !jobResult.data) {
      return res.status(500).json({
        message: jobResult.error?.message || "Failed to create job card",
        code: "JOB_ERROR",
      });
    }

    const createdJob = jobResult.data;
    const jobId = createdJob?.id;

    if (!jobId) {
      throw new Error("Job ID missing after creation");
    }

    await insertJobRequests(jobId, sanitizedRequests);
    await saveCosmeticDamage(jobId, {
      present:
        jobCard.cosmeticDamage?.present ??
        jobCard.maintenanceInfo?.cosmeticDamagePresent ??
        false,
      notes:
        jobCard.cosmeticDamage?.notes ??
        jobCard.cosmeticNotes ??
        null,
    });
    await saveCustomerStatus(jobId, jobCard.customerStatus || jobCard.waitingStatus || "Neither");

    // ✅ Get job history counts
    const { count: customerJobCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)

    const { count: vehicleJobCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('reg', jobCard.vehicle.reg.toUpperCase())

    const responseJobNumber = createdJob?.jobNumber || createdJob?.job_number || jobCard.jobNumber || null;

    // ✅ Respond with success
    return res.status(200).json({
      message: `Job Card ${responseJobNumber} created successfully!`,
      code: "SUCCESS",
      jobCard: {
        id: jobId,
        jobId,
        jobNumber: responseJobNumber,
        createdAt: jobCard.createdAt || new Date().toISOString(),
        status: createdJob?.status || "pending",
        vehicleReg: jobCard.vehicle.reg,
        customerId: customerId,
        description: description,
        type: jobType,
        requests: sanitizedRequests,
        cosmeticNotes: jobCard.cosmeticNotes || "",
        vhcRequired: jobCard.vhcRequired || false,
        waitingStatus: jobCard.waitingStatus || "Neither",
        jobSource: jobCard.jobSource || "Retail",
        jobCategories: jobCard.jobCategories || ["Other"]
      },
      relationships: {
        customer: {
          id: customerId,
          name: `${customerRecord.firstname} ${customerRecord.lastname}`,
          totalJobs: customerJobCount || 0
        },
        vehicle: {
          reg: vehicleRecord.reg_number,
          makeModel: `${vehicleRecord.make} ${vehicleRecord.model}`,
          totalJobs: vehicleJobCount || 0
        }
      }
    })

  } catch (error) {
    console.error("❌ Error creating job card:", error)
    return res.status(500).json({
      message: "Failed to create job card",
      code: "SERVER_ERROR",
      error: error.message
    })
  }
}
