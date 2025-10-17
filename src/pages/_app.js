// file location: src/pages/_app.js
import React, { useEffect } from "react";
import { SessionProvider } from "next-auth/react"; // NextAuth session
import { UserProvider, useUser } from "../context/UserContext"; // custom user context
import { JobsProvider, useJobs } from "../context/JobsContext"; // jobs context
import { getAllJobs } from "../lib/database/jobs"; // jobs functions
import "../styles/globals.css";

function AppWrapper({ Component, pageProps }) {
  const { setJobs } = useJobs();
  const { user } = useUser();

  // 🔹 Fetch all jobs when user is available
  useEffect(() => {
    const fetchJobs = async () => {
      if (user) {
        const jobs = await getAllJobs();
        setJobs(jobs);
      }
    };
    fetchJobs();
  }, [user, setJobs]);

  return <Component {...pageProps} />;
}

export default function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <UserProvider>
        <JobsProvider>
          <AppWrapper Component={Component} pageProps={pageProps} />
        </JobsProvider>
      </UserProvider>
    </SessionProvider>
  );
}