// file location: src/context/DevLayoutRegistryContext.js
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const DevLayoutRegistryContext = createContext({
  registry: {},
  registerSection: () => {},
  unregisterSection: () => {},
  updateSectionElement: () => {},
  clearRouteSections: () => {},
});

export function DevLayoutRegistryProvider({ children }) {
  const [registry, setRegistry] = useState({});

  const registerSection = useCallback((sectionKey, payload) => {
    if (!sectionKey) return;
    setRegistry((current) => ({
      ...current,
      [sectionKey]: {
        ...(current[sectionKey] || {}),
        ...payload,
        key: sectionKey,
      },
    }));
  }, []);

  const unregisterSection = useCallback((sectionKey) => {
    if (!sectionKey) return;
    setRegistry((current) => {
      if (!current[sectionKey]) return current;
      const next = { ...current };
      delete next[sectionKey];
      return next;
    });
  }, []);

  const updateSectionElement = useCallback((sectionKey, element) => {
    if (!sectionKey) return;
    setRegistry((current) => {
      if (!current[sectionKey]) return current;
      return {
        ...current,
        [sectionKey]: {
          ...current[sectionKey],
          element,
        },
      };
    });
  }, []);

  const clearRouteSections = useCallback((route) => {
    if (!route) return;
    setRegistry((current) => {
      let changed = false;
      const next = {};
      Object.values(current).forEach((entry) => {
        if (entry?.route && entry.route !== route) {
          next[entry.key] = entry;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const value = useMemo(
    () => ({ registry, registerSection, unregisterSection, updateSectionElement, clearRouteSections }),
    [registry, registerSection, unregisterSection, updateSectionElement, clearRouteSections]
  );

  return <DevLayoutRegistryContext.Provider value={value}>{children}</DevLayoutRegistryContext.Provider>;
}

export function useDevLayoutRegistry() {
  return useContext(DevLayoutRegistryContext);
}
