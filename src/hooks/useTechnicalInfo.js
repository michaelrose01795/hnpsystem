import useSWR from "swr";
import { resolveVehicleDisplay } from "@/lib/vehicles/vehicleFormState";

const VEHICLE_SELECTION = { requestId: "", requestText: "", query: "", category: "", browse: false };

const fetchTechnicalInfo = async ([url, payload]) => {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(40_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load technical information.");
  return data;
};

// SWR coalesces duplicate requests from the header and request popups. Vehicle data
// is separately cached by the server, so changing topic does not repeat external calls.
export default function useTechnicalInfo(jobNumber, selection) {
  return useSWR(jobNumber ? [`/api/job-cards/${encodeURIComponent(jobNumber)}/technical-info`, selection] : null,
    fetchTechnicalInfo, { revalidateOnFocus: false, dedupingInterval: 30_000, shouldRetryOnError: false, keepPreviousData: false });
}

// Uses the popup's default cache key, so opening it reuses the summary lookup.
// The display resolver rejects a response for a different registration.
export function useTechnicalVehicle(jobNumber, vehicle) {
  const { data } = useTechnicalInfo(jobNumber, VEHICLE_SELECTION);
  return resolveVehicleDisplay(vehicle || {}, data);
}
