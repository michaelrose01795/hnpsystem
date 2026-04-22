// file location: src/pages/dev/status-snapshot.js
import { useCallback, useState } from "react";
import { canShowDevPages } from "@/lib/dev-tools/config";
import StatusSnapshotDevPageUi from "@/components/page-ui/dev/dev-status-snapshot-ui"; // Extracted presentation layer.

export default function StatusSnapshotDevPage() {
  const [jobInput, setJobInput] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    const trimmed = jobInput.trim();
    if (!trimmed) {
      setError("Enter a job number or job id.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/status/snapshot?jobId=${encodeURIComponent(trimmed)}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load snapshot");
      }
      setSnapshot(payload.snapshot);
    } catch (err) {
      setSnapshot(null);
      setError(err.message || "Unable to load snapshot");
    } finally {
      setLoading(false);
    }
  }, [jobInput]);

  if (!canShowDevPages()) {
    return <StatusSnapshotDevPageUi view="section1" />;





  }

  return <StatusSnapshotDevPageUi view="section2" error={error} fetchSnapshot={fetchSnapshot} jobInput={jobInput} loading={loading} setJobInput={setJobInput} snapshot={snapshot} />;




















































}
