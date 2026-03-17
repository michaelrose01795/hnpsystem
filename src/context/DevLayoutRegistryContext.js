// file location: src/context/DevLayoutRegistryContext.js
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const DevLayoutRegistryContext = createContext({
  registry: {},
  registeredSections: {},
  computedSections: {},
  registerSection: () => {},
  unregisterSection: () => {},
  updateSectionElement: () => {},
  clearRouteSections: () => {},
  syncComputedSections: () => {},
});

export function DevLayoutRegistryProvider({ children }) {
  const [registeredSections, setRegisteredSections] = useState({});
  const [computedSections, setComputedSections] = useState({});

  const registerSection = useCallback((sectionKey, payload) => {
    if (!sectionKey) return;
    setRegisteredSections((current) => ({
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
    setRegisteredSections((current) => {
      if (!current[sectionKey]) return current;
      const next = { ...current };
      delete next[sectionKey];
      return next;
    });
    setComputedSections((current) => {
      if (!current[sectionKey]) return current;
      const next = { ...current };
      delete next[sectionKey];
      return next;
    });
  }, []);

  const updateSectionElement = useCallback((sectionKey, element) => {
    if (!sectionKey) return;
    setRegisteredSections((current) => {
      if (!current[sectionKey]) return current;
      if (current[sectionKey].element === element) return current;
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
    setRegisteredSections((current) => {
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
    setComputedSections((current) => {
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

  const syncComputedSections = useCallback((route, sections = []) => {
    if (!route) return;
    const keyedSections = (sections || []).filter((entry) => entry?.key);
    const incomingByKey = new Map(keyedSections.map((entry) => [entry.key, entry]));

    setComputedSections((current) => {
      const next = {};
      let changed = false;

      Object.entries(current).forEach(([key, value]) => {
        if (value?.route === route && !incomingByKey.has(key)) {
          changed = true;
          return;
        }
        next[key] = value;
      });

      keyedSections.forEach((entry) => {
        const prev = current[entry.key];
        const signature = [
          entry.route || route,
          entry.number || "",
          entry.parentKey || "",
          (entry.childKeys || []).join("|"),
          entry.type || "section-shell",
          entry.source || "registry",
          entry.wrapperClass || "content",
          entry.widthMode || "",
          entry.backgroundToken || "",
          entry.backgroundClass || "",
          entry.backgroundColor || "",
          entry.padding || "",
          entry.margin || "",
          entry.radius || "",
          entry.width || 0,
          entry.height || 0,
          entry.left || 0,
          entry.top || 0,
          (entry.issueTags || []).join("|"),
          entry.computedGapFromPrevious ?? "",
          entry.computedLeftOffsetFromParent ?? "",
        ].join("::");

        const compact = {
          key: entry.key,
          route: entry.route || route,
          number: entry.number || "",
          parentKey: entry.parentKey || "",
          parentNumber: entry.parentNumber || "",
          childKeys: entry.childKeys || [],
          childNumbers: entry.childNumbers || [],
          type: entry.type || "section-shell",
          source: entry.source || "registry",
          element: entry.node || null,
          wrapperClass: entry.wrapperClass || "content",
          isShell: Boolean(entry.isShell),
          issueTags: entry.issueTags || [],
          widthMode: entry.widthMode || "",
          backgroundToken: entry.backgroundToken || "",
          backgroundClass: entry.backgroundClass || "",
          backgroundColor: entry.backgroundColor || "",
          padding: entry.padding || "",
          margin: entry.margin || "",
          radius: entry.radius || "",
          width: entry.width || 0,
          height: entry.height || 0,
          left: entry.left || 0,
          top: entry.top || 0,
          computedGapFromPrevious: entry.computedGapFromPrevious,
          computedLeftOffsetFromParent: entry.computedLeftOffsetFromParent,
          signature,
        };

        next[entry.key] = compact;

        if (!prev || prev.signature !== signature || prev.element !== compact.element) {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, []);

  const registry = useMemo(
    () =>
      Object.entries(registeredSections).reduce((acc, [key, registered]) => {
        acc[key] = {
          ...registered,
          ...(computedSections[key] || {}),
        };
        return acc;
      }, {}),
    [registeredSections, computedSections]
  );

  const value = useMemo(
    () => ({
      registry,
      registeredSections,
      computedSections,
      registerSection,
      unregisterSection,
      updateSectionElement,
      clearRouteSections,
      syncComputedSections,
    }),
    [
      registry,
      registeredSections,
      computedSections,
      registerSection,
      unregisterSection,
      updateSectionElement,
      clearRouteSections,
      syncComputedSections,
    ]
  );

  return <DevLayoutRegistryContext.Provider value={value}>{children}</DevLayoutRegistryContext.Provider>;
}

export function useDevLayoutRegistry() {
  return useContext(DevLayoutRegistryContext);
}
