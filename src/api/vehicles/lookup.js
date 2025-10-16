// file location: src/pages/api/vehicles/lookup.js

// API endpoint to lookup vehicle by registration in database
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' }); // Only allow GET requests
  }

  const { reg } = req.query; // Get registration from query parameters

  if (!reg) {
    return res.status(400).json({ message: 'Registration required' }); // Validate registration provided
  }

  try {
    // TODO: Replace this with actual database query
    // Example: const vehicle = await db.vehicles.findOne({ registration: reg.toUpperCase() });
    
    // For now, return null to simulate "not found in database"
    // When you connect your database, replace this with actual query
    
    // Example response structure when vehicle is found:
    // return res.status(200).json({
    //   reg: vehicle.registration,
    //   colour: vehicle.colour,
    //   makeModel: vehicle.makeModel,
    //   chassis: vehicle.chassis,
    //   engine: vehicle.engine,
    //   mileage: vehicle.currentMileage,
    // });

    // Simulating "not found" for now
    return res.status(404).json({ message: 'Vehicle not found in database' });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ message: 'Server error' }); // Handle server errors
  }
}