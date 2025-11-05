// src/config/navLinks.js
export const navLinksByRole = {
  Admin: [{ href: "/dashboard", label: "Dashboard" }, { href: "/users", label: "User Management" }],
  "Admin Manager": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/users", label: "User Management" },
    { href: "/reports", label: "Reports" },
    { href: "/workshop/Clocking", label: "Clocking System" }, // cross-role visibility
  ],
  Accounts: [{ href: "/dashboard", label: "Dashboard" }, { href: "/accounts", label: "Accounts Overview" }],
  "Accounts Manager": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/accounts", label: "Accounts Overview" },
    { href: "/reports", label: "Reports" },
  ],
  Owner: [{ href: "/dashboard", label: "Dashboard" }],
  "General Manager": [{ href: "/dashboard", label: "Dashboard" }, { href: "/overview", label: "Overview" }],
  "Sales Director": [{ href: "/dashboard", label: "Dashboard" }, { href: "/sales", label: "Sales Tracking" }],
  Sales: [{ href: "/dashboard", label: "Dashboard" }, { href: "/sales", label: "My Sales" }],
  Service: [{ href: "/dashboard", label: "Dashboard" }, { href: "/jobs", label: "Job Cards" }],
  "Service Manager": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/jobs", label: "All Jobs" },
    { href: "/workshop/Clocking", label: "Clocking System" },
  ],
  "Workshop Manager": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/jobs", label: "All Jobs" },
    { href: "/workshop/Clocking", label: "Clocking System" },
  ],
  Techs: [{ href: "/dashboard", label: "Dashboard" }, { href: "/jobs", label: "My Jobs" }],
  Parts: [{ href: "/dashboard", label: "Dashboard" }, { href: "/parts", label: "My Parts" }],
  "Parts Manager": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/parts", label: "Parts Workspace" },
    { href: "/parts/manager", label: "Manager Overview" },
  ],
  "MOT Tester": [{ href: "/dashboard", label: "Dashboard" }, { href: "/mot", label: "MOT Testing" }],
  "Valet Service": [{ href: "/dashboard", label: "Dashboard" }, { href: "/valet", label: "Valet Jobs" }],
  "Valet Sales": [{ href: "/dashboard", label: "Dashboard" }, { href: "/valet/sales", label: "Valet Sales" }],
  "Buying Director": [{ href: "/dashboard", label: "Dashboard" }, { href: "/buying", label: "Buying Overview" }],
  "Second Hand Buying": [{ href: "/dashboard", label: "Dashboard" }, { href: "/buying/used", label: "Used Cars" }],
  "Vehicle Processor & Photographer": [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/vehicle/processing", label: "Vehicle Processing" },
    { href: "/vehicle/photos", label: "Photos" },
  ],
  Receptionist: [{ href: "/dashboard", label: "Dashboard" }, { href: "/appointments", label: "Appointments" }],
  Painters: [{ href: "/dashboard", label: "Dashboard" }, { href: "/painting", label: "Painting Jobs" }],
  Contractors: [{ href: "/dashboard", label: "Dashboard" }, { href: "/contracts", label: "Contract Jobs" }],
};
