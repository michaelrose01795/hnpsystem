// file location: src/pages/_app.js
// Wrap the app with NextAuth SessionProvider and your UserProvider so all pages can access auth state.
// Place this file at src/pages/_app.js (overwrite the previous one).

import React from "react"; // import React
import { SessionProvider } from "next-auth/react"; // NextAuth's session provider
import { UserProvider } from "../context/UserContext"; // your app's UserProvider (uses session)
import "../styles/globals.css"; // import your global stylesheet

// Next.js custom App component
export default function MyApp({ Component, pageProps }) {
  // wrap Component with SessionProvider then UserProvider
  return (
    <SessionProvider session={pageProps.session}>
      <UserProvider>
        <Component {...pageProps} /> {/* render the page */}
      </UserProvider>
    </SessionProvider>
  );
}