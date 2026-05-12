// Re-publishes Next's RouterContext to descendants with merged query values so
// `useRouter().query.jobNumber` (etc.) inside the mounted real page resolves to
// the demo id resolveroute filled in for that slide.

import { useMemo } from "react";
import { useRouter } from "next/router";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";

export default function RouterParamsOverride({ params = {}, pathname, children }) {
  const router = useRouter();
  const value = useMemo(() => {
    const mergedQuery = { ...router.query, ...params };
    return {
      ...router,
      query: mergedQuery,
      pathname: pathname || router.pathname,
      asPath: pathname || router.asPath,
    };
  }, [router, params, pathname]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}
