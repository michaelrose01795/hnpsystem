"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";

const ConfirmationContext = createContext({
  confirm: () => Promise.resolve(false),
});

export function ConfirmationProvider({ children }) {
  const [currentRequest, setCurrentRequest] = useState(null);

  const confirm = useCallback((payload, overrides = {}) => {
    const normalized = typeof payload === "string" ? { message: payload } : payload || {};
    return new Promise((resolve) => {
      setCurrentRequest((existing) => {
        if (existing?.resolve) {
          existing.resolve(false);
        }
        return { ...normalized, ...overrides, resolve };
      });
    });
  }, []);

  const handleChoice = useCallback((result) => {
    setCurrentRequest((current) => {
      if (current?.resolve) {
        current.resolve(result);
      }
      return null;
    });
  }, []);

  const contextValue = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmationContext.Provider value={contextValue}>
      {children}
      <ConfirmationDialog
        isOpen={Boolean(currentRequest)}
        title={currentRequest?.title || "Please confirm"}
        message={currentRequest?.message}
        description={currentRequest?.description}
        confirmLabel={currentRequest?.confirmLabel || "Yes"}
        cancelLabel={currentRequest?.cancelLabel || "No"}
        onConfirm={() => handleChoice(true)}
        onCancel={() => handleChoice(false)}
      />
    </ConfirmationContext.Provider>
  );
}

export const useConfirmation = () => useContext(ConfirmationContext);
