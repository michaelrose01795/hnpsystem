// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "../styles/globals.css"; // import global Tailwind styles
import React, { useEffect } from "react"; // import React helpers
import { SessionProvider } from "next-auth/react"; // import NextAuth session provider
import { UserProvider, useUser } from "@/context/UserContext"; // import user context
import { NextActionProvider } from "@/context/NextActionContext"; // import next action context provider
import { JobsProvider, useJobs } from "@/context/JobsContext"; // import jobs context
import { ClockingProvider } from "@/context/ClockingContext"; // import clocking context
import { RosterProvider } from "@/context/RosterContext"; // import roster context
import { getAllJobs } from "@/lib/database/jobs"; // database helper to seed jobs in context

function AppWrapper({ Component, pageProps }) {
  const { user } = useUser() || {}; // read logged in user
  const { setJobs } = useJobs() || {}; // obtain setter from jobs context

  useEffect(() => {
    const fetchJobs = async () => {
      if (user && setJobs) {
        const jobs = await getAllJobs(); // pull jobs when user session changes
        setJobs(jobs); // update jobs context cache
      }
    };
    fetchJobs();
  }, [user, setJobs]);

  return <Component {...pageProps} />; // render the requested page
}

// Main app entry with all providers composed
export default function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <UserProvider>
        <NextActionProvider>
          <JobsProvider>
            <ClockingProvider>
              <RosterProvider>
                <AppWrapper Component={Component} pageProps={pageProps} />
              </RosterProvider>
            </ClockingProvider>
          </JobsProvider>
        </NextActionProvider>
      </UserProvider>
    </SessionProvider>
  );
}
