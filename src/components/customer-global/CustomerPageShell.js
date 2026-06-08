// file location: src/components/customer-global/CustomerPageShell.js
// Customer page layout wrapper for customer-facing screens and previews.
import React from "react";

export default function CustomerPageShell({
  title,
  subtitle,
  actions,
  children,
  className = "",
  stackClassName = "",
  ...rest
}) {
  return (
    <main className={`customer-page-shell ${className}`.trim()} {...rest}>
      {(title || subtitle || actions) ? (
        <header className="customer-page-header">
          <div className="customer-page-heading">
            {title ? <h1 className="customer-page-title">{title}</h1> : null}
            {subtitle ? <p className="customer-page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="customer-page-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`customer-page-stack ${stackClassName}`.trim()}>{children}</div>
    </main>
  );
}
