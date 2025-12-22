// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "@/styles/theme.css"; // register CSS variables before globals
import "../styles/globals.css"; // import global base styles
import React, { useEffect } from "react"; // import React helpers
import { SessionProvider } from "next-auth/react"; // import NextAuth session provider
import { UserProvider, useUser } from "@/context/UserContext"; // import user context
import { NextActionProvider } from "@/context/NextActionContext"; // import next action context provider
import { JobsProvider, useJobs } from "@/context/JobsContext"; // import jobs context
import { ClockingProvider } from "@/context/ClockingContext"; // import clocking context
import { RosterProvider } from "@/context/RosterContext"; // import roster context
import { AlertProvider } from "@/context/AlertContext";
import { ThemeProvider } from "@/styles/themeProvider";
import { ConfirmationProvider } from "@/context/ConfirmationContext";
import useJobcardsApi from "@/hooks/api/useJobcardsApi";
import { initDropdownStyleObserver } from "@/utils/dropdownStyleApi";

function AppWrapper({ Component, pageProps }) {
  const { user } = useUser() || {}; // read logged in user
  const { setJobs } = useJobs() || {}; // obtain setter from jobs context
  const { listJobcards } = useJobcardsApi();
  useEffect(() => {
    let disconnect = () => {};
    if (typeof window !== "undefined") {
      disconnect = initDropdownStyleObserver();
    }
    return () => disconnect();
  }, []);

  useEffect(() => {
    const fetchJobs = async () => {
      if (user && setJobs) {
        try {
          const payload = await listJobcards();
          const jobCards = Array.isArray(payload?.jobCards)
            ? payload.jobCards
            : [];
          setJobs(jobCards); // update jobs context cache
        } catch (error) {
          console.error("❌ Failed to hydrate jobs via API", error);
          setJobs([]);
        }
      }
    };
    fetchJobs();
  }, [user, setJobs, listJobcards]);

  return <Component {...pageProps} />; // render the requested page
}

// Main app entry with all providers composed
export default function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <AlertProvider>
        <ConfirmationProvider>
          <UserProvider>
            <ThemeProvider defaultMode="system">
              <NextActionProvider>
                <JobsProvider>
                  <ClockingProvider>
                    <RosterProvider>
                      <AppWrapper Component={Component} pageProps={pageProps} />
                    </RosterProvider>
                  </ClockingProvider>
                </JobsProvider>
              </NextActionProvider>
            </ThemeProvider>
          </UserProvider>
        </ConfirmationProvider>
      </AlertProvider>
    </SessionProvider>
  );
}
