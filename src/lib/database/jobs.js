// file location: src/lib/database/jobs.js
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
      vehicle:vehicles(
        id,
        registration,
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
        service_history,
        warranty_type,
        warranty_expiry,
        insurance_provider,
        insurance_policy_number,
        customer:users(
          id,
          first_name,
          last_name,
          email,
          phone,
          address,
          contact_preference
        )
      ),
      technician:users(id, first_name, last_name, email),
      appointments(*),
      vhc_checks(*),
      parts_requests(*),
      job_notes(*),
      job_writeups(*)
    `);

  if (error) {
    console.error("❌ getAllJobs error:", error);
    return [];
  }

  console.log("✅ getAllJobs fetched:", data?.length || 0, "jobs"); // Debug log
  console.log("📋 Sample job data:", data?.[0]); // Show first job structure

  return data.map((job) => ({
    id: job.id,
    jobNumber: job.job_number || "",
    description: job.description || "",
    type: job.type || "",
    status: job.status || "",
    reg: job.vehicle?.registration || "",
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
      ? `${job.vehicle.customer.first_name} ${job.vehicle.customer.last_name}`
      : "",
    customerPhone: job.vehicle?.customer?.phone || "",
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
      id,
      scheduled_time,
      notes,
      job:jobs(
        id,
        job_number,
        type,
        status,
        vehicle:vehicles(
          registration,
          make,
          model
        )
      )
    `)
    .eq("scheduled_time", today);

  if (error) {
    console.error("❌ Error fetching today's appointments:", error);
    return { allJobs, appointments: [] };
  }

  const appointments = (appointmentsData || []).map((a) => ({
    appointmentId: a.id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle?.registration,
      make: a.job?.vehicle?.make,
      model: a.job?.vehicle?.model,
    },
  }));

  return { allJobs, appointments };
};

/* ============================================
   FETCH JOB BY JOB NUMBER OR VEHICLE REG
   Updated with better debugging and error handling
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
      vehicle:vehicles(
        id,
        registration,
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
        service_history,
        warranty_type,
        warranty_expiry,
        insurance_provider,
        insurance_policy_number,
        customer:users(
          id,
          first_name,
          last_name,
          email,
          phone,
          address,
          contact_preference
        )
      ),
      technician:users(id, first_name, last_name, email),
      appointments(*),
      vhc_checks(*),
      parts_requests(*),
      job_notes(*),
      job_writeups(*)
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
    const { data: vehicleData, error: vehicleError } = await supabase
      .from("vehicles")
      .select(`
        id,
        jobs(
          id,
          job_number,
          description,
          type,
          status,
          assigned_to,
          vehicle:vehicles(
            id,
            registration,
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
            service_history,
            warranty_type,
            warranty_expiry,
            insurance_provider,
            insurance_policy_number,
            customer:users(
              id,
              first_name,
              last_name,
              email,
              phone,
              address,
              contact_preference
            )
          ),
          technician:users(id, first_name, last_name, email),
          appointments(*),
          vhc_checks(*),
          parts_requests(*),
          job_notes(*),
          job_writeups(*)
        )
      `)
      .eq("registration", searchTerm)
      .maybeSingle();

    if (vehicleError || !vehicleData || !vehicleData.jobs || vehicleData.jobs.length === 0) {
      console.log("❌ Job not found by registration either"); // Debug log
      return null;
    }

    const data = vehicleData.jobs[0];
    console.log("✅ Job found by registration:", data.job_number); // Debug log
    
    return {
      id: data.id,
      jobNumber: data.job_number,
      description: data.description,
      type: data.type,
      status: data.status,
      reg: data.vehicle?.registration || "",
      make: data.vehicle?.make || "",
      model: data.vehicle?.model || "",
      year: data.vehicle?.year || "",
      colour: data.vehicle?.colour || "",
      vin: data.vehicle?.vin || "",
      vehicle: data.vehicle,
      customer: data.vehicle?.customer
        ? `${data.vehicle.customer.first_name} ${data.vehicle.customer.last_name}`
        : "",
      customerPhone: data.vehicle?.customer?.phone || "",
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
  }

  console.log("✅ Job found by job_number:", jobData.job_number); // Debug log
  console.log("📋 Full job data:", jobData); // Show complete job structure

  return {
    id: jobData.id,
    jobNumber: jobData.job_number,
    description: jobData.description,
    type: jobData.type,
    status: jobData.status,
    reg: jobData.vehicle?.registration || "",
    make: jobData.vehicle?.make || "",
    model: jobData.vehicle?.model || "",
    year: jobData.vehicle?.year || "",
    colour: jobData.vehicle?.colour || "",
    vin: jobData.vehicle?.vin || "",
    vehicle: jobData.vehicle,
    customer: jobData.vehicle?.customer
      ? `${jobData.vehicle.customer.first_name} ${jobData.vehicle.customer.last_name}`
      : "",
    customerPhone: jobData.vehicle?.customer?.phone || "",
    customerEmail: jobData.vehicle?.customer?.email || "",
    customerAddress: jobData.vehicle?.customer?.address || "",
    technician: jobData.technician
      ? `${jobData.technician.first_name} ${jobData.technician.last_name}`
      : "",
    appointment: jobData.appointments?.[0]
      ? {
          date: dayjs(jobData.appointments[0].scheduled_time).format("YYYY-MM-DD"),
          time: dayjs(jobData.appointments[0].scheduled_time).format("HH:mm"),
          notes: jobData.appointments[0].notes || "",
        }
      : null,
    vhcChecks: jobData.vhc_checks || [],
    partsRequests: jobData.parts_requests || [],
    notes: jobData.job_notes || [],
    writeUp: jobData.job_writeups?.[0] || null,
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
      .maybeSingle(); // Use maybeSingle instead of single to avoid error on no results

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
      .eq("registration", reg)
      .maybeSingle(); // Use maybeSingle to handle no results gracefully

    // Create new vehicle if not found
    if (!vehicle) {
      console.log("⚠️ Vehicle not found, creating new record for:", reg);
      const { data: newVehicle, error: newVehicleError } = await supabase
        .from("vehicles")
        .insert([{ 
          registration: reg, 
          customer_id: customerId || null // Allow null customer initially
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
    if (!vehicle || !vehicle.id) {
      throw new Error("Vehicle record could not be found or created");
    }

    // Create new job linked to vehicle
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert([
        {
          job_number: jobNumber,
          vehicle_id: vehicle.id,
          assigned_to: assignedTo || null, // Allow null assignment
          type: type || "Service", // Default to Service if not specified
          description: description || "",
          status: "New", // Set initial status
        },
      ])
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle:vehicles(
          id,
          registration,
          make,
          model,
          customer:users(
            id,
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      .single();

    if (jobError) {
      console.error("❌ Error creating job:", jobError);
      throw jobError;
    }

    console.log("✅ Job successfully added:", job);

    // Format the response to match the expected structure in appointments page
    const formattedJob = {
      id: job.id,
      jobNumber: job.job_number,
      description: job.description,
      type: job.type,
      status: job.status,
      reg: job.vehicle?.registration || "",
      make: job.vehicle?.make || "",
      model: job.vehicle?.model || "",
      customer: job.vehicle?.customer 
        ? `${job.vehicle.customer.first_name} ${job.vehicle.customer.last_name}`
        : "",
      appointment: null, // No appointment yet
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
      .select("id")
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
        .eq("id", existingAppointment.id)
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
   SAVE VHC CHECKSHEET
============================================ */
export const saveChecksheet = async (jobNumber, checksheetData) => {
  try {
    const { data, error } = await supabase
      .from("vhc_checks")
      .upsert({ job_number: jobNumber, data: checksheetData })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error saving checksheet:", error);
    return { success: false, error };
  }
};

