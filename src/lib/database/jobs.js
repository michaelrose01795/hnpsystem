// ✅ File location: src/lib/database/jobs.js
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";

/* ============================================
   FETCH ALL JOBS
   Gets all jobs along with linked vehicles, customers,
   technicians, appointments, VHC checks, parts, notes, and write-ups
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
      vehicle:vehicle_id(
        vehicle_id,
        reg_number,
        make,
        model,
        year,
        colour,
        vin,
        engine_number,
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
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement),
      parts_requests(request_id, part_id, quantity, status),
      job_notes(note_id, note_text, created_at),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, labour_time)
    `);

  if (error) {
    console.error("❌ getAllJobs error:", error);
    return [];
  }

  console.log("✅ getAllJobs fetched:", data?.length || 0, "jobs"); // Debug log

  return data.map((job) => ({
    id: job.id,
    jobNumber: job.job_number || "",
    description: job.description || "",
    type: job.type || "",
    status: job.status || "",
    reg: job.vehicle?.reg_number || "",
    make: job.vehicle?.make || "",
    model: job.vehicle?.model || "",
    year: job.vehicle?.year || "",
    colour: job.vehicle?.colour || "",
    vin: job.vehicle?.vin || "",
    mileage: job.vehicle?.mileage || "",
    fuelType: job.vehicle?.fuel_type || "",
    transmission: job.vehicle?.transmission || "",
    technician: job.technician
      ? `${job.technician.first_name} ${job.technician.last_name}`
      : "",
    customer: job.vehicle?.customer
      ? `${job.vehicle.customer.firstname} ${job.vehicle.customer.lastname}`
      : "",
    customerPhone: job.vehicle?.customer?.mobile || job.vehicle?.customer?.telephone || "",
    customerEmail: job.vehicle?.customer?.email || "",
    customerAddress: job.vehicle?.customer?.address || "",
    appointment: job.appointments?.[0]
      ? {
          date: dayjs(job.appointments[0].scheduled_time).format("YYYY-MM-DD"), // Format date for appointments page
          time: dayjs(job.appointments[0].scheduled_time).format("HH:mm"), // Extract time
          notes: job.appointments[0].notes || "",
        }
      : null,
    vhcChecks: job.vhc_checks || [],
    partsRequests: job.parts_requests || [],
    notes: job.job_notes || [],
    writeUp: job.job_writeups?.[0] || null,
  }));
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
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle:vehicle_id(
          reg_number,
          make,
          model
        )
      )
    `)
    .gte("scheduled_time", `${today}T00:00:00`)
    .lte("scheduled_time", `${today}T23:59:59`);

  if (error) {
    console.error("❌ Error fetching today's appointments:", error);
    return { allJobs, appointments: [] };
  }

  const appointments = (appointmentsData || []).map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle?.reg_number,
      make: a.job?.vehicle?.make,
      model: a.job?.vehicle?.model,
    },
  }));

  return { allJobs, appointments };
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
      vehicle_id,
      vehicle:vehicle_id(
        vehicle_id,
        reg_number,
        make,
        model,
        year,
        colour,
        vin,
        engine_number,
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
      job_writeups(writeup_id, work_performed, parts_used, recommendations)
    `)
    .eq("job_number", searchTerm)
    .maybeSingle();

  if (jobError) {
    console.error("❌ getJobByNumberOrReg error:", jobError);
    return null;
  }

  if (!jobData) {
    console.log("⚠️ Job not found by job_number, trying registration..."); // Debug log
    
    // If not found by job number, try by vehicle registration
    const { data: vehicleJobs, error: vehicleError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle_id,
        vehicle:vehicle_id(
          vehicle_id,
          reg_number,
          make,
          model,
          year,
          colour,
          vin,
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
        job_writeups(writeup_id, work_performed, parts_used, recommendations)
      `)
      .eq("vehicle.reg_number", searchTerm);

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
============================================ */
const formatJobData = (data) => {
  return {
    id: data.id,
    jobNumber: data.job_number,
    description: data.description,
    type: data.type,
    status: data.status,
    reg: data.vehicle?.reg_number || "",
    make: data.vehicle?.make || "",
    model: data.vehicle?.model || "",
    year: data.vehicle?.year || "",
    colour: data.vehicle?.colour || "",
    vin: data.vehicle?.vin || "",
    vehicle: data.vehicle,
    customer: data.vehicle?.customer
      ? `${data.vehicle.customer.firstname} ${data.vehicle.customer.lastname}`
      : "",
    customerPhone: data.vehicle?.customer?.mobile || data.vehicle?.customer?.telephone || "",
    customerEmail: data.vehicle?.customer?.email || "",
    customerAddress: data.vehicle?.customer?.address || "",
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : "",
    appointment: data.appointments?.[0]
      ? {
          date: dayjs(data.appointments[0].scheduled_time).format("YYYY-MM-DD"),
          time: dayjs(data.appointments[0].scheduled_time).format("HH:mm"),
          notes: data.appointments[0].notes || "",
        }
      : null,
    vhcChecks: data.vhc_checks || [],
    partsRequests: data.parts_requests || [],
    notes: data.job_notes || [],
    writeUp: data.job_writeups?.[0] || null,
  };
};

