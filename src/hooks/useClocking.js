// file location: src/hooks/useClocking.js
import { useClockingContext } from "../context/ClockingContext";

export const useClocking = () => {
  const { clockedIn, hoursWorked, loading, clockIn, clockOut } = useClockingContext();

  return { clockedIn, hoursWorked, loading, clockIn, clockOut };
};
