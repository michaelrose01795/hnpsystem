// file location: pages/_app.js
// pages/_app.js - Next.js custom App; wraps the app with UserProvider so every page can use useUser

import React from 'react'; // import React
import { UserProvider } from '../context/UserContext'; // import our provider
import '../styles/globals.css'; // optional: your global CSS (create if you don't have it)

export default function MyApp({ Component, pageProps }) { // Next.js app entry point
  return (
    <UserProvider>
      <Component {...pageProps} /> {/* render the page */}
    </UserProvider>
  );
}