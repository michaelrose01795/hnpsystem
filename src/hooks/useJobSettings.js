// file location: src/hooks/useJobSettings.js
//
// Data for the Job Card Settings popup: the settings-only fields (priority,
// service advisor, next-update owner / reminder), the advisor list and any
// open clocking, from /api/job-cards/[jobNumber]/settings — plus `runAction`,
// which posts one settings action to the same route.
//
// The job card page owns the card itself (fetchJobData + its SWR entry); after
// a successful action the popup asks the page to refresh, so every tab picks the
// change up without a reload.

import { useCallback } from "react";
import useSWR from "swr";
import { buildJobSettingsKey } from "@/lib/swr/keys";

const fetcher = async (url) => {
  const res = await fetch(url, { credentials: "include" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    const error = new Error(payload?.error || "Failed to load job settings");
    error.status = res.status;
    throw error;
  }
  return payload.data;
};

/**
 * @param {string} jobNumber
 * @param {{ enabled?: boolean, jobId?: number|null }} [options]
 */
export function useJobSettings(jobNumber, { enabled = true, jobId = null } = {}) {
  const key = enabled ? buildJobSettingsKey(jobNumber) : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  });

  const runAction = useCallback(
    async (action, payload = {}) => {
      const url = buildJobSettingsKey(jobNumber);
      if (!url) return { success: false, error: "Job number missing" };
      try {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, action, jobId }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result?.success) {
          return {
            success: false,
            error: result?.error || `The change could not be saved (${res.status}).`,
            code: result?.code || null,
          };
        }
        await mutate();
        return { success: true, message: result.message || "Saved." };
      } catch (requestError) {
        return { success: false, error: requestError?.message || "The change could not be saved." };
      }
    },
    [jobNumber, jobId, mutate]
  );

  return {
    settings: data || null,
    meta: data?.meta || null,
    advisors: Array.isArray(data?.advisors) ? data.advisors : [],
    activeClocking: Array.isArray(data?.activeClocking) ? data.activeClocking : [],
    error: error || null,
    isLoading,
    refresh: mutate,
    runAction,
  };
}

export default useJobSettings;
