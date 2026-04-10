// file location: src/hooks/useClocking.js
// ⚠️ DEPRECATED — thin adapter retained only for backwards compatibility.
//
// History: this hook used to talk directly to the Supabase `clocking` table
// from the browser (`supabase.from("clocking")...`). That bypassed the
// server-side auto-close logic in `src/pages/api/profile/clock.js` and could
// leave stale records open. The canonical flow is now `ClockingContext`,
// which calls `/api/profile/clock` and centralises the state machine.
//
// To prevent any drift between the legacy hook and the canonical context,
// `useClocking` is now a thin pass-through over `useClockingContext()`. The
// public return shape (`{ clockedIn, hoursWorked, loading, clockIn, clockOut }`)
// is preserved so existing callers compile unchanged.
//
// New code should call `useClockingContext()` directly from
// `@/context/ClockingContext`. Audit (2026-04-10) shows the only remaining
// importer is `src/components/Clocking/ClockingCard.js`, which is itself an
// orphan and is being migrated in the same change.
//
// Backwards compatibility notes:
//   - `hoursWorked` is now a Number (was a string formatted with toFixed).
//     Callers must format it themselves with `.toFixed(2)`.
//   - This hook still requires a `<ClockingProvider>` ancestor — same as the
//     pre-adapter version, which already called `useClockingContext()` for the
//     userId. No new requirement is introduced.
import { useClockingContext } from "@/context/ClockingContext"; // canonical clocking source

export const useClocking = () => {
  // Pull the canonical state and actions from the provider.
  const {
    clockedIn,    // boolean — current clock-in state for the logged-in user
    hoursWorked,  // number  — hours since most recent clock-in (0 if clocked out)
    loading,      // boolean — provider is fetching/mutating
    clockIn,      // () => Promise<void> — POST /api/profile/clock action=clock-in
    clockOut,     // () => Promise<void> — POST /api/profile/clock action=clock-out
  } = useClockingContext();

  // Preserve the legacy return shape so existing destructuring keeps working.
  return { clockedIn, hoursWorked, loading, clockIn, clockOut };
};

export default useClocking;
