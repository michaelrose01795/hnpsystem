// file location: src/pages/job-cards/[jobNumber]/upload-dealer-file.js
import { useState, useMemo } from "react"; // React hooks for managing component state and derived labels
import Head from "next/head"; // Next.js Head for SEO titles
import { useRouter } from "next/router"; // Router hook to read the dynamic job number segment
import Layout from "@/components/Layout"; // Shared layout with navigation and styling
import { useUser } from "@/context/UserContext"; // Access logged-in user details for attribution

export default function UploadDealerFilePage() {
  const router = useRouter(); // Access router query parameters
  const { jobNumber } = router.query; // Extract the dynamic job number from the URL
  const { user } = useUser() || {}; // Retrieve the authenticated user from context if available

  const [selectedFile, setSelectedFile] = useState(null); // Track the file chosen by the technician or manager
  const [statusMessage, setStatusMessage] = useState(""); // Friendly status banner displayed above the form
  const [errorMessage, setErrorMessage] = useState(""); // Error message shown when uploads fail
  const [isUploading, setIsUploading] = useState(false); // Flag to show loading indicator while uploading

  const pageTitle = useMemo(() => {
    if (jobNumber) {
      return `Upload Dealer File | Job ${jobNumber}`; // Customise title for the active job
    }
    return "Upload Dealer File"; // Fallback title while router query is loading
  }, [jobNumber]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null; // Grab the first file from the file input
    setSelectedFile(file); // Persist the selected file so we can upload it later
    setErrorMessage(""); // Clear previous errors when a new file is selected
    if (file) {
      setStatusMessage(`Ready to upload ${file.name}`); // Provide feedback that the file is ready
    } else {
      setStatusMessage(""); // Reset status if no file is selected
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent the browser from performing a page refresh

    if (!jobNumber) {
      setErrorMessage("Job number is missing from the URL."); // Ensure we have the job identifier
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Please choose a file before uploading."); // Enforce a file selection
      return;
    }

    try {
      setIsUploading(true); // Trigger loading state to disable the form
      setErrorMessage(""); // Clear previous errors before starting the upload
      setStatusMessage("Uploading file to dealer records..."); // Provide optimistic feedback to the user

      const formData = new FormData(); // Create a multipart payload to send the file to the API route
      formData.append("file", selectedFile); // Attach the chosen file with the expected field name
      if (user?.id) {
        formData.append("userId", String(user.id)); // Include the user id for audit logging when available
      }

      const response = await fetch(
        `/api/jobcards/${jobNumber}/upload-dealer-file`, // Call the API route implemented in Node runtime
        {
          method: "POST", // Use POST for file uploads
          body: formData, // Pass the multipart form payload directly
        }
      );

      const payload = await response.json(); // Parse the JSON response from the server

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Upload failed"); // Surface server-side errors to the user
      }

      setStatusMessage(
        `✅ File uploaded successfully: ${payload?.file?.originalName || selectedFile.name}` // Show success message with file name
      );
      setSelectedFile(null); // Reset the file input after a successful upload
      if (event.target.reset) {
        event.target.reset(); // Clear the form fields for a fresh upload
      }
    } catch (error) {
      console.error("Upload error", error); // Log the issue for developers
      setErrorMessage(error.message || "Failed to upload file. Please try again."); // Provide actionable error feedback
      setStatusMessage(""); // Clear any stale success message
    } finally {
      setIsUploading(false); // Always release the loading state at the end of the process
    }
  };

  return (
    <Layout>
      <Head>
        <title>{pageTitle}</title> {/* Set dynamic page title for better context */}
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid var(--danger-border)" }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Upload Dealer Documentation {/* Primary heading for the upload workflow */}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Attach signed dealer forms, invoices, or supporting documents directly to the job card.
              </p>
            </div>
            <span
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold"
              style={{ backgroundColor: "var(--danger-surface)", color: "var(--danger-text)" }}
            >
              Job #{jobNumber || "Loading..."} {/* Show the current job number for clarity */}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center transition"
              style={{ borderColor: "var(--danger-border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--danger-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--danger-border)"; }}
            >
              <input
                id="dealer-file"
                name="dealer-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="dealer-file"
                className="cursor-pointer block"
              >
                <div className="flex flex-col items-center space-y-3 text-gray-600">
                  <div
                    className="flex items-center justify-center w-16 h-16 rounded-full"
                    style={{ backgroundColor: "var(--danger-surface)", color: "var(--danger)" }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="w-10 h-10"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16.5v-9m0 0-3 3m3-3 3 3M4.5 19.5h15"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Click to browse or drag and drop</p>
                    <p className="text-sm text-gray-500">
                      Accepted formats: PDF, JPG, PNG, DOC, DOCX (max 10MB)
                    </p>
                  </div>
                </div>
              </label>

              {selectedFile && (
                <div className="mt-4 text-sm text-gray-600">
                  Selected file: <span className="font-medium text-gray-900">{selectedFile.name}</span>
                </div>
              )}
            </div>

            {statusMessage && (
              <div
                className="rounded-lg px-4 py-3"
                style={{
                  backgroundColor: "var(--success-surface)",
                  border: "1px solid var(--success-border)",
                  color: "var(--success-text)",
                }}
              >
                {statusMessage}
              </div>
            )}

            {errorMessage && (
              <div
                className="rounded-lg px-4 py-3"
                style={{
                  backgroundColor: "var(--danger-surface)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger-text)",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                onClick={() => {
                  setSelectedFile(null); // Reset the chosen file
                  setStatusMessage(""); // Clear status banners
                  setErrorMessage(""); // Clear error state
                  const input = document.getElementById("dealer-file");
                  if (input) {
                    input.value = ""; // Reset the file input element manually
                  }
                }}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-6 py-2 rounded-lg text-white font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--danger)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--danger-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--danger)"; }}
              >
                {isUploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </form>
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Why upload dealer files?</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Attach signed paperwork for Mitsubishi, Suzuki, and SsangYong jobs.</li>
            <li>Share documentation instantly with the Parts, Accounts, and Management teams.</li>
            <li>Keep the digital job card complete for audits and customer follow-up.</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
