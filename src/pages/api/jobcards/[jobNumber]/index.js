// file location: src/pages/api/jobcards/[jobNumber]/index.js
import { getDatabaseClient } from "@/lib/database/client";
import {
  buildJobDataFromRow,
  mapClockingStatus,
  mapServiceHistoryJobs,
  mapWarrantyJob
} from "@/lib/jobcards/jobDataTransformers";

const supabase = getDatabaseClient();

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  if (!jobNumber || typeof jobNumber !== "string") {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    const { data: jobRow, error: jobError } = await supabase
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
        completion_status,
        created_at,
        updated_at,
        customer_record:customer_id(
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone,
          address,
          postcode,
          contact_preference
        ),
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
        appointments(
          appointment_id,
          scheduled_time,
          status,
          notes,
          created_at,
          updated_at
        ),
        vhc_checks(
          vhc_id,
          section,
          issue_title,
          issue_description,
          measurement,
          traffic_light,
          created_at,
          updated_at
        ),
        job_requests(
          request_id,
          description,
          hours,
          job_type,
          sort_order,
          created_at,
          updated_at
        ),
        job_cosmetic_damage(
          has_damage,
          notes,
          updated_at
        ),
        job_notes(
          note_id,
          job_id,
          user_id,
          note_text,
          created_at,
          updated_at,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            role
          )
        ),
        job_writeups(
          writeup_id,
          completion_status,
          work_performed,
          recommendations,
          labour_time,
          warranty_claim,
          created_at,
          updated_at
        ),
        parts_requests(
          request_id,
          job_id,
          part_id,
          quantity,
          status,
          description,
          requested_by,
          approved_by,
          created_at,
          updated_at,
          part:part_id(
            id,
            part_number,
            name,
            description,
            unit_cost,
            unit_price,
            qty_in_stock,
            qty_reserved,
            qty_on_order,
            storage_location
          ),
          requester:requested_by(
            user_id,
            first_name,
            last_name
          ),
          approver:approved_by(
            user_id,
            first_name,
            last_name
          )
        ),
        parts_job_items(
          id,
          part_id,
          quantity_requested,
          quantity_allocated,
          quantity_fitted,
          status,
          origin,
          pre_pick_location,
          storage_location,
          unit_cost,
          unit_price,
          request_notes,
          allocated_by,
          picked_by,
          fitted_by,
          created_at,
          updated_at,
          part:part_id(
            id,
            part_number,
            name,
            description,
            unit_cost,
            unit_price,
            qty_in_stock,
            qty_reserved,
            qty_on_order,
            storage_location
          )
        )
      `)
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) {
      console.error("❌ Error fetching job card:", jobError);
      return res.status(500).json({ message: "Failed to query job card", error: jobError.message });
    }

    if (!jobRow) {
      return res.status(404).json({ message: `Job card ${jobNumber} not found` });
    }

    const jobId = jobRow.id;

    const [clockingResponse, warrantyResponse, vehicleHistoryResponse] = await Promise.all([
      supabase
        .from("job_clocking")
        .select(
          `
          id,
          user_id,
          job_id,
          job_number,
          clock_in,
          clock_out,
          work_type,
          created_at,
          updated_at,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            role
          )
        `
        )
        .eq("job_id", jobId)
        .order("clock_in", { ascending: false }),
      jobRow.vehicle_id
        ? supabase
            .from("jobs")
            .select(
              `
              id,
              job_number,
              status,
              job_source,
              created_at,
              vehicle_id,
              vehicle_reg,
              vehicle_make_model
            `
            )
            .eq("vehicle_id", jobRow.vehicle_id)
            .eq("job_source", "Warranty")
            .neq("job_number", jobNumber)
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
      jobRow.vehicle_id
        ? supabase
            .from("jobs")
            .select(
              `
              id,
              job_number,
              vehicle_reg,
              mileage_at_service,
              requests,
              created_at,
              job_requests(
                request_id,
                description,
                hours,
                job_type,
                sort_order
              ),
              job_files(
                file_id,
                file_name,
                file_url,
                file_type,
                folder,
                created_at
              ),
              appointments(
                appointment_id,
                scheduled_time
              )
            `
            )
            .eq("vehicle_id", jobRow.vehicle_id)
            .neq("id", jobId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] })
    ]);

    if (clockingResponse?.error) {
      console.error("❌ job_clocking lookup failed:", clockingResponse.error);
    }
    if (warrantyResponse?.error) {
      console.error("❌ Warranty lookup failed:", warrantyResponse.error);
    }
    if (vehicleHistoryResponse?.error) {
      console.error("❌ Vehicle history lookup failed:", vehicleHistoryResponse.error);
    }

    const clockingStatus = mapClockingStatus(clockingResponse?.data || []);
    const warrantyJob = mapWarrantyJob(warrantyResponse?.data || []);
    const vehicleJobHistory = mapServiceHistoryJobs(vehicleHistoryResponse?.data || []);

    const jobData = buildJobDataFromRow(jobRow, { clockingStatus, warrantyJob });
    const sharedNote = jobData?.notes?.[0] || null;

    return res.status(200).json({
      job: jobData,
      sharedNote,
      vehicleJobHistory
    });
  } catch (error) {
    console.error("❌ Unexpected error fetching job card:", error);
    return res.status(500).json({ message: "Unexpected error fetching job card" });
  }
}
