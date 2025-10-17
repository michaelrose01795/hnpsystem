// ✅ File location: src/lib/database/jobs.js
import { supabase } from "../supabaseClient";

/* ============================================
   FETCH ALL JOBS
   Gets all jobs along with linked vehicles, customers,
   technicians, appointments, VHC checks, parts, and notes
============================================ */
export const getAllJobs = async () => {
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
      job_notes(*)
    `);

  if (error) {
    console.error("❌ Error fetching jobs:", error);
    return [];
  }

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
    technician: job.technician
      ? `${job.technician.first_name} ${job.technician.last_name}`
      : "",
    customer: job.vehicle?.customer
      ? `${job.vehicle.customer.first_name} ${job.vehicle.customer.last_name}`
      : "",
    appointment: job.appointments?.[0]
      ? {
          date: job.appointments[0].scheduled_time,
          notes: job.appointments[0].notes || "",
        }
      : null,
    vhcChecks: job.vhc_checks || [],
    partsRequests: job.parts_requests || [],
    notes: job.job_notes || [],
  }));
};

/* ============================================
   FETCH JOB BY JOB NUMBER OR VEHICLE REG
============================================ */
export const getJobByNumberOrReg = async (searchTerm) => {
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
      job_notes(*)
    `)
    .or(`job_number.eq.${searchTerm},vehicle.registration.eq.${searchTerm}`)
    .single();

  if (error) {
    console.error("❌ Error fetching job:", error);
    return null;
  }

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
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : "",
    appointment: data.appointments?.[0]
      ? {
          date: data.appointments[0].scheduled_time,
          notes: data.appointments[0].notes || "",
        }
      : null,
    vhcChecks: data.vhc_checks || [],
    partsRequests: data.parts_requests || [],
    notes: data.job_notes || [],
  };
};

/* ============================================
   ADD NEW JOB TO DATABASE
   Creates vehicle if not exists and links job to customer, technician
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
    // 1️⃣ Check if vehicle exists
    let { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("registration", reg)
      .single();

    if (vehicleError && vehicleError.code === "PGRST116") {
      // Vehicle not found → create new
      const { data: newVehicle, error: newVehicleError } = await supabase
        .from("vehicles")
        .insert([{ registration: reg, customer_id: customerId }])
        .select()
        .single();
      if (newVehicleError) throw newVehicleError;
      vehicle = newVehicle;
    }

    // 2️⃣ Insert job linked to vehicle
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert([
        {
          job_number: jobNumber,
          vehicle_id: vehicle.id,
          assigned_to: assignedTo,
          type,
          description,
          status: "New",
        },
      ])
      .select()
      .single();

    if (jobError) throw jobError;

    return { success: true, data: job };
  } catch (error) {
    console.error("❌ Error adding job:", error);
    return { success: false, error };
  }
};

/* ============================================
   UPDATE JOB STATUS
   Updates the status of a job in the database
============================================ */
export const updateJobStatus = async (jobId, newStatus) => {
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

  return { success: true, data };
};

/* ============================================
   SAVE VHC CHECKSHEET
   Adds or updates checksheet data for a specific job
============================================ */
export const saveChecksheet = async (jobNumber, checksheetData) => {
  try {
    const { data, error } = await supabase
      .from("vhc_checks")
      .upsert({ job_number: jobNumber, data: checksheetData })
      .select()
      .single();

    if (error) {
      console.error("❌ Error saving checksheet:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("❌ Error saving checksheet:", error);
    return { success: false, error };
  }
};

/* ============================================
   UPLOAD JOB FILE
   Stores uploaded file in Supabase storage and logs the upload
============================================ */
export const uploadJobFile = async (jobNumber, file, folder = "dealer-files") => {
  try {
    const filePath = `${folder}/${jobNumber}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("job-files") // Supabase storage bucket name
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("job-files")
      .getPublicUrl(filePath);

    // Log the uploaded file into `job_files` table
    await supabase.from("job_files").insert([
      {
        job_number: jobNumber,
        file_name: file.name,
        file_url: publicUrlData.publicUrl,
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
   GET JOB FILES
   Returns all uploaded files linked to a job
============================================ */
export const getJobFiles = async (jobNumber) => {
  const { data, error } = await supabase
    .from("job_files")
    .select("id, file_name, file_url, uploaded_at")
    .eq("job_number", jobNumber)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching job files:", error);
    return [];
  }

  return data || [];
};

/* ============================================
   GET JOB APPOINTMENTS BY DATE
   Used by booked/today view to list scheduled jobs
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
          model
        )
      )
    `)
    .eq("scheduled_time", date);

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
    },
  }));
};