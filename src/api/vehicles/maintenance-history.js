// ✅ File location: src/pages/api/vehicles/maintenance-history.js
import { getVehicleByReg, getVehicleMaintenanceHistory } from "@/lib/database/vehicles";

/**
 * API endpoint to fetch maintenance history and service data for a vehicle
 * GET /api/vehicles/maintenance-history?reg=AB12CDE
 * 
 * Returns:
 * - Service history (past jobs)
 * - Upcoming service dates
 * - MOT information
 * - Warranty details
 * - Service plan information
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ message: 'Registration required' });
  }

  try {
    console.log('🔍 Fetching maintenance history for:', reg);

    // ✅ Get vehicle from database
    const vehicle = await getVehicleByReg(reg.toUpperCase());

    if (!vehicle) {
      console.log('⚠️ Vehicle not found:', reg);
      return res.status(404).json({ 
        message: 'Maintenance history not found - vehicle does not exist' 
      });
    }

    // ✅ Get all maintenance/service jobs for this vehicle
    const history = await getVehicleMaintenanceHistory(vehicle.vehicle_id);

    // Calculate next service date (example logic - adjust based on your needs)
    const lastService = history.find(job => 
      job.type?.toLowerCase().includes('service')
    );
    
    let nextServiceDate = null;
    if (lastService && lastService.appointments?.[0]?.scheduled_time) {
      const lastServiceDate = new Date(lastService.appointments[0].scheduled_time);
      // Assume service every 12 months or 12,000 miles
      nextServiceDate = new Date(lastServiceDate);
      nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1);
    }

    console.log('✅ Found', history.length, 'maintenance records');

    return res.status(200).json({
      vehicle: {
        reg: vehicle.reg_number,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year
      },
      // Maintenance schedule information
      nextServiceDate: nextServiceDate ? nextServiceDate.toISOString().split('T')[0] : null,
      nextMotDate: vehicle.mot_due || null,
      leaseCO: null, // TODO: Add to vehicle table if needed
      privileges: null, // TODO: Add customer/vehicle privileges if needed
      nextVHC: null, // TODO: Calculate based on last VHC
      warrantyExpiry: null, // TODO: Add to vehicle table
      servicePlanSupplier: null, // TODO: Add to vehicle table
      servicePlanType: null, // TODO: Add to vehicle table
      servicePlanExpiry: null, // TODO: Add to vehicle table
      
      // Service history
      totalServices: history.length,
      serviceHistory: history.map(job => ({
        jobNumber: job.job_number,
        type: job.type,
        status: job.status,
        description: job.description,
        date: job.appointments?.[0]?.scheduled_time || job.created_at,
        workPerformed: job.job_writeups?.[0]?.work_performed || '',
        partsUsed: job.job_writeups?.[0]?.parts_used || '',
        recommendations: job.job_writeups?.[0]?.recommendations || '',
        mileageAtService: null // TODO: Add mileage tracking to jobs
      }))
    });

  } catch (error) {
    console.error('❌ Maintenance history error:', error);
    return res.status(500).json({ 
      message: 'Server error while fetching maintenance history',
      error: error.message 
    });
  }
}