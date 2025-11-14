// ✅ Legacy page removed in favor of unified /appointments calendar // file level comment explaining change
// file location: src/pages/job-cards/appointments.js // explicit file path reference
"use client"; // Ensure client-side execution for router redirect
// Added per instruction to keep comment coverage
import { useRouter } from "next/router"; // Import Next.js router hook for navigation
import { useEffect } from "react"; // Import useEffect to trigger redirect after mount
// Added per instruction to keep comment coverage
export default function LegacyAppointmentsRedirectPage() { // Component that redirects deprecated route to the calendar
  const router = useRouter(); // Access router instance for navigation
// Added per instruction to keep comment coverage
  useEffect(() => { // Run redirect logic once router is ready
    if (!router) return; // Guard during initial render in case router isn't available yet
    router.replace("/appointments"); // Replace legacy /job-cards/appointments path with new /appointments calendar
  }, [router]); // Re-run if router reference changes (rare)
// Added per instruction to keep comment coverage
  return ( // Provide minimal fallback UI while redirect completes
    <div style={{ padding: "32px", fontFamily: "inherit" }}> // Simple container for message
      Redirecting to the live appointments calendar... // User-facing status text
    </div> // Close container div
  ); // Close return statement
} // End LegacyAppointmentsRedirectPage component
