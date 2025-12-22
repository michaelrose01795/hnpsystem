// file location: src/pages/api/jobcards/[jobNumber]/index.js
import {
  getAllJobs,
  getJobByNumber,
  getJobByNumberOrReg,
  updateJob,
} from "@/lib/database/jobs";
import { getNotesByJob } from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";
import { getVehicleMaintenanceHistory } from "@/lib/database/vehicles";
import { mapCustomerJobsToHistory } from "@/lib/jobcards/utils";

const normaliseJobNumber = (value) => {
  if (!value) {
    return "";
  }
  return String(value).trim().toUpperCase();
};

const buildLegacyJobCard = (jobCard, notes = []) => {
  if (!jobCard) {
    return null;
  }
  return {
    id: jobCard.id,
    jobNumber: jobCard.job_number || jobCard.jobNumber,
    description: jobCard.description,
    type: jobCard.type,
    status: jobCard.status,
    vehicleReg:
      jobCard.vehicle_reg ||
      jobCard.reg ||
      jobCard.vehicle?.reg_number ||
      jobCard.vehicle?.registration ||
      null,
    customerId:
      jobCard.customer_id ||
      jobCard.customerId ||
      jobCard.vehicle?.customer?.id ||
      null,
    appointment:
      Array.isArray(jobCard.appointments) && jobCard.appointments.length > 0
        ? jobCard.appointments[0]
        : null,
    vhcChecks: jobCard.vhc_checks || jobCard.vhcChecks || [],
    partsRequests: jobCard.parts_requests || jobCard.partsRequests || [],
    notes: notes,
    writeUp:
      jobCard.job_writeups?.[0] ||
      jobCard.writeUp ||
      jobCard.job_writeup ||
      null,
  };
};

const buildLegacyCustomer = (jobCard, customerJobHistory = []) => {
  const customer = jobCard?.vehicle?.customer;
  if (!customer) {
    return null;
  }
  return {
    customerId: customer.id,
    firstname: customer.firstname || customer.first_name,
    lastname: customer.lastname || customer.last_name,
    email: customer.email,
    mobile: customer.mobile,
    telephone: customer.telephone,
    address: customer.address,
    postcode: customer.postcode,
    jobHistory: customerJobHistory.map((job) => ({
      jobNumber: normaliseJobNumber(job.jobNumber || job.job_number),
      type: job.type,
      status: job.status,
      date: job.date || job.appointment?.date || job.created_at || null,
    })),
  };
};

const buildLegacyVehicle = (jobCard, vehicleHistory = []) => {
  const vehicle = jobCard?.vehicle;
  if (!vehicle) {
    return null;
  }
  return {
    reg: vehicle.registration || vehicle.reg || vehicle.reg_number,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    colour: vehicle.colour,
    vin: vehicle.vin,
    mileage: vehicle.mileage,
    fuelType: vehicle.fuel_type,
    transmission: vehicle.transmission,
    motDue: vehicle.mot_due,
    jobHistory: vehicleHistory.map((entry) => ({
      jobNumber: normaliseJobNumber(entry.job_number || entry.jobNumber),
      type: entry.type,
      status: entry.status,
      date:
        entry.date ||
        entry.appointments?.[0]?.scheduled_time ||
        entry.created_at ||
        null,
    })),
  };
};

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (!jobNumber || typeof jobNumber !== "string") {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    if (req.method === "GET") {
      const [jobCard, structuredResult] = await Promise.all([
        getJobByNumberOrReg(jobNumber),
        getJobByNumber(jobNumber),
      ]);

      const structuredData = structuredResult?.data || null;

      if (!jobCard && !structuredData?.jobCard) {
        return res
          .status(404)
          .json({ message: `Job card ${jobNumber} not found` });
      }

      const baseJobCard = jobCard || structuredData?.jobCard || null;

      if (!baseJobCard) {
        return res
          .status(404)
          .json({ message: `Job card ${jobNumber} not found` });
      }

      const notes = baseJobCard.id ? await getNotesByJob(baseJobCard.id) : [];
      const sharedNote = notes[0] || null;

      const customerId =
        baseJobCard.customer_id ||
        baseJobCard.customerId ||
        baseJobCard.vehicle?.customer?.id ||
        null;

      const customerJobs = customerId
        ? await getCustomerJobs(customerId)
        : [];
      const vehicleJobHistory = customerJobs.length
        ? mapCustomerJobsToHistory(
            customerJobs,
            baseJobCard.reg ||
              baseJobCard.vehicle_reg ||
              baseJobCard.vehicle?.reg_number ||
              baseJobCard.vehicle?.registration ||
              ""
          )
        : [];

      const vehicleId =
        baseJobCard.vehicle_id || baseJobCard.vehicle?.vehicle_id || null;
      const vehicleMaintenanceHistory = vehicleId
        ? await getVehicleMaintenanceHistory(vehicleId)
        : [];

      const legacyJobCard = buildLegacyJobCard(baseJobCard, notes);
      const legacyCustomer = buildLegacyCustomer(baseJobCard, customerJobs);
      const legacyVehicle = buildLegacyVehicle(
        baseJobCard,
        vehicleMaintenanceHistory
      );

      return res.status(200).json({
        job: baseJobCard,
        structured: structuredData,
        sharedNote,
        vehicleJobHistory,
        legacy: {
          jobCard: legacyJobCard,
          customer: legacyCustomer,
          vehicle: legacyVehicle,
          customerJobHistoryCount: customerJobs.length,
          vehicleJobHistoryCount: vehicleMaintenanceHistory.length,
        },
      });
    }

    if (req.method === "PUT") {
      const updates =
        req.body && typeof req.body === "object" ? { ...req.body } : null;

      if (!updates || Object.keys(updates).length === 0) {
        return res
          .status(400)
          .json({ message: "Update payload is required" });
      }

      const jobCard = await getJobByNumberOrReg(jobNumber);
      if (!jobCard) {
        return res
          .status(404)
          .json({ message: `Job card ${jobNumber} not found` });
      }

      const result = await updateJob(jobCard.id, updates);

      if (!result?.success) {
        return res.status(400).json({
          message: "Failed to update job",
          error: result?.error?.message || "Unknown error",
        });
      }

      return res.status(200).json({
        message: "Job card updated successfully",
        jobCard: result.data,
      });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error("❌ Job card API error:", error);
    return res
      .status(500)
      .json({ message: "Unexpected error handling job card" });
  }
}
