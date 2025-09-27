// file location: src/pages/api/jobcards/create.js
// API route to create job cards with role-based access control

import { getSession } from "next-auth/react"; // to get logged-in user session

// In-memory storage for mock job cards
let jobCards = []; 
let nextJobNumber = 30000; // start job numbers from 30000

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get user session
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { role, name } = session.user; // role + name from login
  const allowedRoles = ["Service", "Admin"];
  const isManager = role && role.toLowerCase().includes("manager");

  // Check permission
  if (!allowedRoles.includes(role) && !isManager) {
    return res.status(403).json({ error: "You do not have permission to create job cards" });
  }

  // At this point, user is allowed
  const { carDetails, description } = req.body;

  if (!carDetails) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Auto-generate job number
    const jobNumber = nextJobNumber;
    nextJobNumber += 1; // increment for next job

    // Create new job card object
    const newJobCard = {
      jobNumber,
      carDetails,
      description: description || "",
      createdBy: name,
      createdAt: new Date().toISOString(),
    };

    // Save to in-memory storage
    jobCards.push(newJobCard);

    // Respond with created job card
    return res.status(201).json({ message: "Job card created successfully", jobCard: newJobCard });
  } catch (error) {
    console.error("Error creating job card:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
