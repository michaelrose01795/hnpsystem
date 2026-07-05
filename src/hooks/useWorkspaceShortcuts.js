import { useCallback, useEffect, useMemo, useState } from "react";

const FAVOURITES_KEY = "hnp.workspaceNavigation.favourites";
const RECENTS_KEY = "hnp.workspaceNavigation.recents";
const MAX_RECENTS = 6;

const readStoredList = (key) => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((href) => typeof href === "string") : [];
  } catch {
    return [];
  }
};

const writeStoredList = (key, value) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const recordWorkspaceRecentHref = (href) => {
  if (!href || typeof window === "undefined") return [];
  const current = readStoredList(RECENTS_KEY);
  const next = [href, ...current.filter((candidate) => candidate !== href)].slice(0, MAX_RECENTS);
  writeStoredList(RECENTS_KEY, next);
  return next;
};

const indexItems = (items = []) =>
  new Map(
    items
      .filter((item) => item?.href)
      .map((item) => [item.href, { label: item.label, href: item.href, department: item.department || null }])
  );

export default function useWorkspaceShortcuts(availableItems = []) {
  const [favouriteHrefs, setFavouriteHrefs] = useState([]);
  const [recentHrefs, setRecentHrefs] = useState([]);

  useEffect(() => {
    setFavouriteHrefs(readStoredList(FAVOURITES_KEY));
    setRecentHrefs(readStoredList(RECENTS_KEY));
  }, []);

  const itemIndex = useMemo(() => indexItems(availableItems), [availableItems]);
  const resolveItems = useCallback(
    (hrefs) => hrefs.map((href) => itemIndex.get(href)).filter(Boolean),
    [itemIndex]
  );

  const favourites = useMemo(
    () => resolveItems(favouriteHrefs),
    [favouriteHrefs, resolveItems]
  );
  const recents = useMemo(
    () => resolveItems(recentHrefs).filter((item) => !favouriteHrefs.includes(item.href)),
    [favouriteHrefs, recentHrefs, resolveItems]
  );

  const toggleFavourite = useCallback((href) => {
    if (!href || !itemIndex.has(href)) return;
    setFavouriteHrefs((current) => {
      const next = current.includes(href)
        ? current.filter((candidate) => candidate !== href)
        : [...current, href];
      writeStoredList(FAVOURITES_KEY, next);
      return next;
    });
  }, [itemIndex]);

  const recordRecent = useCallback((href) => {
    if (!href || !itemIndex.has(href)) return;
    setRecentHrefs(recordWorkspaceRecentHref(href));
  }, [itemIndex]);

  const isFavourite = useCallback(
    (href) => favouriteHrefs.includes(href),
    [favouriteHrefs]
  );

  return {
    favourites,
    recents,
    favouriteHrefs,
    toggleFavourite,
    recordRecent,
    isFavourite,
  };
}
