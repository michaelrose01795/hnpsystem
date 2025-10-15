export default function handler(req, res) {
  const { jobNumber } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!global.jobCards) {
    return res.status(404).json({ message: "No job cards found" });
  }

  const jobCard = global.jobCards.find(
    j => j.jobNumber === parseInt(jobNumber)
  );

  if (!jobCard) {
    return res.status(404).json({ message: `Job Card ${jobNumber} not found` });
  }

  // Get linked customer details
  const customer = global.customers?.find(
    c => c.customerId === jobCard.customerId
  );

  // Get linked vehicle details
  const vehicle = global.vehicles?.find(
    v => v.reg === jobCard.vehicleReg
  );

  return res.status(200).json({
    jobCard,
    customer,
    vehicle,
    // Include history
    customerJobHistory: customer?.jobHistory || [],
    vehicleJobHistory: vehicle?.jobHistory || [],
  });
}