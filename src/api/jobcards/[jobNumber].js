// ✅ File location: src/pages/api/jobcards/[jobNumber].js
import { getJobByNumberOrReg, updateJobStatus } from "@/lib/database/jobs";
import { getVehicleMaintenanceHistory } from "@/lib/database/vehicles";
import { getAllJobs } from "@/lib/database/jobs";

/**
 * API endpoint for job card operations
 * GET /api/jobcards/[jobNumber] - Get job details with customer, vehicle, and history
 * PUT /api/jobcards/[jobNumber] - Update job
 */
export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (!jobNumber) {
    return res.status(400).json({ message: 'Job number required' });
  }

  try {
    // GET - Fetch job with all linked data
    if (req.method === 'GET') {
      console.log('🔍 Fetching job card:', jobNumber);

      const jobCard = await getJobByNumberOrReg(jobNumber);

      if (!jobCard) {
        return res.status(404).json({ 
          message: `Job Card ${jobNumber} not found` 
        });
      }

      // Get vehicle maintenance history if vehicle exists
      let vehicleJobHistory = [];
      if (jobCard.vehicle?.vehicle_id) {
        vehicleJobHistory = await getVehicleMaintenanceHistory(jobCard.vehicle.vehicle_id);
      }

      // Get customer job history
      let customerJobHistory = [];
      if (jobCard.vehicle?.customer?.id) {
        const allJobs = await getAllJobs();
        customerJobHistory = allJobs.filter(job => 
          job.vehicle?.customer?.id === jobCard.vehicle.customer.id
        );
      }

      console.log('✅ Job card found with full details');

      return res.status(200).json({
        jobCard: {
          id: jobCard.id,
          jobNumber: jobCard.jobNumber,
          description: jobCard.description,
          type: jobCard.type,
          status: jobCard.status,
          vehicleReg: jobCard.reg,
          customerId: jobCard.vehicle?.customer?.id,
          appointment: jobCard.appointment,
          vhcChecks: jobCard.vhcChecks || [],
          partsRequests: jobCard.partsRequests || [],
          notes: jobCard.notes || [],
          writeUp: jobCard.writeUp
        },
        customer: jobCard.vehicle?.customer ? {
          customerId: jobCard.vehicle.customer.id,
          firstname: jobCard.vehicle.customer.firstname,
          lastname: jobCard.vehicle.customer.lastname,
          email: jobCard.vehicle.customer.email,
          mobile: jobCard.vehicle.customer.mobile,
          telephone: jobCard.vehicle.customer.telephone,
          address: jobCard.vehicle.customer.address,
          postcode: jobCard.vehicle.customer.postcode,
          jobHistory: customerJobHistory.map(j => ({
            jobNumber: j.jobNumber,
            type: j.type,
            status: j.status,
            date: j.appointment?.date
          }))
        } : null,
        vehicle: jobCard.vehicle ? {
          reg: jobCard.vehicle.reg_number,
          make: jobCard.vehicle.make,
          model: jobCard.vehicle.model,
          year: jobCard.vehicle.year,
          colour: jobCard.vehicle.colour,
          vin: jobCard.vehicle.vin,
          mileage: jobCard.vehicle.mileage,
          fuelType: jobCard.vehicle.fuel_type,
          transmission: jobCard.vehicle.transmission,
          motDue: jobCard.vehicle.mot_due,
          jobHistory: vehicleJobHistory.map(j => ({
            jobNumber: j.job_number,
            type: j.type,
            status: j.status,
            date: j.appointments?.[0]?.scheduled_time
          }))
        } : null,
        customerJobHistory: customerJobHistory.length,
        vehicleJobHistory: vehicleJobHistory.length
      });
    }

    // PUT - Update job
    if (req.method === 'PUT') {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status required for update' });
      }

      console.log('🔄 Updating job card status:', jobNumber, 'to', status);

      const job = await getJobByNumberOrReg(jobNumber);
      if (!job) {
        return res.status(404).json({ 
          message: `Job Card ${jobNumber} not found` 
        });
      }

      const result = await updateJobStatus(job.id, status);

      if (!result.success) {
        return res.status(400).json({ 
          message: 'Failed to update job',
          error: result.error.message 
        });
      }

      console.log('✅ Job card updated successfully');

      return res.status(200).json({ 
        message: 'Job card updated successfully',
        jobCard: result.data 
      });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Job card API error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
}