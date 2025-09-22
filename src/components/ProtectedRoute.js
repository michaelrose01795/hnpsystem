// file location: components/ProtectedRoute.js
// components/ProtectedRoute.js - client-side protected wrapper that redirects if not allowed

import React, { useEffect } from 'react'; // import React and useEffect
import { useRouter } from 'next/router'; // Next.js router for redirects
import { useUser } from '../context/UserContext'; // use our UserContext

export default function ProtectedRoute({ children, allowedRoles = null }) { // allowedRoles: array or null (allow all)
  const { user } = useUser(); // get current user
  const router = useRouter(); // router instance

  useEffect(() => { // on user change decide where to send them
    // if user not loaded yet, wait (useEffect will run again)
    if (typeof window === 'undefined') return; // guard for SSR
    if (!user) { // not logged in → go to login
      router.replace('/login'); // replace to avoid back-button confusion
      return;
    }
    // if allowedRoles specified but user.role not included → unauthorized
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/unauthorized'); // send to unauthorized page
    }
  }, [user, allowedRoles, router]); // rerun when user or allowedRoles change

  // while there's no user (or role mismatch) we render nothing — redirect handles the UX
  if (!user) return null; // no user yet
  if (allowedRoles && !allowedRoles.includes(user.role)) return null; // not permitted

  return <>{children}</>; // render protected content
}