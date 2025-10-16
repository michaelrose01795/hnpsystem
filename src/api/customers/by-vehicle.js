// file location: src/pages/api/customers/by-vehicle.js

// API endpoint to find customer associated with a vehicle registration
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
    // Example: 
    // const vehicle = await db.vehicles.findOne({ registration: reg.toUpperCase() });
    // if (vehicle && vehicle.customerId) {
    //   const customer = await db.customers.findById(vehicle.customerId);
    //   return res.status(200).json({
    //     firstName: customer.firstName,
    //     lastName: customer.lastName,
    //     address: customer.address,
    //     email: customer.email,
    //     mobile: customer.mobile,
    //     telephone: customer.telephone,
    //   });
    // }

    // Simulating "not found" for now
    return res.status(404).json({ message: 'No customer found for this vehicle' });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ message: 'Server error' }); // Handle server errors
  }
}