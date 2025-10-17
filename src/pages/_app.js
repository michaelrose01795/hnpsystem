// file location: src/pages/_app.js
import React, { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { UserProvider, useUser } from "../context/UserContext";
import { JobsProvider, useJobs } from "../context/JobsContext";
import { ClockingProvider } from "../context/ClockingContext"; // ✅ Added
import { getAllJobs } from "../lib/database/jobs";
import "../styles/globals.css";

// Inner wrapper for job fetching
function AppWrapper({ Component, pageProps }) {
  const { user } = useUser() || {};
  const { setJobs } = useJobs() || {};

  useEffect(() => {
    const fetchJobs = async () => {
      if (user && setJobs) {
        const jobs = await getAllJobs();
        setJobs(jobs);
      }
    };
    fetchJobs();
  }, [user, setJobs]);

  return <Component {...pageProps} />;
}

// Main app entry
export default function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <UserProvider>
        <JobsProvider>
          <ClockingProvider> {/* ✅ Wrapped here */}
            <AppWrapper Component={Component} pageProps={pageProps} />
          </ClockingProvider>
        </JobsProvider>
      </UserProvider>
    </SessionProvider>
  );
}
