// file location: src/components/ui/StaffShowcasePrimitives.js
// Canonical staff UI primitives for common DMS page patterns.
import React from "react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import LayerSurface from "./LayerSurface";
import LayerTheme from "./LayerTheme";
import ModalPortal from "@/components/popups/ModalPortal";

const toneClass = (base, tone) => `${base} ${base}--${tone || "neutral"}`;

export function StaffPagination({
  page = 1,
  pageCount = 1,
  onPrevious,
  onNext,
  onPageChange,
  label = "Pagination",
}) {
  const pages = Array.from({ length: Math.max(1, pageCount) }, (_, index) => index + 1);

  return (
    <nav className="app-pagination" aria-label={label}>
      <Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={onPrevious}>
        Previous
      </Button>
      <div className="app-pagination__pages">
        {pages.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={item === page ? "primary" : "secondary"}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange?.(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" variant="secondary" disabled={page >= pageCount} onClick={onNext}>
        Next
      </Button>
    </nav>
  );
}

export function StaffModal({
  open,
  title,
  description,
  children,
  footer,
  headerActions,
  onClose,
  ariaLabel,
  size = "md",
}) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="app-modal" role="presentation">
        <LayerSurface
          className={`app-modal__panel app-modal__panel--${size}`}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
        >
          <header className="app-modal__header">
            <div className="app-modal__heading">
              {title && <h2 className="app-modal__title">{title}</h2>}
              {description && <p className="app-modal__description">{description}</p>}
            </div>
            {(onClose || headerActions) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                {onClose && (
                  <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                    Close
                  </Button>
                )}
                {headerActions}
              </div>
            )}
          </header>
          <div className="app-modal__body">{children}</div>
          {footer && <footer className="app-modal__footer">{footer}</footer>}
        </LayerSurface>
      </div>
    </ModalPortal>
  );
}

export function StaffDrawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  ariaLabel,
  side = "right",
}) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className={`app-drawer app-drawer--${side}`} role="presentation">
        <LayerSurface
          className="app-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
        >
          <header className="app-drawer__header">
            <div className="app-drawer__heading">
              {title && <h2 className="app-drawer__title">{title}</h2>}
              {description && <p className="app-drawer__description">{description}</p>}
            </div>
            {onClose && (
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </header>
          <div className="app-drawer__body">{children}</div>
          {footer && <footer className="app-drawer__footer">{footer}</footer>}
        </LayerSurface>
      </div>
    </ModalPortal>
  );
}

export function StaffFilterBar({ children, actions, className = "" }) {
  return (
    <LayerTheme className={`app-filter-bar ${className}`.trim()}>
      <div className="app-filter-bar__controls">{children}</div>
      {actions && <div className="app-filter-bar__actions">{actions}</div>}
    </LayerTheme>
  );
}

// Thin alias kept for backward compatibility — delegates to the canonical
// EmptyState primitive so there is a single implementation (Phase 7).
export function StaffEmptyState({ title, description, action, icon, secondaryAction, variant = "inline" }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      variant={variant}
    />
  );
}

export function StaffAlert({ tone = "info", title, children, action }) {
  return (
    <div className={toneClass("app-alert", tone)} role={tone === "danger" ? "alert" : "status"}>
      <div className="app-alert__copy">
        {title && <strong className="app-alert__title">{title}</strong>}
        {children && <span className="app-alert__body">{children}</span>}
      </div>
      {action && <div className="app-alert__action">{action}</div>}
    </div>
  );
}

export function StaffVhcItemRow({ area, note, result, tone = "neutral", meta, action }) {
  return (
    <div className={toneClass("app-vhc-row", tone)}>
      <div className="app-vhc-row__main">
        <strong className="app-vhc-row__area">{area}</strong>
        {note && <span className="app-vhc-row__note">{note}</span>}
        {meta && <span className="app-vhc-row__meta">{meta}</span>}
      </div>
      <div className="app-vhc-row__status">
        {result && <span className={`app-badge app-badge--control app-badge--${tone}`}>{result}</span>}
        {action}
      </div>
    </div>
  );
}

export function StaffPartsRequestRow({ part, quantity, status, tone = "neutral", owner, meta, action }) {
  return (
    <div className={toneClass("app-parts-request-row", tone)}>
      <div className="app-parts-request-row__main">
        <strong className="app-parts-request-row__part">{part}</strong>
        <span className="app-parts-request-row__meta">
          {quantity ? `${quantity} x ` : ""}
          {owner || meta}
        </span>
      </div>
      <div className="app-parts-request-row__status">
        {status && <span className={`app-badge app-badge--control app-badge--${tone}`}>{status}</span>}
        {action}
      </div>
    </div>
  );
}

export function StaffJobSummaryPanel({
  title,
  subtitle,
  meta = [],
  stats = [],
  children,
  action,
}) {
  return (
    <LayerSurface className="app-job-summary-panel">
      <header className="app-job-summary-panel__header">
        <div className="app-job-summary-panel__identity">
          {title && <h3 className="app-job-summary-panel__title">{title}</h3>}
          {subtitle && <p className="app-job-summary-panel__subtitle">{subtitle}</p>}
        </div>
        {action && <div className="app-job-summary-panel__action">{action}</div>}
      </header>
      {meta.length > 0 && (
        <dl className="app-job-summary-panel__meta">
          {meta.map((item) => (
            <div key={item.label} className="app-job-summary-panel__meta-item">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats.length > 0 && (
        <div className="app-job-summary-panel__stats">
          {stats.map((item) => (
            <LayerTheme key={item.label} className="app-job-summary-panel__stat">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </LayerTheme>
          ))}
        </div>
      )}
      {children && <div className="app-job-summary-panel__body">{children}</div>}
    </LayerSurface>
  );
}

