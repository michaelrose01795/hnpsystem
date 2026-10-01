// Read only the job/vehicle/request columns needed for technical information.
import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { normalizeLegacyRequests } from "@/lib/canonical/fields";

export async function loadTechnicalInfoContext(jobNumber) {
  const client = supabaseService || supabase;
  const { data: job, error } = await client.from("jobs")
    .select("id, job_number, vehicle_reg, vehicle_make_model, vehicle_id, requests")
    .eq("job_number", jobNumber).maybeSingle();
  if (error) throw error;
  if (!job) return null;
  const [vehicleResult, requestResult] = await Promise.all([
    job.vehicle_id ? client.from("vehicles").select("vehicle_id, reg_number, registration, make, model, make_model, year, vin, chassis, engine_number, engine, fuel_type, engine_capacity, transmission, body_style, colour, mot_due")
      .eq("vehicle_id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    client.from("job_requests").select("request_id, description, request_source, sort_order, vhc_item_id")
      .eq("job_id", job.id).order("sort_order"),
  ]);
  if (vehicleResult.error || requestResult.error) throw vehicleResult.error || requestResult.error;
  const requests = requestResult.data?.length ? requestResult.data.map((row) => ({
    id: String(row.request_id), description: row.description, source: row.request_source,
  })) : normalizeLegacyRequests(job.requests).map((row, index) => ({
    id: `legacy-${index}`, description: typeof row === "string" ? row : row.description || row.text || "",
    source: "legacy",
  }));
  return { job, vehicle: vehicleResult.data || {}, requests };
}
