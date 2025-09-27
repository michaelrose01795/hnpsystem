// file location: src/pages/api/jobcards/create.js
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ 
      message: `Method ${req.method} not allowed`,
      code: "METHOD_NOT_ALLOWED"
    });
  }

  try {
    const jobCard = req.body;

    // ✅ Validate required fields
    if (!jobCard.jobNumber || !jobCard.registration || !jobCard.customer || !jobCard.requests) {
      return res.status(400).json({ 
        message: "Missing required fields: jobNumber, registration, customer, or requests",
        code: "MISSING_FIELDS"
      });
    }

    // Initialize jobCards array in memory if it doesn't exist
    if (!global.jobCards) global.jobCards = [];

    // ✅ Check for duplicate jobNumber
    const duplicate = global.jobCards.find(j => j.jobNumber === jobCard.jobNumber);
    if (duplicate) {
      return res.status(409).json({ 
        message: `Job Card ${jobCard.jobNumber} already exists`,
        code: "DUPLICATE_JOB"
      });
    }

    // Store the job card
    global.jobCards.push(jobCard);

    // ✅ Respond with success
    return res.status(200).json({
      message: `Job Card ${jobCard.jobNumber} created successfully!`,
      code: "SUCCESS",
      jobCard,
    });

  } catch (error) {
    console.error("Error creating job card:", error);
    return res.status(500).json({ 
      message: "Failed to create job card",
      code: "SERVER_ERROR",
      error: error.message
    });
  }
}
