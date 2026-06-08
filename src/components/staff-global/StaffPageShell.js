// file location: src/components/staff-global/StaffPageShell.js
// Staff page layout wrapper. It provides a consistent shell/header/stack for
// staff pages without moving page-specific state or business logic.
import React from "react";

export default function StaffPageShell({
  title,
  subtitle,
  actions,
  children,
  className = "",
  stackClassName = "",
  ...rest
}) {
  return (
    <main className={`staff-page-shell app-page-shell ${className}`.trim()} {...rest}>
      {(title || subtitle || actions) ? (
        <header className="staff-page-header">
          <div className="staff-page-heading">
            {title ? <h1 className="staff-page-title">{title}</h1> : null}
            {subtitle ? <p className="staff-page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="staff-page-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`staff-page-stack app-page-stack ${stackClassName}`.trim()}>
        {children}
      </div>
    </main>
  );
}
