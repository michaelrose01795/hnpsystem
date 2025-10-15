export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { status, source, category } = req.query;

  let jobCards = global.jobCards || [];

  // Apply filters if provided
  if (status) {
    jobCards = jobCards.filter(j => j.status === status);
  }
  if (source) {
    jobCards = jobCards.filter(j => j.jobSource === source);
  }
  if (category) {
    jobCards = jobCards.filter(j => j.jobCategories.includes(category));
  }

  return res.status(200).json({
    total: jobCards.length,
    jobCards,
  });
}