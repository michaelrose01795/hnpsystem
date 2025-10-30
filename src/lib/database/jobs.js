// file location: src/lib/database/jobs.js
import { supabase } from "../supabaseClient";
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
      technician_user:assigned_to(user_id, first_name, last_name, email, role),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at),
      parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, created_at, updated_at),
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

/* ============================================
   HELPER: FORMAT JOB DATA
   Converts database format to application format
   NOW INCLUDES ALL FIELDS FROM DATABASE
============================================ */
const formatJobData = (data) => {
  if (!data) return null;
  
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
    vhcRequired: data.vhc_required || false,
    maintenanceInfo: data.maintenance_info || {},
    
    // ✅ Technician info
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : "",
    technicianEmail: data.technician?.email || "",
    technicianRole: data.technician?.role || "",
    assignedTo: data.assigned_to,
    
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
    vhcChecks: data.vhc_checks || [],
    partsRequests: data.parts_requests || [],
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
      vhc_required: vhcRequired || false,
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
    
    const { data, error } = await supabase
      .from("jobs")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
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
export const assignTechnicianToJob = async (jobId, technicianId, technicianName) => {
  return updateJob(jobId, {
    assigned_to: technicianId,
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