/* ============================================
   ADD NEW JOB TO DATABASE
   Enhanced with better error handling and validation
============================================ */
export const addJobToDatabase = async ({
  jobNumber,
  reg,
  customerId,
  assignedTo,
  type,
  description,
}) => {
  try {
    console.log("➕ addJobToDatabase called with:", { jobNumber, reg, customerId, assignedTo, type }); // Debug log
    
    // Validate required fields
    if (!jobNumber) {
      return { 
        success: false, 
        error: { message: "Job number is required" } 
      };
    }

    if (!reg) {
      return { 
        success: false, 
        error: { message: "Vehicle registration is required" } 
      };
    }

    // Check if job number already exists
    const { data: existingJob, error: checkError } = await supabase
      .from("jobs")
      .select("id, job_number")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (existingJob) {
      console.log("⚠️ Job number already exists:", jobNumber);
      return { 
        success: false, 
        error: { message: `Job number ${jobNumber} already exists` } 
      };
    }

    // Try to find existing vehicle by registration
    let { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("reg_number", reg)
      .maybeSingle();

    // Create new vehicle if not found
    if (!vehicle) {
      console.log("⚠️ Vehicle not found, creating new record for:", reg);
      const { data: newVehicle, error: newVehicleError } = await supabase
        .from("vehicles")
        .insert([{ 
          reg_number: reg,
          customer_id: customerId || null
        }])
        .select()
        .single();

      if (newVehicleError) {
        console.error("❌ Error creating vehicle:", newVehicleError);
        throw newVehicleError;
      }

      vehicle = newVehicle;
      console.log("✅ Vehicle created successfully:", vehicle);
    }

    // Ensure vehicle is valid before proceeding
    if (!vehicle || !vehicle.vehicle_id) {
      throw new Error("Vehicle record could not be found or created");
    }

    // Create new job linked to vehicle
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert([
        {
          job_number: jobNumber,
          vehicle_id: vehicle.vehicle_id,
          assigned_to: assignedTo || null,
          type: type || "Service",
          description: description || "",
          status: "New",
        },
      ])
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle:vehicle_id(
          vehicle_id,
          reg_number,
          make,
          model,
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

    // Format the response to match the expected structure
    const formattedJob = {
      id: job.id,
      jobNumber: job.job_number,
      description: job.description,
      type: job.type,
      status: job.status,
      reg: job.vehicle?.reg_number || "",
      make: job.vehicle?.make || "",
      model: job.vehicle?.model || "",
      customer: job.vehicle?.customer 
        ? `${job.vehicle.customer.firstname} ${job.vehicle.customer.lastname}`
        : "",
      appointment: null,
    };

    return { success: true, data: formattedJob };
  } catch (error) {
    console.error("❌ Error adding job:", error);
    return { 
      success: false, 
      error: { message: error.message || "Failed to create job" } 
    };
  }
};

/* ============================================
   UPDATE JOB STATUS
============================================ */
export const updateJobStatus = async (jobId, newStatus) => {
  try {
    console.log("🔄 Updating job status:", jobId, "to", newStatus); // Debug log
    
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", jobId)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating job status:", error);
      return { success: false, error };
    }

    console.log("✅ Job status updated successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Exception updating job status:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   CREATE OR UPDATE APPOINTMENT
   New function to handle appointment booking
============================================ */
export const createOrUpdateAppointment = async (jobNumber, appointmentDate, appointmentTime) => {
  try {
    console.log("📅 createOrUpdateAppointment called with:", { jobNumber, appointmentDate, appointmentTime }); // Debug log
    
    // Validate inputs
    if (!jobNumber || !appointmentDate || !appointmentTime) {
      return { 
        success: false, 
        error: { message: "Job number, date, and time are required" } 
      };
    }

    // Find the job first
    console.log("🔍 Looking for job:", jobNumber); // Debug log
    
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number")
      .eq("job_number", jobNumber)
      .maybeSingle();

    console.log("📋 Job query result:", { job, jobError }); // Debug log

    if (jobError) {
      console.error("❌ Error querying job:", jobError);
      return { 
        success: false, 
        error: { message: `Database error: ${jobError.message}` } 
      };
    }

    if (!job) {
      console.error("❌ Job not found:", jobNumber);
      return { 
        success: false, 
        error: { message: `Job ${jobNumber} not found in database` } 
      };
    }

    console.log("✅ Job found:", job); // Debug log

    // Combine date and time into a timestamp
    const scheduledDateTime = `${appointmentDate}T${appointmentTime}:00`;
    console.log("🕐 Scheduled datetime:", scheduledDateTime); // Debug log

    // Check if appointment already exists for this job
    const { data: existingAppointment, error: checkError } = await supabase
      .from("appointments")
      .select("appointment_id")
      .eq("job_id", job.id)
      .maybeSingle();

    console.log("📋 Existing appointment check:", { existingAppointment, checkError }); // Debug log

    let appointmentData;

    if (existingAppointment) {
      // Update existing appointment
      console.log("🔄 Updating existing appointment..."); // Debug log
      
      const { data, error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_time: scheduledDateTime,
          updated_at: new Date().toISOString()
        })
        .eq("appointment_id", existingAppointment.appointment_id)
        .select()
        .single();

      if (error) {
        console.error("❌ Error updating appointment:", error);
        throw error;
      }
      
      appointmentData = data;
      console.log("✅ Appointment updated successfully:", appointmentData);
    } else {
      // Create new appointment
      console.log("➕ Creating new appointment..."); // Debug log
      
      const { data, error } = await supabase
        .from("appointments")
        .insert([{
          job_id: job.id,
          scheduled_time: scheduledDateTime,
          status: "Scheduled",
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating appointment:", error);
        throw error;
      }
      
      appointmentData = data;
      console.log("✅ Appointment created successfully:", appointmentData);
    }

    // Update job status to "Booked"
    console.log("🔄 Updating job status to Booked..."); // Debug log
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
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle:vehicle_id(
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
    .lte("scheduled_time", `${date}T23:59:59`);

  if (error) {
    console.error("❌ Error fetching jobs by date:", error);
    return [];
  }

  return data.map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle?.reg_number,
      make: a.job?.vehicle?.make,
      model: a.job?.vehicle?.model,
      customer: a.job?.vehicle?.customer
        ? `${a.job.vehicle.customer.firstname} ${a.job.vehicle.customer.lastname}`
        : "",
    },
  }));
};
