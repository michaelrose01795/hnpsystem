// file location: codex/jobFlowAutomation.js
import { updateJobStatus } from "../src/lib/database/jobs"; // Update helper

// ===============================================
// 🔄 Job Flow Automation
// Automatically updates job status based on activity
// ===============================================

export const autoUpdateJobStatus = async (job) => {
  try {
    // If tech clocks off, move job to waiting for VHC
    if (job.status === "In Progress" && job.clock_off_time) {
      await updateJobStatus(job.id, "Waiting for VHC");
    }

    // If VHC complete and no parts pending
    if (job.vhc_complete && !job.parts_pending) {
      await updateJobStatus(job.id, "Ready for Workshop");
    }

    // If workshop completed and VHC approved
    if (job.status === "Workshop Complete" && job.vhc_approved) {
      await updateJobStatus(job.id, "Ready for Release");
    }
  } catch (err) {
    console.error("❌ Job automation failed:", err);
  }
};
