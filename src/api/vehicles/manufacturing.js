// file location: src/pages/api/vehicles/manufacturing.js

// API endpoint to fetch vehicle manufacturing data from DVLA or similar service
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' }); // Only allow GET requests
  }

  const { reg } = req.query; // Get registration from query parameters

  if (!reg) {
    return res.status(400).json({ message: 'Registration required' }); // Validate registration provided
  }

  try {
    // TODO: Replace with actual DVLA API call
    // UK DVLA API example (requires API key from https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
    // const dvlaApiKey = process.env.DVLA_API_KEY;
    // const response = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-api-key': dvlaApiKey,
    //   },
    //   body: JSON.stringify({ registrationNumber: reg }),
    // });
    //
    // if (response.ok) {
    //   const data = await response.json();
    //   return res.status(200).json({
    //     makeModel: `${data.make} ${data.model}`,
    //     colour: data.colour,
    //     yearOfManufacture: data.yearOfManufacture,
    //     engineCapacity: data.engineCapacity,
    //     fuelType: data.fuelType,
    //     motExpiryDate: data.motExpiryDate,
    //     taxStatus: data.taxStatus,
    //     co2Emissions: data.co2Emissions,
    //   });
    // }

    // For now, simulate "not found" response
    return res.status(404).json({ message: 'Vehicle not found in DVLA database' });

  } catch (error) {
    console.error('DVLA API error:', error);
    return res.status(500).json({ message: 'Error fetching manufacturing data' }); // Handle API errors
  }
}