// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "@/utils/quietConsole"; // minimize console noise unless LOG_LEVEL is raised
import "@/styles/theme.css"; // register CSS variables before globals
import "../styles/globals.css"; // import global base styles
import React, { useEffect } from "react"; // import React helpers
import { SessionProvider } from "next-auth/react"; // import NextAuth session provider
import { UserProvider } from "@/context/UserContext"; // import user context
import { NextActionProvider } from "@/context/NextActionContext"; // import next action context provider
import { JobsProvider } from "@/context/JobsContext"; // import jobs context
import { ClockingProvider } from "@/context/ClockingContext"; // import clocking context
import { RosterProvider } from "@/context/RosterContext"; // import roster context
import { AlertProvider } from "@/context/AlertContext";
import { ThemeProvider } from "@/styles/themeProvider";
import { ConfirmationProvider } from "@/context/ConfirmationContext";

function AppWrapper({ Component, pageProps }) {
  // Auto-hide scrollbar after 3 seconds of inactivity using delegated event listeners.
  // Uses event delegation on document (capturing phase) so we don't need to attach per-element.
  useEffect(() => {
    const hideTimers = new WeakMap();
    const HIDE_DELAY = 3000;

    const showScrollbar = (el) => {
      el.classList.add('scrollbar-visible');
      el.classList.remove('scrollbar-hidden');
    };

    const hideScrollbar = (el) => {
      el.classList.remove('scrollbar-visible');
      el.classList.add('scrollbar-hidden');
    };

    const resetHideTimer = (el) => {
      const existing = hideTimers.get(el);
      if (existing) clearTimeout(existing);
      showScrollbar(el);
      hideTimers.set(el, setTimeout(() => hideScrollbar(el), HIDE_DELAY));
    };

    // Capture scroll events from any element (scroll doesn't bubble, so we use capture phase)
    const handleScroll = (e) => {
      const target = e.target === document ? document.body : e.target;
      if (target && target.nodeType === 1) {
        resetHideTimer(target);
      }
    };

    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
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
