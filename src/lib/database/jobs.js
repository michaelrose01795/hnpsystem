// file location: src/lib/database/jobs.js
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
        customer_id,
        customer:users(id, first_name, last_name, email)
      ),
      technician:users(id, first_name, last_name, email),
      appointments(*),
      vhc_checks(*),
      parts_requests(*),
      job_notes(*)
    `);

  if (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }

  return data.map((job) => ({
    id: job.id,
    jobNumber: job.job_number || "",
    description: job.description || "",
    type: job.type || "",
    status: job.status || "",
    reg: job.vehicle?.registration || "",
    customer: job.vehicle?.customer
      ? `${job.vehicle.customer.first_name} ${job.vehicle.customer.last_name}`
      : "",
    technician: job.technician
      ? `${job.technician.first_name} ${job.technician.last_name}`
      : "",
    appointment: job.appointments?.[0]
      ? { date: job.appointments[0].scheduled_time, notes: job.appointments[0].notes || "" }
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
        customer_id,
        customer:users(id, first_name, last_name, email)
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
    console.error("Error fetching job:", error);
    return null;
  }

  return {
    id: data.id,
    jobNumber: data.job_number,
    description: data.description,
    type: data.type,
    status: data.status,
    reg: data.vehicle?.registration || "",
    customer: data.vehicle?.customer
      ? `${data.vehicle.customer.first_name} ${data.vehicle.customer.last_name}`
      : "",
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : "",
    appointment: data.appointments?.[0]
      ? { date: data.appointments[0].scheduled_time, notes: data.appointments[0].notes || "" }
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
export const addJobToDatabase = async ({ jobNumber, reg, customerId, assignedTo, type, description }) => {
  try {
    // 1. Check if vehicle exists
    let { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('registration', reg)
      .single();

    if (vehicleError && vehicleError.code === 'PGRST116') {
      // Vehicle not found → create new
      const { data: newVehicle, error: newVehicleError } = await supabase
        .from('vehicles')
        .insert([{ registration: reg, customer_id: customerId }])
        .select()
        .single();
      if (newVehicleError) throw newVehicleError;
      vehicle = newVehicle;
    }

    // 2. Insert job linked to vehicle
    const { data: job, error: jobError } = await supabase
      .from('jobs')
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
    console.error("Error adding job:", error);
    return { success: false, error };
  }
};