// file location: src/components/ui/StaffPageHeader.js
// Standard staff page header: title (+ optional subtitle) on the left, optional
// action controls on the right. Layout/spacing comes from the `.app-page-header`
// class in staffglobal.css (scoped to html.staff-scope) — no inline layout
// styles, so every page gets a consistent header without re-implementing it.
import React from "react";

export default function StaffPageHeader({
  title,
  subtitle,
  actions,
  className = "",
  ...rest
}) {
  return (
    <header className={`app-page-header ${className}`.trim()} {...rest}>
      <div className="app-page-header__text">
        {title && <h1 className="app-page-header__title">{title}</h1>}
        {subtitle && <p className="app-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions ? <div className="app-page-header__actions">{actions}</div> : null}
    </header>
  );
}
