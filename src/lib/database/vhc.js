// ✅ File location: src/lib/database/vhc.js
import { supabase } from "../supabaseClient";

/* ============================================
   GET VHC CHECKS BY JOB
============================================ */
export const getVHCChecksByJob = async (jobId) => {
  const { data, error } = await supabase
    .from("vhc_checks")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  return error ? [] : data;
};

/* ============================================
   CREATE VHC CHECK
============================================ */
export const createVHCCheck = async (vhcData) => {
  const { data, error } = await supabase
    .from("vhc_checks")
    .insert([vhcData])
    .select()
    .single();

  return { success: !error, data, error };
};

/* ============================================
   UPDATE VHC CHECK
============================================ */
export const updateVHCCheck = async (vhcId, vhcData) => {
  const { data, error } = await supabase
    .from("vhc_checks")
    .update(vhcData)
    .eq("vhc_id", vhcId)
    .select()
    .single();

  return { success: !error, data, error };
};

/* ============================================
   DELETE VHC CHECK
============================================ */
export const deleteVHCCheck = async (vhcId) => {
  const { error } = await supabase
    .from("vhc_checks")
    .delete()
    .eq("vhc_id", vhcId);

  return { success: !error, error };
};

/* ============================================
   GET VHC SUMMARY FOR JOB
   Groups checks by section (Brakes, External, etc.)
============================================ */
export const getVHCSummaryByJob = async (jobId) => {
  const { data, error } = await supabase
    .from("vhc_checks")
    .select("section, issue_title, status")
    .eq("job_id", jobId);

  if (error) return {};

  // Group by section
  const summary = {};
  data.forEach(check => {
    if (!summary[check.section]) {
      summary[check.section] = [];
    }
    summary[check.section].push(check);
  });

  return summary;
};