// file location: src/hooks/useDriveTimeToHNP.js
// Client-side hook that debounces a postcode and fetches the drive time to
// the Humphries & Parks origin via /api/location/drive-time.
//
// Returns a three-state snapshot matching the API contract so the
// eligibility engine can feed straight into its drive-time rule:
//
//   { status: "pending" | "ok" | "unavailable" | "error", minutes, distanceMiles, estimated, ... }
//
// The hook is deliberately narrow — it doesn't know about eligibility rules,
// it just keeps a network result in sync with the input postcode.

import { useEffect, useMemo, useRef, useState } from "react";

const DEBOUNCE_MS = 500;

// Rough UK-postcode shape check. Deliberately permissive — we let
// postcodes.io decide on edge cases. This only prevents obviously empty /
// sub-postcode strings from hitting the network.
const looksLikeUkPostcode = (value) => {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 5) return false;
  return /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(trimmed);
};

export default function useDriveTimeToHNP(postcode) {
  const [state, setState] = useState({ status: "pending" });
  const latestRequestRef = useRef(0);

  // Memoise the trimmed/uppercased postcode so we only re-fetch when the
  // meaningful value changes (not on whitespace edits).
  const normalisedPostcode = useMemo(
    () => String(postcode || "").trim().toUpperCase(),
    [postcode]
  );

  useEffect(() => {
    // If the postcode is empty or clearly malformed, skip the network call
    // and mark the lookup as "unavailable" so the UI shows a friendly hint.
    if (!normalisedPostcode) {
      setState({ status: "unavailable", detail: "No postcode entered yet" });
      return undefined;
    }
    if (!looksLikeUkPostcode(normalisedPostcode)) {
      setState({ status: "unavailable", detail: "Waiting for a full UK postcode" });
      return undefined;
    }

    setState({ status: "pending" });
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/location/drive-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destinationPostcode: normalisedPostcode }),
        });

        // If the user changed the postcode while we were in flight, drop
        // this response — a newer request is on its way.
        if (requestId !== latestRequestRef.current) return;

        const payload = await res.json().catch(() => null);
        if (!payload) {
          setState({ status: "error", detail: "Empty response from drive-time API" });
          return;
        }
        setState(payload);
      } catch (err) {
        if (requestId !== latestRequestRef.current) return;
        setState({
          status: "error",
          detail: err?.message || "Drive-time lookup failed",
        });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [normalisedPostcode]);

  return state;
}
