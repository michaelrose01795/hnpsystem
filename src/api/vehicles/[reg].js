// ✅ File location: src/pages/api/vehicles/[reg].js
import { getVehicleByReg, createOrUpdateVehicle } from "@/lib/database/vehicles";
import { getAllJobs } from "@/lib/database/jobs";
import { getCustomerById } from "@/lib/database/customers";

/**
 * API endpoint for specific vehicle operations
 * GET /api/vehicles/[reg] - Get vehicle with owner and job history
 * PUT /api/vehicles/[reg] - Update vehicle details
 */
export default async function handler(req, res) {
  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ message: 'Registration number required' });
  }

  try {
    // GET - Fetch vehicle with owner and jobs
    if (req.method === 'GET') {
      console.log('🔍 Fetching vehicle:', reg);

      // ✅ Get vehicle from database
      const vehicle = await getVehicleByReg(reg.toUpperCase());

      if (!vehicle) {
        console.log('⚠️ Vehicle not found:', reg);
        return res.status(404).json({ 
          message: `Vehicle ${reg} not found` 
        });
      }

      // ✅ Get all jobs for this vehicle
      const allJobs = await getAllJobs();
      const vehicleJobs = allJobs.filter(job => 
        job.reg?.toUpperCase() === reg.toUpperCase()
      );

      // ✅ Get owner (customer) details
      let owner = null;
      if (vehicle.customer) {
        owner = {
          customerId: vehicle.customer.id,
          firstName: vehicle.customer.firstname,
          lastName: vehicle.customer.lastname,
          fullName: `${vehicle.customer.firstname} ${vehicle.customer.lastname}`,
          email: vehicle.customer.email,
          mobile: vehicle.customer.mobile,
          telephone: vehicle.customer.telephone,
          address: vehicle.customer.address,
          postcode: vehicle.customer.postcode
        };
      }

      console.log('✅ Vehicle found with', vehicleJobs.length, 'jobs');

      return res.status(200).json({
        vehicle: {
          reg: vehicle.reg_number,
          vehicleId: vehicle.vehicle_id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          colour: vehicle.colour,
          vin: vehicle.vin,
          engineNumber: vehicle.engine_number,
          mileage: vehicle.mileage,
          fuelType: vehicle.fuel_type,
          transmission: vehicle.transmission,
          bodyStyle: vehicle.body_style,
          motDue: vehicle.mot_due,
          ownerId: vehicle.customer?.id || null
        },
        owner,
        totalJobs: vehicleJobs.length,
        jobs: vehicleJobs.map(job => ({
          jobNumber: job.jobNumber,
          type: job.type,
          status: job.status,
          description: job.description,
          date: job.appointment?.date || null,
          technician: job.technician || null
        }))
      });
    }

    // PUT - Update vehicle
    if (req.method === 'PUT') {
      console.log('🔄 Updating vehicle:', reg);

      const result = await createOrUpdateVehicle({
        reg_number: reg.toUpperCase(),
        ...req.body
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: 'Failed to update vehicle',
          error: result.error.message 
        });
      }

      console.log('✅ Vehicle updated successfully');

      return res.status(200).json({ 
        message: 'Vehicle updated successfully',
        vehicle: result.data 
      });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Vehicle API error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
}