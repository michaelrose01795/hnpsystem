// file location: src/pages/api/ai/enhance-summary.js
// Optional AI text enhancement endpoint for the Job Progress Tracker.
// Sends code-generated summary data to an external AI endpoint for refined wording.
// Falls back to original data on any failure. Only active when feature flag is enabled.

import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" }); // POST-only endpoint
  }

  const { summary, jobStory, nextStep, flags } = req.body || {}; // Extract request fields

  // Validate feature flag is enabled.
  if (!flags?.ai_text_enhancement_enabled) {
    return res.status(403).json({ refined: false, reason: "feature_disabled" }); // Flag not enabled
  }

  // Read the AI endpoint URL from environment.
  const aiEndpoint = process.env.AI_ENHANCE_ENDPOINT; // External AI service URL
  if (!aiEndpoint) {
    return res.status(200).json({ refined: false, reason: "no_endpoint" }); // No endpoint configured
  }

  try {
    // Build a compact prompt payload for the AI service.
    const payload = {
      instruction: "Refine the following job progress summary text to be more natural, concise, and professional. Return the same structure with refined wording only.", // AI instruction
      summary: summary || "", // Code-generated summary sentence
      jobStory: jobStory || "", // Code-generated job narrative
      nextStep: nextStep || null, // Code-generated next step
    };

    // Send to AI endpoint with a 10-second timeout.
    const controller = new AbortController(); // Abort controller for timeout
    const timeout = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const response = await fetch(aiEndpoint, {
      method: "POST", // POST request to AI service
      headers: { "Content-Type": "application/json" }, // JSON content type
      body: JSON.stringify(payload), // Serialised payload
      signal: controller.signal, // Abort signal
    });

    clearTimeout(timeout); // Clear timeout if fetch completed

    if (!response.ok) {
      console.error("AI enhance endpoint returned non-OK status:", response.status); // Log error
      return res.status(200).json({ refined: false, reason: "endpoint_error" }); // Fallback
    }

    const data = await response.json(); // Parse AI response

    // Validate response shape — must have at least one refined field.
    const hasRefinedData =
      typeof data.refinedSummary === "string" ||
      typeof data.refinedJobStory === "string" ||
      (data.refinedNextStep && typeof data.refinedNextStep.label === "string");

    if (!hasRefinedData) {
      console.error("AI enhance endpoint returned invalid response shape"); // Log validation failure
      return res.status(200).json({ refined: false, reason: "invalid_response" }); // Fallback
    }

    return res.status(200).json({
      refined: true, // AI enhancement succeeded
      refinedSummary: data.refinedSummary || null, // Refined summary sentence
      refinedJobStory: data.refinedJobStory || null, // Refined job narrative
      refinedNextStep: data.refinedNextStep || null, // Refined next step
    });
  } catch (error) {
    const reason = error.name === "AbortError" ? "timeout" : "error"; // Categorise error
    console.error("AI enhance endpoint failed:", reason, error.message); // Log the failure
    return res.status(200).json({ refined: false, reason }); // Fallback to code-generated text
  }
}

export default withRoleGuard(handler);
