// ✅ File location: src/pages/api/vehicles/lookup.js
import { getVehicleByReg } from "@/lib/database/vehicles";

/**
 * API endpoint to lookup vehicle by registration in database
 * GET /api/vehicles/lookup?reg=AB12CDE
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ message: 'Registration number required' });
  }

  try {
    console.log('🔍 Looking up vehicle:', reg);

    // ✅ Query database using centralized function
    const vehicle = await getVehicleByReg(reg);

    if (!vehicle) {
      console.log('⚠️ Vehicle not found:', reg);
      return res.status(404).json({ 
        message: 'Vehicle not found in database',
        found: false 
      });
    }

    console.log('✅ Vehicle found:', vehicle.reg_number);

    // ✅ Return formatted vehicle data
    return res.status(200).json({
      found: true,
      vehicle: {
        vehicleId: vehicle.vehicle_id,
        reg: vehicle.reg_number,
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || '',
        colour: vehicle.colour || '',
        vin: vehicle.vin || '',
        engineNumber: vehicle.engine_number || '',
        mileage: vehicle.mileage || '',
        fuelType: vehicle.fuel_type || '',
        transmission: vehicle.transmission || '',
        bodyStyle: vehicle.body_style || '',
        motDue: vehicle.mot_due || '',
        // Include customer data if exists
        customer: vehicle.customer ? {
          id: vehicle.customer.id,
          name: `${vehicle.customer.firstname || ''} ${vehicle.customer.lastname || ''}`.trim(),
          firstname: vehicle.customer.firstname || '',
          lastname: vehicle.customer.lastname || '',
          email: vehicle.customer.email || '',
          mobile: vehicle.customer.mobile || '',
          telephone: vehicle.customer.telephone || '',
          address: vehicle.customer.address || '',
          postcode: vehicle.customer.postcode || ''
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    return res.status(500).json({ 
      message: 'Server error while fetching vehicle data',
      error: error.message 
    });
  }
}