// ✅ File location: src/pages/api/vehicles/manufacturing.js
import { getVehicleByReg, createOrUpdateVehicle } from "@/lib/database/vehicles";

/**
 * API endpoint to fetch vehicle manufacturing data from DVLA
 * GET /api/vehicles/manufacturing?reg=AB12CDE
 * 
 * This endpoint:
 * 1. Checks local database first
 * 2. If not found or incomplete, queries DVLA API
 * 3. Saves/updates vehicle data in database
 * 4. Returns manufacturing details
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
    console.log('🔍 Fetching manufacturing data for:', reg);

    // ✅ First check if we have the vehicle in our database
    let vehicle = await getVehicleByReg(reg.toUpperCase());

    // If vehicle exists and has complete data, return it
    if (vehicle && vehicle.make && vehicle.model && vehicle.year) {
      console.log('✅ Vehicle found in local database');

      return res.status(200).json({
        source: 'database',
        makeModel: `${vehicle.make} ${vehicle.model}`,
        colour: vehicle.colour,
        yearOfManufacture: vehicle.year,
        engineCapacity: null, // TODO: Add to vehicle table if needed
        fuelType: vehicle.fuel_type,
        motExpiryDate: vehicle.mot_due,
        taxStatus: null, // Available via DVLA API
        co2Emissions: null, // Available via DVLA API
        vin: vehicle.vin,
        transmission: vehicle.transmission,
        bodyStyle: vehicle.body_style
      });
    }

    // ✅ If not in database or incomplete, try DVLA API
    console.log('📡 Querying DVLA API...');

    // Check if DVLA API key is configured
    const dvlaApiKey = process.env.DVLA_API_KEY;
    
    if (!dvlaApiKey) {
      console.log('⚠️ DVLA API key not configured');
      return res.status(501).json({ 
        message: 'DVLA integration not configured. Please add DVLA_API_KEY to environment variables.',
        documentation: 'https://developer-portal.driver-vehicle-licensing.api.gov.uk/'
      });
    }

    // ✅ Call DVLA API
    const dvlaResponse = await fetch(
      'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': dvlaApiKey,
        },
        body: JSON.stringify({ 
          registrationNumber: reg.toUpperCase() 
        }),
      }
    );

    if (!dvlaResponse.ok) {
      const errorText = await dvlaResponse.text();
      console.error('❌ DVLA API error:', dvlaResponse.status, errorText);
      
      if (dvlaResponse.status === 404) {
        return res.status(404).json({ 
          message: 'Vehicle not found in DVLA database' 
        });
      }
      
      throw new Error(`DVLA API error: ${dvlaResponse.status}`);
    }

    const dvlaData = await dvlaResponse.json();
    console.log('✅ DVLA data received:', dvlaData);

    // ✅ Save/update vehicle in our database
    await createOrUpdateVehicle({
      reg_number: reg.toUpperCase(),
      make: dvlaData.make || vehicle?.make,
      model: dvlaData.model || vehicle?.model,
      year: dvlaData.yearOfManufacture || vehicle?.year,
      colour: dvlaData.colour || vehicle?.colour,
      fuel_type: dvlaData.fuelType || vehicle?.fuel_type,
      // Map DVLA fields to your database structure
      mot_due: dvlaData.motExpiryDate || vehicle?.mot_due,
      // Note: DVLA doesn't provide VIN, engine number, etc.
    });

    console.log('✅ Vehicle data saved to database');

    // Return DVLA data
    return res.status(200).json({
      source: 'dvla',
      makeModel: `${dvlaData.make} ${dvlaData.model}`,
      colour: dvlaData.colour,
      yearOfManufacture: dvlaData.yearOfManufacture,
      engineCapacity: dvlaData.engineCapacity,
      fuelType: dvlaData.fuelType,
      motExpiryDate: dvlaData.motExpiryDate,
      taxStatus: dvlaData.taxStatus,
      taxDueDate: dvlaData.taxDueDate,
      co2Emissions: dvlaData.co2Emissions,
      markedForExport: dvlaData.markedForExport || false,
      wheelplan: dvlaData.wheelplan,
      monthOfFirstRegistration: dvlaData.monthOfFirstRegistration
    });

  } catch (error) {
    console.error('❌ Manufacturing data error:', error);
    
    // If DVLA fails but we have local data, return that
    if (vehicle) {
      console.log('⚠️ Returning local data due to DVLA error');
      return res.status(200).json({
        source: 'database_fallback',
        warning: 'DVLA data unavailable, returning local database records',
        makeModel: vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : null,
        colour: vehicle.colour,
        yearOfManufacture: vehicle.year,
        fuelType: vehicle.fuel_type,
        motExpiryDate: vehicle.mot_due
      });
    }

    return res.status(500).json({ 
      message: 'Error fetching manufacturing data',
      error: error.message 
    });
  }
}