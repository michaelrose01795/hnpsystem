import { createContext, useContext, useEffect, useMemo } from "react";
import { demoJobs } from "./demoJobs";
import { demoCustomers } from "./demoCustomers";
import { demoVehicles } from "./demoVehicles";
import { demoParts } from "./demoParts";
import { demoAppointments } from "./demoAppointments";
import { installDemoFetchInterceptor, uninstallDemoFetchInterceptor } from "../guards/demoFetchInterceptor";

const DemoDataContext = createContext(null);

export const DEMO_FLAG = "__SLIDESHOW_DEMO__";

export function DemoDataProvider({ children }) {
  const value = useMemo(() => ({
    jobs: demoJobs,
    customers: demoCustomers,
    vehicles: demoVehicles,
    parts: demoParts,
    appointments: demoAppointments,
  }), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window[DEMO_FLAG] = true;
    installDemoFetchInterceptor(value);
    return () => {
      uninstallDemoFetchInterceptor();
      window[DEMO_FLAG] = false;
    };
  }, [value]);

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData() {
  return useContext(DemoDataContext);
}

export function isDemoActive() {
  return typeof window !== "undefined" && window[DEMO_FLAG] === true;
}
