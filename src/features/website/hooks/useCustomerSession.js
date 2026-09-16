// file location: src/features/website/hooks/useCustomerSession.js
//
// Who is signed in to the public /website area, resolved once per mount
// from /api/website/auth/me (the HMAC-signed hnp_customer_session cookie).
//
// Deliberately tolerant: a 401 is the normal signed-out answer, not an
// error, so it resolves to { customer: null } rather than throwing. The
// shop uses this to decide between a saved basket and a local one.

import { useEffect, useState } from "react";

export default function useCustomerSession() {
  const [state, setState] = useState({ loading: true, customer: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/website/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, customer: data?.customer || null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, customer: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading: state.loading,
    customer: state.customer,
    signedIn: Boolean(state.customer),
  };
}
