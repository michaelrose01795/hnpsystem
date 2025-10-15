export default function handler(req, res) {
  const { customerId } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const customer = global.customers?.find(c => c.customerId === customerId);

  if (!customer) {
    return res.status(404).json({ message: `Customer ${customerId} not found` });
  }

  // Get all jobs for this customer
  const customerJobs = global.jobCards?.filter(
    j => j.customerId === customerId
  ) || [];

  return res.status(200).json({
    customer,
    totalJobs: customerJobs.length,
    jobs: customerJobs,
  });
}