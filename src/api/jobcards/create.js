// file location: src/pages/api/jobcards/create.js

// Initialize in-memory databases
if (!global.jobCards) global.jobCards = [];
if (!global.customers) global.customers = [];
if (!global.vehicles) global.vehicles = [];

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ 
      message: `Method ${req.method} not allowed`,
      code: "METHOD_NOT_ALLOWED"
    });
  }

  try {
    const jobCard = req.body;

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

    // ✅ Check for duplicate jobNumber
    const duplicate = global.jobCards.find(j => j.jobNumber === jobCard.jobNumber);
    if (duplicate) {
      return res.status(409).json({ 
        message: `Job Card ${jobCard.jobNumber} already exists`,
        code: "DUPLICATE_JOB"
      });
    }

    // ✅ Store/Update Customer (if not exists)
    let customerRecord = global.customers.find(
      c => c.customerId === jobCard.customer.customerId
    );

    if (!customerRecord) {
      // Create new customer
      customerRecord = {
        customerId: jobCard.customer.customerId,
        firstName: jobCard.customer.firstName,
        lastName: jobCard.customer.lastName,
        email: jobCard.customer.email,
        mobile: jobCard.customer.mobile,
        telephone: jobCard.customer.telephone,
        address: jobCard.customer.address,
        postcode: jobCard.customer.postcode,
        createdAt: new Date().toISOString(),
        jobHistory: [jobCard.jobNumber], // Track jobs for this customer
      };
      global.customers.push(customerRecord);
    } else {
      // Update existing customer's job history
      if (!customerRecord.jobHistory.includes(jobCard.jobNumber)) {
        customerRecord.jobHistory.push(jobCard.jobNumber);
      }
    }

    // ✅ Store/Update Vehicle (if not exists)
    let vehicleRecord = global.vehicles.find(
      v => v.reg === jobCard.vehicle.reg
    );

    if (!vehicleRecord) {
      // Create new vehicle
      vehicleRecord = {
        reg: jobCard.vehicle.reg,
        colour: jobCard.vehicle.colour,
        makeModel: jobCard.vehicle.makeModel,
        chassis: jobCard.vehicle.chassis,
        engine: jobCard.vehicle.engine,
        mileage: jobCard.vehicle.mileage,
        ownerId: jobCard.customer.customerId, // Link vehicle to customer
        createdAt: new Date().toISOString(),
        jobHistory: [jobCard.jobNumber], // Track jobs for this vehicle
      };
      global.vehicles.push(vehicleRecord);
    } else {
      // Update vehicle's job history
      if (!vehicleRecord.jobHistory.includes(jobCard.jobNumber)) {
        vehicleRecord.jobHistory.push(jobCard.jobNumber);
      }
      // Update mileage if provided and higher
      if (jobCard.vehicle.mileage > vehicleRecord.mileage) {
        vehicleRecord.mileage = jobCard.vehicle.mileage;
      }
    }

    // ✅ Create the complete job card with all relationships
    const completeJobCard = {
      jobNumber: jobCard.jobNumber,
      createdAt: jobCard.createdAt || new Date().toISOString(),
      status: jobCard.status || "Open",
      
      // Link to vehicle (using reg as foreign key)
      vehicleReg: jobCard.vehicle.reg,
      vehicle: jobCard.vehicle,
      
      // Link to customer (using customerId as foreign key)
      customerId: jobCard.customer.customerId,
      customer: jobCard.customer,
      
      // Job details
      requests: jobCard.requests,
      cosmeticNotes: jobCard.cosmeticNotes || "",
      vhcRequired: jobCard.vhcRequired || false,
      waitingStatus: jobCard.waitingStatus || "Neither",
      jobSource: jobCard.jobSource || "Retail",
      jobCategories: jobCard.jobCategories || ["Other"],
    };

    // Store the job card
    global.jobCards.push(completeJobCard);

    // ✅ Respond with success and show relationships
    return res.status(200).json({
      message: `Job Card ${jobCard.jobNumber} created successfully!`,
      code: "SUCCESS",
      jobCard: completeJobCard,
      relationships: {
        customer: {
          id: customerRecord.customerId,
          name: `${customerRecord.firstName} ${customerRecord.lastName}`,
          totalJobs: customerRecord.jobHistory.length,
        },
        vehicle: {
          reg: vehicleRecord.reg,
          makeModel: vehicleRecord.makeModel,
          totalJobs: vehicleRecord.jobHistory.length,
        },
      },
    });

  } catch (error) {
    console.error("Error creating job card:", error);
    return res.status(500).json({ 
      message: "Failed to create job card",
      code: "SERVER_ERROR",
      error: error.message
    });
  }
}