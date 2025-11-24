// file location: src/lib/jobcards/utils.js
const normalizeRequests = (rawRequests) => {
  if (Array.isArray(rawRequests)) {
    return rawRequests;
  }

  if (typeof rawRequests === "string") {
    try {
      const parsed = JSON.parse(rawRequests);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("normalizeRequests: failed to parse string payload", error);
      return [];
    }
  }

  if (rawRequests && typeof rawRequests === "object") {
    return [];
  }

  return [];
};

const mapCustomerJobsToHistory = (jobs = [], vehicleReg = "") => {
  const normalizedReg = vehicleReg ? vehicleReg.trim().toUpperCase() : "";

  return (Array.isArray(jobs) ? jobs : [])
    .filter((job) => {
      if (!normalizedReg) return true;
      const jobReg =
        (job.vehicle_reg || job.vehicleReg || "").trim().toUpperCase();
      return jobReg === normalizedReg;
    })
    .map((job) => {
      const requestedAt =
        job.appointments?.[0]?.scheduled_time ||
        job.created_at ||
        job.updated_at ||
        null;

      const serviceDateFormatted = requestedAt
        ? new Date(requestedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })
        : "Unknown";

      return {
        id: job.id,
        jobNumber: job.job_number || job.jobNumber,
        serviceDate: requestedAt,
        serviceDateFormatted,
        mileage: job.mileage_at_service ?? job.mileageAtService ?? null,
        requests: normalizeRequests(job.requests),
        invoiceUrl: "",
        invoiceName: "",
        invoiceAvailable: false
      };
    });
};

export { normalizeRequests, mapCustomerJobsToHistory };

export default {
  normalizeRequests,
  mapCustomerJobsToHistory
};
