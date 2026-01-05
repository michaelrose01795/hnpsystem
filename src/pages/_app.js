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
import { getAllJobs } from "@/lib/database/jobs"; // database helper to seed jobs in context
import { AlertProvider } from "@/context/AlertContext";
import { ThemeProvider } from "@/styles/themeProvider";
import { ConfirmationProvider } from "@/context/ConfirmationContext";

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

  // Auto-hide scrollbar after 3 seconds of inactivity
  useEffect(() => {
    const scrollableElements = new Map();
    let hideTimers = new Map();

    const showScrollbar = (element) => {
      element.classList.add('scrollbar-visible');
      element.classList.remove('scrollbar-hidden');
    };

    const hideScrollbar = (element) => {
      element.classList.remove('scrollbar-visible');
      element.classList.add('scrollbar-hidden');
    };

    const resetHideTimer = (element) => {
      // Clear existing timer
      if (hideTimers.has(element)) {
        clearTimeout(hideTimers.get(element));
      }

      // Show scrollbar
      showScrollbar(element);

      // Set new timer to hide after 3 seconds
      const timer = setTimeout(() => {
        hideScrollbar(element);
      }, 3000);

      hideTimers.set(element, timer);
    };

    const handleScroll = (e) => {
      const target = e.target === document ? document.body : e.target;
      resetHideTimer(target);
    };

    const handleMouseEnter = (e) => {
      showScrollbar(e.currentTarget);
      if (hideTimers.has(e.currentTarget)) {
        clearTimeout(hideTimers.get(e.currentTarget));
      }
    };

    const handleMouseLeave = (e) => {
      resetHideTimer(e.currentTarget);
    };

    const attachScrollListeners = (element) => {
      if (!scrollableElements.has(element)) {
        const isScrollable =
          element.scrollHeight > element.clientHeight ||
          element.scrollWidth > element.clientWidth;

        if (isScrollable) {
          scrollableElements.set(element, true);
          element.addEventListener('scroll', handleScroll);
          element.addEventListener('mouseenter', handleMouseEnter);
          element.addEventListener('mouseleave', handleMouseLeave);

          // Initially hide scrollbar
          hideScrollbar(element);
        }
      }
    };

    // Explicitly handle body element
    attachScrollListeners(document.body);

    // Handle window scroll for body
    const handleWindowScroll = () => {
      resetHideTimer(document.body);
    };
    window.addEventListener('scroll', handleWindowScroll);

    // Find all scrollable elements
    const observer = new MutationObserver(() => {
      const allElements = document.querySelectorAll('*');
      allElements.forEach((element) => {
        attachScrollListeners(element);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan
    const initialElements = document.querySelectorAll('*');
    initialElements.forEach((element) => {
      attachScrollListeners(element);
    });

    // Cleanup
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleWindowScroll);
      scrollableElements.forEach((_, element) => {
        element.removeEventListener('scroll', handleScroll);
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
      });
      hideTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

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
