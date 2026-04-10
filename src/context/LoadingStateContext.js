// file location: src/context/LoadingStateContext.js
// Lightweight context that publishes the global "page is loading" flag from
// _app.js down to Layout.js / CustomerLayout.js so each layout can swap its
// content area for a PageContentSkeleton without unmounting the sidebar/topbar.

import React, { createContext, useContext } from "react";

const LoadingStateContext = createContext({ isLoading: false });

export function LoadingStateProvider({ value, children }) {
  return <LoadingStateContext.Provider value={value}>{children}</LoadingStateContext.Provider>;
}

export function useLoadingState() {
  return useContext(LoadingStateContext);
}
