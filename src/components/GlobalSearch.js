// file location: src/components/GlobalSearch.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { createCustomerDisplaySlug } from "@/lib/customers/slug";

const MIN_QUERY_LENGTH = 2;

const typeLabels = {
  job: "Job Card",
  customer: "Customer",
  navigation: "Navigation",
  parts_order: "Parts Order",
  part: "Part",
  goods_in: "Goods In",
};

const createSlugFromResult = (item = {}) => {
  if (item.slug) return item.slug;
  if (item.firstName || item.lastName) {
    const slug = createCustomerDisplaySlug(item.firstName || "", item.lastName || "");
    if (slug) return slug;
  }
  if (item.title) {
    const slug = createCustomerDisplaySlug(item.title, "");
    if (slug) return slug;
  }
  return "";
};

const GlobalSearch = ({
  accentColor = "var(--primary)",
  isDarkMode = false,
  navigationItems = [],
}) => {
  const router = useRouter();
  const containerRef = useRef(null);
  const controlRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const abortRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [apiResults, setApiResults] = useState([]);
  const [navResults, setNavResults] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const [portalRoot, setPortalRoot] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
      setActiveIndex(0);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setNavResults([]);
      return;
    }

    const lowercaseQuery = query.trim().toLowerCase();
    const filtered = (navigationItems || [])
      .filter((item) => item && item.label && item.href)
      .filter((item) => {
        const labelMatch = item.label.toLowerCase().includes(lowercaseQuery);
        const keywordMatch = (item.keywords || []).some((keyword) =>
          keyword.toLowerCase().includes(lowercaseQuery)
        );
        return labelMatch || keywordMatch;
      })
      .slice(0, 6)
      .map((item) => ({
        type: "navigation",
        title: item.label,
        subtitle: item.description || item.href,
        href: item.href,
      }));

    setNavResults(filtered);
  }, [query, navigationItems]);

  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
      setApiResults([]);
      setIsLoading(false);
      setFeedback("");
      return;
    }

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setApiResults([]);
      setIsLoading(false);
      setFeedback("Keep typing to search jobs and customers");
      return;
    }

    setIsLoading(true);
    setFeedback("");

    const controller = new AbortController();
    abortRef.current = controller;

    const debounce = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/global?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const payload = await response.json();
        setApiResults(payload?.results || []);
        setIsOpen(true);
        setActiveIndex(0);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Global search request failed:", error);
          setFeedback("Something went wrong. Please try again.");
          setApiResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (navResults.length > 0 || apiResults.length > 0) {
      setIsOpen(true);
    } else if (!isFocused) {
      setIsOpen(false);
    }
  }, [navResults, apiResults, isFocused]);

  const trimmedQuery = query.trim();

  const combinedResults = useMemo(() => {
    const normalisedApiResults = (apiResults || []).map((result) => {
      if (result.type === "job") {
        return {
          ...result,
          href: result.jobNumber ? `/job-cards/${result.jobNumber}` : null,
        };
      }

      if (result.type === "customer") {
        const slugCandidate = createSlugFromResult(result);
        const destination =
          result.href ||
          (slugCandidate ? `/customers/${encodeURIComponent(slugCandidate)}` : null) ||
          (result.customerId ? `/customers/${encodeURIComponent(result.customerId)}` : null) ||
          (result.id ? `/customers/${encodeURIComponent(result.id)}` : null);
        return {
          ...result,
          href: destination,
        };
      }

      if (result.type === "parts_order") {
        const orderId = result.orderNumber || result.jobNumber || "";
        return {
          ...result,
          href: orderId ? `/parts/create-order/${orderId}` : null,
        };
      }

      return result;
    });

    return [...navResults, ...normalisedApiResults];
  }, [navResults, apiResults]);

  const shouldShowFeedback =
    trimmedQuery.length > 0 &&
    (isLoading || (feedback && (navResults.length === 0 && apiResults.length === 0)));

  const showResults =
    isOpen && combinedResults.length > 0 && !shouldShowFeedback;
  const showEmptyState =
    !isLoading &&
    !combinedResults.length &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    !feedback &&
    !shouldShowFeedback;
  const shouldShowDropdown = shouldShowFeedback || showResults || showEmptyState;

  useEffect(() => {
    if (!containerRef.current) return;
    if (!shouldShowDropdown) return;

    const updatePosition = () => {
      const anchor = controlRef.current || containerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = rect.width;
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 12,
        left: rect.left,
        width,
        right: "auto",
        margin: 0,
        boxSizing: "border-box",
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [shouldShowDropdown, query, navResults.length, apiResults.length]);

  const handleSelect = (item) => {
    if (!item) return;

    const partsOrderDestination =
      item.type === "parts_order"
        ? (() => {
            const orderId = item.orderNumber || item.jobNumber || null;
            return orderId ? `/parts/create-order/${encodeURIComponent(orderId)}` : null;
          })()
        : null;

    const destination = partsOrderDestination || item.href;

    if (!destination) {
      setFeedback("No destination found for that item.");
      return;
    }

    const normalisedDestination = (() => {
      if (typeof destination !== "string") return destination;
      if (/^https?:\/\//i.test(destination)) return destination;
      if (destination.startsWith("/")) return destination;
      return `/${destination.replace(/^\/+/, "")}`;
    })();

    setQuery("");
    setIsOpen(false);
    setApiResults([]);
    setNavResults([]);
    setActiveIndex(0);

    router.push(normalisedDestination);
  };

  const handleKeyDown = (event) => {
    if (!showResults || combinedResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % combinedResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev === 0 ? combinedResults.length - 1 : prev - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(combinedResults[activeIndex] || combinedResults[0]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const searchBackground = isDarkMode
    ? "rgba(var(--primary-rgb), 0.14)"
    : "rgba(var(--primary-rgb), 0.08)";
  const dropdownBackground = "var(--layer-section-level-2)";
  const baseBorderColor = isDarkMode
    ? "rgba(var(--primary-rgb), 0.5)"
    : "rgba(var(--primary-rgb), 0.35)";
  const borderColor = isFocused ? accentColor : baseBorderColor;
  const textColor = isDarkMode ? "var(--search-text)" : "var(--text-primary)";
  const placeholderColor = isDarkMode ? "rgba(var(--primary-rgb), 0.7)" : "rgba(var(--primary-rgb), 0.7)";
  const drawerBorderColor = isDarkMode ? "rgba(var(--accent-purple-rgb), 0.45)" : "var(--surface)";

  const dropdownZIndex = 2147483647;
  const dropdownContent =
    shouldShowDropdown && dropdownStyle ? (
      <div
        ref={dropdownRef}
        style={{
          ...dropdownStyle,
          zIndex: dropdownZIndex,
          pointerEvents: "auto",
        }}
      >
        {shouldShowFeedback && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              backgroundColor: dropdownBackground,
              border: `1px solid ${drawerBorderColor}`,
              boxShadow: "none",
              color: textColor,
              fontSize: "0.85rem",
            }}
          >
            {isLoading ? "Searching…" : feedback}
          </div>
        )}

        {showResults && (
          <div
            style={{
              backgroundColor: dropdownBackground,
              borderRadius: "16px",
              boxShadow: "none",
              border: `1px solid ${drawerBorderColor}`,
              overflow: "hidden",
              maxHeight: "280px",
              overflowY: "auto",
            }}
          >
            {combinedResults.map((item, index) => {
              const active = index === activeIndex;
              const chipLabel = typeLabels[item.type] || "Result";
              const itemBackground = active
                ? "rgba(var(--primary-rgb), 0.14)"
                : "transparent";
              const itemColor = active ? accentColor : textColor;

              return (
                <button
                  key={`${item.type}-${item.title}-${index}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                      borderBottom:
                        index === combinedResults.length - 1
                        ? "none"
                        : `1px solid ${isDarkMode ? "rgba(var(--primary-rgb), 0.3)" : "rgba(var(--primary-rgb), 0.14)"}`,
                    backgroundColor: itemBackground,
                    color: itemColor,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: isDarkMode ? "var(--border)" : "var(--grey-accent)",
                        }}
                      >
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      backgroundColor: active ? accentColor : "rgba(var(--primary-rgb), 0.12)",
                      color: active ? "var(--text-inverse)" : "var(--primary-dark)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {chipLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showEmptyState && (
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: dropdownBackground,
              border: `1px solid ${drawerBorderColor}`,
              boxShadow: "none",
              color: textColor,
              fontSize: "0.85rem",
            }}
          >
            No matches — try another term.
          </div>
        )}
      </div>
    ) : null;
  const dropdownPortal = portalRoot
    ? createPortal(dropdownContent, portalRoot)
    : dropdownContent;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", maxWidth: "100%", zIndex: dropdownZIndex }}
    >
      <div
        ref={controlRef}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: searchBackground,
          border: `1px solid ${borderColor}`,
          borderRadius: "999px",
          padding: "3px 8px",
          boxShadow: isFocused
            ? "0 0 0 2px rgba(var(--primary-rgb), 0.22)"
            : "0 1px 0 rgba(var(--primary-rgb), 0.1)",
          transition: "all 0.2s ease",
        }}
      >
        <input
          type="search"
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (navResults.length > 0 || apiResults.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Gloable Search"
          style={{
            flex: 1,
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              color: textColor,
              fontSize: "0.84rem",
          }}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setApiResults([]);
              setNavResults([]);
              setFeedback("Search job numbers, customers, registrations…");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: placeholderColor,
            }}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {dropdownPortal}
    </div>
  );
};

export default GlobalSearch;
