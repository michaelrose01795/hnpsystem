// file location: src/config/navigation.js

export const sidebarSections = [
  {
    label: "General",
    items: [
      { label: "Home", href: "/", roles: [] },
      { label: "News Feed", href: "/newsfeed", roles: [] },
      { label: "Dashboard", href: "/dashboard", roles: [] },
      { label: "Messages", href: "/messages", roles: [] },
    ],
  },
  {
    label: "Workshop",
    items: [
      { label: "Create Job Card", href: "/job-cards/create", roles: ["admin", "sales", "workshop", "service", "manager"] },
      { label: "View Job Cards", href: "/job-cards/view", roles: ["admin", "sales", "workshop", "service", "manager"] },
      { label: "Next Jobs", href: "/job-cards/waiting/nextjobs", roles: ["service manager", "workshop manager"] },
      { label: "VHC Dashboard", href: "/vhc", roles: ["techs", "service", "manager", "workshop manager"] },
      {
        label: "Tracking",
        href: "/tracking",
        roles: [
          "techs",
          "service",
          "service manager",
          "workshop manager",
          "valet service",
          "admin",
        ],
      },
      { label: "Smart Repair", href: "/smartrepair", roles: ["workshop"] },
    ],
  },
  {
    label: "Sales & Service",
    items: [
      { label: "Car Buying", href: "/car-buying", roles: ["admin", "sales", "workshop"] },
      { label: "Appointments", href: "/appointments", roles: ["admin", "sales", "service", "manager"] },
      { label: "Vehicle Processing", href: "/vehicle-processing", roles: ["admin", "workshop"] },
    ],
  },
  {
    label: "Parts",
    items: [
      { label: "Parts Workspace", href: "/parts", roles: ["parts", "parts manager"] },
      { label: "Parts Manager Overview", href: "/parts/manager", roles: ["parts manager"] },
      { label: "VHC Dashboard", href: "/vhc/dashboard", roles: ["parts", "parts manager"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Admin User Management", href: "/admin/users", roles: ["admin manager", "admin", "owner"] },
      { label: "Contractors", href: "/contractors", roles: ["admin"] },
    ],
  },
];
