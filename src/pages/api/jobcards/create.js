// ✅ File location: src/pages/api/jobcards/create.js
import { addJobToDatabase } from "@/lib/database/jobs";
import { createOrUpdateVehicle, getVehicleByReg } from "@/lib/database/vehicles";
import { createCustomer, getCustomerById, updateCustomer } from "@/lib/database/customers";

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
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ 
      message: `Method ${req.method} not allowed`,
      code: "METHOD_NOT_ALLOWED"
    });
  }

  try {
    const jobCard = req.body;
    console.log('📝 Creating job card:', jobCard.jobNumber);

    // ✅ Validate required fields
    if (!jobCard.jobNumber) {
      return res.status(400).json({ 
        message: "Missing required field: jobNumber",
        code: "MISSING_JOB_NUMBER"
      });
    }

    if (!jobCard.vehicle || !jobCard.vehicle.reg) {
      return res.status(400).json({ 
        message: "Missing required field: vehicle registration",
        code: "MISSING_VEHICLE"
      });
    }

    if (!jobCard.customer) {
      return res.status(400).json({ 
        message: "Missing required field: customer details",
        code: "MISSING_CUSTOMER"
      });
    }

    if (!jobCard.requests || jobCard.requests.length === 0) {
      return res.status(400).json({ 
        message: "Missing required field: at least one job request",
        code: "MISSING_REQUESTS"
      });
    }

    // ✅ Check for duplicate jobNumber in database
    const { getJobByNumberOrReg } = await import("@/lib/database/jobs");
    const existingJob = await getJobByNumberOrReg(jobCard.jobNumber);
    
    if (existingJob) {
      return res.status(409).json({ 
        message: `Job Card ${jobCard.jobNumber} already exists`,
        code: "DUPLICATE_JOB"
      });
    }

    // ✅ Step 1: Create or Update Customer
    let customerId = jobCard.customer.customerId;
    let customerRecord;

    if (customerId) {
      // Try to get existing customer
      customerRecord = await getCustomerById(customerId);
      
      if (customerRecord) {
        console.log('✅ Found existing customer:', customerId);
        // Optionally update customer details if changed
        await updateCustomer(customerId, {
          firstname: jobCard.customer.firstName,
          lastname: jobCard.customer.lastName,
          email: jobCard.customer.email,
          mobile: jobCard.customer.mobile,
          telephone: jobCard.customer.telephone,
          address: jobCard.customer.address,
          postcode: jobCard.customer.postcode
        });
      }
    }

    if (!customerRecord) {
      // Create new customer
      console.log('➕ Creating new customer');
      const result = await createCustomer({
        firstname: jobCard.customer.firstName,
        lastname: jobCard.customer.lastName,
        email: jobCard.customer.email,
        mobile: jobCard.customer.mobile,
        telephone: jobCard.customer.telephone,
        address: jobCard.customer.address,
        postcode: jobCard.customer.postcode
      });

      if (!result.success) {
        return res.status(500).json({
          message: "Failed to create customer",
          code: "CUSTOMER_ERROR",
          error: result.error
        });
      }

      customerRecord = result.data;
      customerId = customerRecord.id;
      console.log('✅ Customer created:', customerId);
    }

    // ✅ Step 2: Create or Update Vehicle
    let vehicleRecord = await getVehicleByReg(jobCard.vehicle.reg);

    if (!vehicleRecord) {
      console.log('➕ Creating new vehicle:', jobCard.vehicle.reg);
      const result = await createOrUpdateVehicle({
        reg_number: jobCard.vehicle.reg.toUpperCase(),
        colour: jobCard.vehicle.colour,
        make: jobCard.vehicle.makeModel?.split(' ')[0] || '',
        model: jobCard.vehicle.makeModel?.split(' ').slice(1).join(' ') || '',
        vin: jobCard.vehicle.chassis,
        engine_number: jobCard.vehicle.engine,
        mileage: jobCard.vehicle.mileage,
        customer_id: customerId
      });

      if (!result.success) {
        return res.status(500).json({
          message: "Failed to create vehicle",
          code: "VEHICLE_ERROR",
          error: result.error
        });
      }

      vehicleRecord = result.data;
      console.log('✅ Vehicle created');
    } else {
      console.log('✅ Found existing vehicle:', jobCard.vehicle.reg);
      // Update vehicle if mileage is higher
      if (jobCard.vehicle.mileage > vehicleRecord.mileage) {
        await createOrUpdateVehicle({
          reg_number: jobCard.vehicle.reg.toUpperCase(),
          mileage: jobCard.vehicle.mileage,
          customer_id: customerId
        });
        console.log('✅ Vehicle mileage updated');
      }
    }

    // ✅ Step 3: Create Job Card
    // Build description from requests
    const description = jobCard.requests.map(r => r.description).join(', ');
    
    // Determine job type from categories
    let jobType = 'Service';
    if (jobCard.jobCategories?.includes('MOT')) jobType = 'MOT';
    else if (jobCard.jobCategories?.includes('Repair')) jobType = 'Repair';
    else if (jobCard.jobCategories?.includes('Diagnostic')) jobType = 'Diagnostic';

    const result = await addJobToDatabase({
      jobNumber: jobCard.jobNumber,
      reg: jobCard.vehicle.reg.toUpperCase(),
      customerId: customerId,
      assignedTo: null, // Will be assigned later
      type: jobType,
      description: description,
      // Additional fields if your schema supports them
      jobSource: jobCard.jobSource,
      jobCategories: jobCard.jobCategories,
      waitingStatus: jobCard.waitingStatus,
      vhcRequired: jobCard.vhcRequired
    });

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to create job card",
        code: "JOB_ERROR",
        error: result.error
      });
    }

    console.log('✅ Job card created successfully:', jobCard.jobNumber);

    // ✅ Get job history counts
    const { getAllJobs } = await import("@/lib/database/jobs");
    const allJobs = await getAllJobs();
    
    const customerJobs = allJobs.filter(j => 
      j.vehicle?.customer?.id === customerId
    );
    
    const vehicleJobs = allJobs.filter(j => 
      j.reg?.toUpperCase() === jobCard.vehicle.reg.toUpperCase()
    );

    // ✅ Respond with success
    return res.status(200).json({
      message: `Job Card ${jobCard.jobNumber} created successfully!`,
      code: "SUCCESS",
      jobCard: {
        jobNumber: jobCard.jobNumber,
        createdAt: jobCard.createdAt || new Date().toISOString(),
        status: "Open",
        vehicleReg: jobCard.vehicle.reg,
        customerId: customerId,
        description: description,
        type: jobType,
        requests: jobCard.requests,
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
          totalJobs: customerJobs.length
        },
        vehicle: {
          reg: vehicleRecord.reg_number,
          makeModel: `${vehicleRecord.make} ${vehicleRecord.model}`,
          totalJobs: vehicleJobs.length
        }
      }
    });

  } catch (error) {
    console.error("❌ Error creating job card:", error);
    return res.status(500).json({ 
      message: "Failed to create job card",
      code: "SERVER_ERROR",
      error: error.message
    });
  }
}