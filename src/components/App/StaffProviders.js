import { UserProvider } from "@/context/UserContext";
import { NextActionProvider } from "@/context/NextActionContext";
import { JobsProvider } from "@/context/JobsContext";
import { ClockingProvider } from "@/context/ClockingContext";
import { RosterProvider } from "@/context/RosterContext";
import { AlertProvider } from "@/context/AlertContext";
import { ConfirmationProvider } from "@/context/ConfirmationContext";
import { DevLayoutOverlayProvider } from "@/context/DevLayoutOverlayContext";
import { DevLayoutRegistryProvider } from "@/context/DevLayoutRegistryContext";
import { SupportDiagnosticsProvider } from "@/context/SupportReportContext";
import SupportErrorBoundary from "@/components/support/SupportErrorBoundary";
import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr/config";
import { ThemeProvider } from "@/styles/themeProvider";

// One route-level boundary for the authenticated application runtime. Keeping
// this composition in one module lets /login avoid downloading staff contexts
// while retaining synchronous provider nesting once the staff route is active.
export default function StaffProviders({ children, initialRosterData }) {
  return (
    <AlertProvider>
      <ConfirmationProvider>
        <UserProvider>
          <ThemeProvider defaultMode="system">
            <DevLayoutOverlayProvider>
              <DevLayoutRegistryProvider>
                <SWRConfig value={swrConfig}>
                  <NextActionProvider>
                    <JobsProvider>
                      <ClockingProvider>
                        <RosterProvider initialRosterData={initialRosterData}>
                          <SupportDiagnosticsProvider>
                            <SupportErrorBoundary hostSupportModal>
                              {children}
                            </SupportErrorBoundary>
                          </SupportDiagnosticsProvider>
                        </RosterProvider>
                      </ClockingProvider>
                    </JobsProvider>
                  </NextActionProvider>
                </SWRConfig>
              </DevLayoutRegistryProvider>
            </DevLayoutOverlayProvider>
          </ThemeProvider>
        </UserProvider>
      </ConfirmationProvider>
    </AlertProvider>
  );
}
