// API endpoint to create a new VHC check item in the database
import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      jobId,
      jobNumber,
      section,
      issueTitle,
      issueDescription,
      measurement,
      labourHours
    } = req.body;

    // Validate required fields
    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    if (!section || !issueTitle) {
      return res.status(400).json({
        success: false,
        message: "section and issueTitle are required"
      });
    }

    // Build the insert payload
    const insertData = {
      job_id: jobId,
      section: section,
      issue_title: issueTitle,
      issue_description: issueDescription || null,
      measurement: measurement || null,
      labour_hours: labourHours !== undefined && labourHours !== null ? parseFloat(labourHours) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert the vhc_checks record
    const { data, error } = await supabase
      .from("vhc_checks")
      .insert([insertData])
      .select("vhc_id, job_id, section, issue_title, issue_description, measurement, labour_hours, created_at, updated_at")
      .single();

    if (error) {
      console.error("Error creating VHC check item:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create VHC check item",
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      vhcId: data.vhc_id,
      data: data,
      message: "VHC check item created successfully"
    });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}
