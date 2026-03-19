// file location: src/hooks/useAiEnhancement.js
// Client-side hook for optional AI text enhancement of the Smart Summary.
// Only calls the API when ai_text_enhancement_enabled flag is true.
// Falls back silently on error — code-generated text remains the source of truth.

import { useState, useEffect, useRef } from "react"; // React hooks

export function useAiEnhancement(summary, flags) {
  const [refined, setRefined] = useState(null); // Refined data from AI or null
  const [loading, setLoading] = useState(false); // Loading state
  const [error, setError] = useState(null); // Error state
  const debounceRef = useRef(null); // Debounce timer reference

  useEffect(() => {
    // If AI enhancement is disabled, clear state and return.
    if (!flags?.ai_text_enhancement_enabled) {
      setRefined(null); // Clear any previous refined data
      setLoading(false); // Not loading
      setError(null); // No error
      return;
    }

    // If no summary to enhance, skip.
    if (!summary) {
      setRefined(null); // Nothing to refine
      return;
    }

    // Debounce API calls by 500ms to avoid rapid re-calls.
    if (debounceRef.current) clearTimeout(debounceRef.current); // Clear previous timer
    debounceRef.current = setTimeout(async () => {
      setLoading(true); // Start loading
      setError(null); // Clear previous errors

      try {
        const response = await fetch("/api/ai/enhance-summary", {
          method: "POST", // POST request
          headers: { "Content-Type": "application/json" }, // JSON content type
          body: JSON.stringify({
            summary: summary.summary || "", // Code-generated summary sentence
            jobStory: summary.jobStory || "", // Code-generated job narrative
            nextStep: summary.nextStep || null, // Code-generated next step
            flags, // Feature flags
          }),
        });

        const data = await response.json(); // Parse response

        if (data.refined) {
          setRefined(data); // Store refined data
        } else {
          setRefined(null); // No refinement available
        }
      } catch (err) {
        console.error("AI enhancement failed:", err.message); // Log error silently
        setError(err.message); // Store error for debugging
        setRefined(null); // Fall back to code-generated text
      } finally {
        setLoading(false); // Done loading
      }
    }, 500); // 500ms debounce

    // Cleanup: clear debounce timer on unmount or dependency change.
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [summary, flags?.ai_text_enhancement_enabled]); // Re-run when summary or flag changes

  return { refined, loading, error }; // Return AI enhancement state
}
