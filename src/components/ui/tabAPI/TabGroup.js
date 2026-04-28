import Link from "next/link";

export function TabGroup({
  items = [],
  value,
  onChange,
  ariaLabel,
  className = "",
  layout = "wrap",
  stretch = false,
  devSectionKey = "",
  devSectionParent = "",
}) {
  const wrapperClassName = [
    "tab-api",
    layout === "grid" ? "tab-api--grid" : "tab-api--wrap",
    stretch && "tab-api--stretch",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={wrapperClassName}
      role="tablist"
      aria-label={ariaLabel}
      {...(devSectionKey
        ? {
            "data-dev-section": "1",
            "data-dev-section-key": devSectionKey,
            "data-dev-section-type": "tab-row",
            "data-dev-background-token": "tab-api",
            ...(devSectionParent ? { "data-dev-section-parent": devSectionParent } : {}),
          }
        : {})}
    >
      {items.map((item) => {
        const itemValue = item.value ?? item.key ?? item.label;
        const isActive = itemValue === value;
        const itemDevSectionKey = item.devSectionKey || (devSectionKey ? `${devSectionKey}-${String(itemValue)}` : "");
        return (
          <button
            key={String(itemValue)}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-api__item${isActive ? " is-active" : ""}${item.className ? ` ${item.className}` : ""}`}
            onClick={() => onChange?.(itemValue, item)}
            {...(itemDevSectionKey
              ? {
                  "data-dev-section": "1",
                  "data-dev-section-key": itemDevSectionKey,
                  "data-dev-section-type": "tab-button",
                  "data-dev-section-parent": devSectionKey,
                  "data-dev-background-token": isActive ? "tab-api-active" : "tab-api-button",
                }
              : {})}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabLinkGroup({
  items = [],
  isActive,
  ariaLabel,
  className = "",
  layout = "wrap",
  stretch = false,
}) {
  const wrapperClassName = [
    "tab-api",
    layout === "grid" ? "tab-api--grid" : "tab-api--wrap",
    stretch && "tab-api--stretch",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={wrapperClassName} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = Boolean(isActive?.(item));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`tab-api__item${active ? " is-active" : ""}${item.className ? ` ${item.className}` : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
