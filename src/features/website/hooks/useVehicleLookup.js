// file location: src/features/website/hooks/useVehicleLookup.js
//
// Registration -> the public DVLA slice, for "Find parts for my vehicle".
//
// Reuses POST /api/website/valuation/lookup, the unauthenticated, rate-limited
// DVLA route the valuation wizard and the hero quick actions already call —
// there is deliberately one public door onto the metered DVLA key, not two.
// DVLA returns the make, year, fuel and engine size but never the model, so
// the caller asks the customer for the model afterwards.
//
// status: idle | loading | found | error. Only the newest lookup may write
// state, so a slow answer for a mistyped plate cannot replace the right one.

import { useCallback, useRef, useState } from "react";

const IDLE = { status: "idle", vehicle: null, message: "" };

export default function useVehicleLookup() {
  const [state, setState] = useState(IDLE);
  const requestId = useRef(0);

  const lookup = useCallback(async (registration) => {
    const id = ++requestId.current;
    setState({ status: "loading", vehicle: null, message: "" });
    try {
      const res = await fetch("/api/website/valuation/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration }),
      });
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return;
      if (!res.ok || !data?.success) {
        setState({
          status: "error",
          vehicle: null,
          message: data?.message || "We could not look that up. Choose your vehicle below instead.",
        });
        return;
      }
      setState({ status: "found", vehicle: data.vehicle, message: "" });
    } catch {
      if (id !== requestId.current) return;
      setState({
        status: "error",
        vehicle: null,
        message: "We could not look that up. Choose your vehicle below instead.",
      });
    }
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState(IDLE);
  }, []);

  return { ...state, lookup, reset };
}
