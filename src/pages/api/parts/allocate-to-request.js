// file location: src/pages/api/parts/allocate-to-request.js
// API endpoint to allocate a part to a specific job request

import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { partAllocationId, requestId, jobId } = req.body;

    // Validate inputs
    if (!partAllocationId || !requestId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: partAllocationId, requestId, jobId",
      });
    }

    // Update the parts_job_items table to link the part to the request
    const { data, error } = await supabase
      .from("parts_job_items")
      .update({
        allocated_to_request_id: requestId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partAllocationId)
      .eq("job_id", jobId)
      .select();

    if (error) {
      console.error("Failed to allocate part to request:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to allocate part to request",
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Part allocation not found or does not belong to this job",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Part successfully allocated to request",
      data: data[0],
    });
  } catch (error) {
    console.error("Error in allocate-to-request API:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
