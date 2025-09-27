// file location: src/pages/_app.js
import React from "react";
import { SessionProvider } from "next-auth/react"; // NextAuth session
import { UserProvider } from "../context/UserContext"; // custom user context
import { JobsProvider } from "../context/JobsContext"; // jobs context
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <UserProvider>
        <JobsProvider>
          <Component {...pageProps} />
        </JobsProvider>
      </UserProvider>
    </SessionProvider>
  );
}
