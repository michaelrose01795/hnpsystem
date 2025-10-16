// file location: src/pages/api/vehicles/maintenance-history.js

// API endpoint to fetch maintenance history for a vehicle from database
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
    // Example: const maintenance = await db.maintenance.findOne({ registration: reg.toUpperCase() });
    
    // Example response structure when maintenance data is found:
    // return res.status(200).json({
    //   nextServiceDate: maintenance.nextServiceDate,
    //   nextMotDate: maintenance.nextMotDate,
    //   leaseCO: maintenance.leaseCO,
    //   privileges: maintenance.privileges,
    //   nextVHC: maintenance.nextVHC,
    //   warrantyExpiry: maintenance.warrantyExpiry,
    //   servicePlanSupplier: maintenance.servicePlanSupplier,
    //   servicePlanType: maintenance.servicePlanType,
    //   servicePlanExpiry: maintenance.servicePlanExpiry,
    // });

    // Simulating "not found" for now
    return res.status(404).json({ message: 'Maintenance history not found' });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ message: 'Server error' }); // Handle server errors
  }
}