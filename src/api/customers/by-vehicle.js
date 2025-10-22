// ✅ File location: src/pages/api/customers/by-vehicle.js
import { getVehicleByReg } from "@/lib/database/vehicles";

/**
 * API endpoint to find customer associated with a vehicle registration
 * GET /api/customers/by-vehicle?reg=AB12CDE
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
    console.log('🔍 Looking up customer by vehicle registration:', reg);

    // ✅ Query database for vehicle and linked customer
    const vehicle = await getVehicleByReg(reg);

    if (!vehicle) {
      console.log('⚠️ Vehicle not found:', reg);
      return res.status(404).json({ 
        message: 'Vehicle not found in database',
        found: false 
      });
    }

    if (!vehicle.customer) {
      console.log('⚠️ No customer linked to vehicle:', reg);
      return res.status(404).json({ 
        message: 'No customer found for this vehicle',
        found: false,
        vehicle: {
          reg: vehicle.reg_number,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year
        }
      });
    }

    console.log('✅ Customer found:', vehicle.customer.firstname, vehicle.customer.lastname);

    // Return customer details in the format your frontend expects
    return res.status(200).json({
      found: true,
      firstName: vehicle.customer.firstname,
      lastName: vehicle.customer.lastname,
      address: vehicle.customer.address,
      postcode: vehicle.customer.postcode,
      email: vehicle.customer.email,
      mobile: vehicle.customer.mobile,
      telephone: vehicle.customer.telephone,
      customerId: vehicle.customer.id,
      // Also include vehicle details for reference
      vehicle: {
        reg: vehicle.reg_number,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        colour: vehicle.colour,
        vin: vehicle.vin,
        mileage: vehicle.mileage
      }
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    return res.status(500).json({ 
      message: 'Server error while looking up customer',
      error: error.message 
    });
  }
}