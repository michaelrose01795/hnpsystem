// file location: src/components/GlobalSearch.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

const MIN_QUERY_LENGTH = 2;

const typeLabels = {
  job: "Job Card",
  customer: "Customer",
  navigation: "Navigation",
  parts_order: "Parts Order",
};

const GlobalSearch = ({
  accentColor = "var(--primary)",
  isDarkMode = false,
  navigationItems = [],
}) => {
  const router = useRouter();
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [apiResults, setApiResults] = useState([]);
  const [navResults, setNavResults] = useState([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(0);
      }
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
        return {
          ...result,
          href: result.jobNumber ? `/job-cards/${result.jobNumber}` : null,
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
    if (!isOpen || combinedResults.length === 0) return;

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

  const searchBackground = isDarkMode ? "var(--search-surface)" : "var(--surface)";
  const baseBorderColor = isDarkMode ? "rgba(var(--accent-purple-rgb), 0.65)" : "var(--surface-light)";
  const borderColor = isFocused ? accentColor : baseBorderColor;
  const textColor = isDarkMode ? "var(--search-text)" : "var(--text-primary)";
  const placeholderColor = isDarkMode ? "rgba(10, 10, 12, 0.6)" : "var(--border)";
  const drawerBorderColor = isDarkMode ? "rgba(var(--accent-purple-rgb), 0.45)" : "var(--surface)";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", maxWidth: "480px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: searchBackground,
          border: `1px solid ${borderColor}`,
          borderRadius: "999px",
          padding: "8px 12px",
          boxShadow: "none",
          transition: "all 0.2s ease",
        }}
      >
        <input
          type="search"
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
          placeholder="Search jobs, customers, buttons..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
              backgroundColor: "transparent",
              color: textColor,
              fontSize: "0.95rem",
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
              fontSize: "0.9rem",
              color: placeholderColor,
            }}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {shouldShowFeedback && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            left: 0,
            right: 0,
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: searchBackground,
            border: `1px solid ${drawerBorderColor}`,
            boxShadow: "none",
            color: textColor,
            fontSize: "0.85rem",
            zIndex: 30,
          }}
        >
          {isLoading ? "Searching…" : feedback}
        </div>
      )}

      {isOpen && combinedResults.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            left: 0,
            right: 0,
            backgroundColor: searchBackground,
            borderRadius: "16px",
            boxShadow: "none",
            border: `1px solid ${drawerBorderColor}`,
            overflow: "hidden",
            zIndex: 40,
          }}
        >
          {combinedResults.map((item, index) => {
            const active = index === activeIndex;
            const chipLabel = typeLabels[item.type] || "Result";
            const itemBackground = active
              ? `${accentColor}14`
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
                      : `1px solid ${isDarkMode ? "rgba(var(--accent-purple-rgb), 0.3)" : "var(--surface)"}`,
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
                    backgroundColor: active ? accentColor : "var(--search-surface-muted)",
                    color: active ? "var(--surface)" : textColor,
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

      {!isLoading &&
        !combinedResults.length &&
        trimmedQuery.length >= MIN_QUERY_LENGTH &&
        !feedback && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 12px)",
              left: 0,
              right: 0,
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: searchBackground,
              border: `1px solid ${drawerBorderColor}`,
              boxShadow: "none",
              color: textColor,
              fontSize: "0.85rem",
              zIndex: 30,
            }}
          >
            No matches — try another term.
          </div>
        )}
    </div>
  );
};

export default GlobalSearch;
