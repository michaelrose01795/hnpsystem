// file location: src/pages/api/jobcards/create.js
export default function handler(req, res) {
  if (req.method === "POST") {
    try {
      // ✅ Receive the job card data from the front-end
      const jobCard = req.body;

      // For now, store in memory (will reset on server restart)
      if (!global.jobCards) {
        global.jobCards = [];
      }
      global.jobCards.push(jobCard);

      return res.status(200).json({
        message: `Job Card ${jobCard.jobNumber} created successfully!`,
        jobCard,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to create job card", error });
    }
  } else {
    // Method not allowed
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
}
