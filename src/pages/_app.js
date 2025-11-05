// file location: src/pages/_app.js
import React, { useEffect, useRef, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { UserProvider, useUser } from "../context/UserContext";
import { JobsProvider, useJobs } from "../context/JobsContext";
import { ClockingProvider } from "../context/ClockingContext"; // ✅ Added
import { getAllJobs } from "../lib/database/jobs";
import { useRouter } from "next/router";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/globals.css";

// Inner wrapper for job fetching
function AppWrapper({ Component, pageProps }) {
  const { user } = useUser() || {};
  const { setJobs } = useJobs() || {};
  const router = useRouter();
  const [isRouting, setIsRouting] = useState(false);
  const [displayLoader, setDisplayLoader] = useState(false);
  const showTimeoutRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const displayLoaderRef = useRef(displayLoader);

  useEffect(() => {
    const fetchJobs = async () => {
      if (user && setJobs) {
        const jobs = await getAllJobs();
        setJobs(jobs);
      }
    };
    fetchJobs();
  }, [user, setJobs]);

  useEffect(() => {
    displayLoaderRef.current = displayLoader;
  }, [displayLoader]);

  // Display branded loader during Next.js route transitions with a brief fade-out delay.
  useEffect(() => {
    const handleRouteStart = (url) => {
      if (url !== router.asPath) {
        setIsRouting(true);
        clearTimeout(fadeTimeoutRef.current);
        clearTimeout(showTimeoutRef.current);
        // Small delay prevents flicker on fast in-app transitions.
        showTimeoutRef.current = setTimeout(() => {
          setDisplayLoader(true);
        }, 150);
      }
    };

    const finishLoading = () => {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
      setIsRouting(false);

      if (displayLoaderRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = setTimeout(() => {
          setDisplayLoader(false);
        }, 200);
      } else {
        setIsRouting(true);
      }
    };

    router.events.on("routeChangeStart", handleRouteStart);
    router.events.on("routeChangeComplete", finishLoading);
    router.events.on("routeChangeError", finishLoading);

    return () => {
      clearTimeout(showTimeoutRef.current);
      clearTimeout(fadeTimeoutRef.current);
      router.events.off("routeChangeStart", handleRouteStart);
      router.events.off("routeChangeComplete", finishLoading);
      router.events.off("routeChangeError", finishLoading);
    };
  }, [router]);

  return (
    <>
      {displayLoader && <LoadingScreen isFadingOut={!isRouting} />}
      <Component {...pageProps} />
    </>
  );
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
