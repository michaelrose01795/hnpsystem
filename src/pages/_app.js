// file location: src/pages/_app.js
import "@/utils/polyfills";
import "../styles/globals.css";
import React, { useEffect, useRef, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { UserProvider, useUser } from "../context/UserContext";
import { JobsProvider, useJobs } from "../context/JobsContext";
import { ClockingProvider } from "../context/ClockingContext"; // ✅ Added
import { getAllJobs } from "../lib/database/jobs";
import { useRouter } from "next/router";
import CustomLoader from "../components/Loading/CustomLoader";

// Inner wrapper for job fetching
const SLOW_ROUTE_DELAY_MS = 800;
const FADE_OUT_DELAY_MS = 200;

function AppWrapper({ Component, pageProps }) {
  const { user } = useUser() || {};
  const { setJobs } = useJobs() || {};
  const router = useRouter();
  const [displayLoader, setDisplayLoader] = useState(false);
  const slowRouteTimeoutRef = useRef(null);
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

  // Display branded loader only when Next.js route transitions are slow enough to be noticeable.
  useEffect(() => {
    const handleRouteStart = (url) => {
      if (url !== router.asPath) {
        clearTimeout(fadeTimeoutRef.current);
        clearTimeout(slowRouteTimeoutRef.current);
        // Wait before showing loader so fast navigations render instantly.
        slowRouteTimeoutRef.current = setTimeout(() => {
          setDisplayLoader(true);
        }, SLOW_ROUTE_DELAY_MS);
      }
    };

    const finishLoading = () => {
      clearTimeout(slowRouteTimeoutRef.current);
      slowRouteTimeoutRef.current = null;

      if (displayLoaderRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = setTimeout(() => {
          setDisplayLoader(false);
        }, FADE_OUT_DELAY_MS);
      } else {
        setDisplayLoader(false);
      }
    };

    router.events.on("routeChangeStart", handleRouteStart);
    router.events.on("routeChangeComplete", finishLoading);
    router.events.on("routeChangeError", finishLoading);

    return () => {
      clearTimeout(slowRouteTimeoutRef.current);
      clearTimeout(fadeTimeoutRef.current);
      router.events.off("routeChangeStart", handleRouteStart);
      router.events.off("routeChangeComplete", finishLoading);
      router.events.off("routeChangeError", finishLoading);
    };
  }, [router]);

  return (
    <>
      <CustomLoader isVisible={displayLoader} />
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