/* ============================================
   SAVE INDIVIDUAL VHC SECTION
============================================ */
export const saveVhcSection = async (jobNumber, sectionKey, sectionData) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("vhc_checks")
      .select("id, data")
      .eq("job_number", jobNumber)
      .single();

    const updatedData =
      !fetchError && existing?.data
        ? { ...existing.data, [sectionKey]: sectionData }
        : { [sectionKey]: sectionData };

    const { data, error } = await supabase
      .from("vhc_checks")
      .upsert({ job_number: jobNumber, data: updatedData })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error saving VHC section:", error);
    return { success: false, error };
  }
};

/* ============================================
   SAVE WRITE-UP
============================================ */
export const saveWriteUp = async (jobNumber, writeUpData) => {
  try {
    const { data, error } = await supabase
      .from("job_writeups")
      .upsert({
        job_number: jobNumber,
        ...writeUpData,
        updated_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error saving write-up:", error);
    return { success: false, error };
  }
};

/* ============================================
   UPLOAD JOB FILE
============================================ */
export const uploadJobFile = async (jobNumber, file, folder = "dealer-files") => {
  try {
    const filePath = `${folder}/${jobNumber}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("job-files")
      .upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("job-files")
      .getPublicUrl(filePath);

    await supabase.from("job_files").insert([
      {
        job_number: jobNumber,
        file_name: file.name,
        file_url: publicUrlData.publicUrl,
        folder,
        uploaded_at: new Date(),
      },
    ]);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (error) {
    console.error("❌ Error uploading job file:", error);
    return { success: false, error };
  }
};

/* ============================================
   DELETE JOB FILE
============================================ */
export const deleteJobFile = async (fileId) => {
  try {
    const { data: file, error: fetchError } = await supabase
      .from("job_files")
      .select("file_url")
      .eq("id", fileId)
      .single();
    if (fetchError) throw fetchError;

    const filePath = file.file_url.split("/job-files/")[1];
    const { error: deleteError } = await supabase.storage
      .from("job-files")
      .remove([filePath]);
    if (deleteError) throw deleteError;

    await supabase.from("job_files").delete().eq("id", fileId);
    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting job file:", error);
    return { success: false, error };
  }
};

/* ============================================
   GET JOB FILES
============================================ */
export const getJobFiles = async (jobNumber) => {
  const { data, error } = await supabase
    .from("job_files")
    .select("id, file_name, file_url, uploaded_at, folder")
    .eq("job_number", jobNumber)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching job files:", error);
    return [];
  }

  return data || [];
};

/* ============================================
   GET JOBS BY DATE
============================================ */
export const getJobsByDate = async (date) => {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      scheduled_time,
      notes,
      job:jobs(
        id,
        job_number,
        type,
        status,
        vehicle:vehicles(
          registration,
          make,
          model,
          customer:users(
            first_name,
            last_name
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
    appointmentId: a.id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle?.registration,
      make: a.job?.vehicle?.make,
      model: a.job?.vehicle?.model,
      customer: a.job?.vehicle?.customer
        ? `${a.job.vehicle.customer.first_name} ${a.job.vehicle.customer.last_name}`
        : "",
    },
  }));
};