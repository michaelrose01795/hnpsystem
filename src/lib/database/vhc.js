// file location: src/lib/database/vhc.js
import { supabase } from "../supabaseClient";

/* ============================================
   GET VHC CHECKS BY JOB
   ✅ Enhanced with full field support
============================================ */
export const getVHCChecksByJob = async (jobId) => {
  console.log("🔍 getVHCChecksByJob for job:", jobId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("vhc_checks")
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        updated_at
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    console.log("✅ VHC checks found:", data?.length || 0); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ getVHCChecksByJob error:", error);
    return [];
  }
};

/* ============================================
   GET ALL VHC CHECKS
   ✅ NEW: Get all VHC checks with pagination
============================================ */
export const getAllVHCChecks = async (limit = 100, offset = 0) => {
  console.log("🔍 getAllVHCChecks - limit:", limit, "offset:", offset); // debug log
  
  try {
    const { data, error, count } = await supabase
      .from("vhc_checks")
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        updated_at,
        job:job_id(
          job_number,
          vehicle_reg,
          customer_id
        )
      `, { count: 'exact' })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    console.log("✅ All VHC checks fetched:", data?.length || 0, "Total:", count); // debug log
    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    console.error("❌ getAllVHCChecks error:", error);
    return { success: false, data: [], count: 0, error: { message: error.message } };
  }
};

/* ============================================
   CREATE VHC CHECK
   ✅ Enhanced with validation
============================================ */
export const createVHCCheck = async (vhcData) => {
  console.log("➕ createVHCCheck called with:", vhcData); // debug log
  
  try {
    // ✅ Validate required fields
    if (!vhcData.job_id) {
      throw new Error("Job ID is required");
    }
    if (!vhcData.section) {
      throw new Error("Section is required");
    }
    if (!vhcData.issue_title) {
      throw new Error("Issue title is required");
    }

    const checkToInsert = {
      job_id: vhcData.job_id,
      section: vhcData.section,
      issue_title: vhcData.issue_title,
      issue_description: vhcData.issue_description || null,
      measurement: vhcData.measurement || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("vhc_checks")
      .insert([checkToInsert])
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        updated_at
      `)
      .single();

    if (error) throw error;

    console.log("✅ VHC check created:", data); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ createVHCCheck error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   UPDATE VHC CHECK
   ✅ Enhanced with updated_at tracking
============================================ */
export const updateVHCCheck = async (vhcId, vhcData) => {
  console.log("🔄 updateVHCCheck:", vhcId, vhcData); // debug log
  
  try {
    const updateData = {
      ...vhcData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("vhc_checks")
      .update(updateData)
      .eq("vhc_id", vhcId)
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        updated_at
      `)
      .single();

    if (error) throw error;

    console.log("✅ VHC check updated:", data); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ updateVHCCheck error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   DELETE VHC CHECK
   ✅ Enhanced with safety check
============================================ */
export const deleteVHCCheck = async (vhcId) => {
  console.log("🗑️ deleteVHCCheck:", vhcId); // debug log
  
  try {
    const { error } = await supabase
      .from("vhc_checks")
      .delete()
      .eq("vhc_id", vhcId);

    if (error) throw error;

    console.log("✅ VHC check deleted successfully"); // debug log
    return { success: true };
  } catch (error) {
    console.error("❌ deleteVHCCheck error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET VHC SUMMARY FOR JOB
   ✅ Enhanced - Groups checks by section
============================================ */
export const getVHCSummaryByJob = async (jobId) => {
  console.log("🔍 getVHCSummaryByJob for job:", jobId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("vhc_checks")
      .select(`
        vhc_id,
        section,
        issue_title,
        issue_description,
        measurement
      `)
      .eq("job_id", jobId)
      .order("section");

    if (error) throw error;

    // ✅ Group by section
    const summary = {};
    (data || []).forEach(check => {
      if (!summary[check.section]) {
        summary[check.section] = {
          section: check.section,
          checks: [],
          totalIssues: 0
        };
      }
      summary[check.section].checks.push(check);
      summary[check.section].totalIssues++;
    });

    console.log("✅ VHC summary created for", Object.keys(summary).length, "sections"); // debug log
    return summary;
  } catch (error) {
    console.error("❌ getVHCSummaryByJob error:", error);
    return {};
  }
};

/* ============================================
   GET VHC CHECKS BY SECTION
   ✅ NEW: Get all checks for a specific section
============================================ */
export const getVHCChecksBySection = async (jobId, section) => {
  console.log("🔍 getVHCChecksBySection - job:", jobId, "section:", section); // debug log
  
  try {
    const { data, error } = await supabase
      .from("vhc_checks")
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        updated_at
      `)
      .eq("job_id", jobId)
      .eq("section", section)
      .order("created_at", { ascending: true });

    if (error) throw error;

    console.log("✅ Section checks found:", data?.length || 0); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ getVHCChecksBySection error:", error);
    return [];
  }
};

/* ============================================
   SEARCH VHC CHECKS
   ✅ NEW: Search checks by issue title or description
============================================ */
export const searchVHCChecks = async (searchTerm, jobId = null) => {
  console.log("🔍 searchVHCChecks:", searchTerm, "jobId:", jobId); // debug log
  
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    let query = supabase
      .from("vhc_checks")
      .select(`
        vhc_id,
        job_id,
        section,
        issue_title,
        issue_description,
        measurement,
        created_at,
        job:job_id(
          job_number,
          vehicle_reg
        )
      `)
      .or(`issue_title.ilike.%${searchTerm}%,issue_description.ilike.%${searchTerm}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log("✅ Search results:", data?.length || 0, "checks"); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ searchVHCChecks error:", error);
    return [];
  }
};

/* ============================================
   BULK CREATE VHC CHECKS
   ✅ NEW: Create multiple checks at once
============================================ */
export const bulkCreateVHCChecks = async (checks) => {
  console.log("➕ bulkCreateVHCChecks - count:", checks.length); // debug log
  
  try {
    if (!checks || checks.length === 0) {
      throw new Error("No checks provided");
    }

    // ✅ Validate all checks
    const validChecks = checks.filter(check => 
      check.job_id && 
      check.section && 
      check.issue_title
    );

    if (validChecks.length === 0) {
      throw new Error("No valid checks to create");
    }

    // ✅ Add timestamps
    const checksToInsert = validChecks.map(check => ({
      job_id: check.job_id,
      section: check.section,
      issue_title: check.issue_title,
      issue_description: check.issue_description || null,
      measurement: check.measurement || null,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("vhc_checks")
      .insert(checksToInsert)
      .select();

    if (error) throw error;

    console.log("✅ Bulk VHC checks created:", data?.length || 0); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ bulkCreateVHCChecks error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   DELETE ALL VHC CHECKS FOR JOB
   ✅ NEW: Remove all checks for a job
============================================ */
export const deleteAllVHCChecksForJob = async (jobId) => {
  console.log("🗑️ deleteAllVHCChecksForJob:", jobId); // debug log
  
  try {
    const { error } = await supabase
      .from("vhc_checks")
      .delete()
      .eq("job_id", jobId);

    if (error) throw error;

    console.log("✅ All VHC checks deleted for job"); // debug log
    return { success: true };
  } catch (error) {
    console.error("❌ deleteAllVHCChecksForJob error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET VHC STATISTICS
   ✅ NEW: Get statistics about VHC checks
============================================ */
export const getVHCStatistics = async (jobId = null) => {
  console.log("📊 getVHCStatistics - jobId:", jobId); // debug log
  
  try {
    let query = supabase
      .from("vhc_checks")
      .select("section, issue_title");

    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // ✅ Calculate statistics
    const stats = {
      totalChecks: data?.length || 0,
      bySection: {},
      sections: []
    };

    (data || []).forEach(check => {
      if (!stats.bySection[check.section]) {
        stats.bySection[check.section] = 0;
        stats.sections.push(check.section);
      }
      stats.bySection[check.section]++;
    });

    console.log("✅ VHC statistics calculated:", stats); // debug log
    return stats;
  } catch (error) {
    console.error("❌ getVHCStatistics error:", error);
    return {
      totalChecks: 0,
      bySection: {},
      sections: []
    };
  }
};