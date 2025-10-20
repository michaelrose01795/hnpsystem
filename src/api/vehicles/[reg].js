// src/api/vehicles/[reg].js
export default function handler(req, res) {
  const { reg } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const vehicle = global.vehicles?.find(
    v => v.reg === reg.toUpperCase()
  );

  if (!vehicle) {
    return res.status(404).json({ 
      message: `Vehicle ${reg} not found` 
    });
  }

  // Get all jobs for this vehicle
  const vehicleJobs = global.jobCards?.filter(
    j => j.vehicleReg === reg.toUpperCase()
  ) || [];

  // Get the owner (customer)
  const owner = global.customers?.find(
    c => c.customerId === vehicle.ownerId
  );

  return res.status(200).json({
    vehicle,
    owner,
    totalJobs: vehicleJobs.length,
    jobs: vehicleJobs,
  });
}