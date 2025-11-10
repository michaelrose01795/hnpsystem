// file location: src/config/navigation.js

export const sidebarSections = [
  {
    label: "General",
    category: "general",
    items: [
      { label: "News Feed", href: "/newsfeed", roles: [] },
      { label: "Dashboard", href: "/dashboard", roles: [] },
      { label: "Messages", href: "/messages", roles: [] },
      {
        label: "Tracker",
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
    ],
  },
  {
    label: "Admin Manager",
    category: "departments",
    items: [
      {
        label: "➕ Create Job Card",
        href: "/job-cards/create",
        roles: ["admin manager"],
      },
      {
        label: "🔜 Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["admin manager"],
      },
      {
        label: "👀 View Job Card",
        href: "/job-cards/view",
        roles: ["admin manager"],
      },
      {
        label: "📅 Appointments",
        href: "/appointments",
        roles: ["admin manager"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["admin manager"],
      },
      {
        label: "👥 HR Dashboard",
        href: "/hr",
        roles: ["admin manager"],
      },
      {
        label: "📨 Recruitment",
        href: "/hr/recruitment",
        roles: ["admin manager"],
      },
      {
        label: "📈 HR Reports",
        href: "/hr/reports",
        roles: ["admin manager"],
      },
      {
        label: "⚙️ HR Settings",
        href: "/hr/settings",
        roles: ["admin manager"],
      },
      {
        label: "👥 Team HR",
        href: "/hr/employees",
        roles: ["admin manager"],
      },
      {
        label: "🛠️ User Admin",
        href: "/admin/users",
        roles: ["admin manager"],
      },
      {
        label: "🛎️ Workshop Check-In",
        href: "/workshop/check-in",
        roles: ["admin manager"],
      },
    ],
  },
  {
    label: "Service",
    category: "departments",
    items: [
      {
        label: "➕ Create Job Card",
        href: "/job-cards/create",
        roles: ["service"],
      },
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["service"],
      },
      {
        label: "📅 Appointments",
        href: "/appointments",
        roles: ["service"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["service"],
      },
      {
        label: "🛎️ Workshop Check-In",
        href: "/workshop/check-in",
        roles: ["service"],
      },
    ],
  },
  {
    label: "Service Manager",
    category: "departments",
    items: [
      {
        label: "➕ Create Job Card",
        href: "/job-cards/create",
        roles: ["service manager"],
      },
      {
        label: "🔜 Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["service manager"],
      },
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["service manager"],
      },
      {
        label: "📅 Appointments",
        href: "/appointments",
        roles: ["service manager"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["service manager"],
      },
      {
        label: "🛎️ Workshop Check-In",
        href: "/workshop/check-in",
        roles: ["service manager"],
      },
    ],
  },
  {
    label: "Workshop Manager",
    category: "departments",
    items: [
      {
        label: "➕ Create Job Card",
        href: "/job-cards/create",
        roles: ["workshop manager"],
      },
      {
        label: "🔜 Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["workshop manager"],
      },
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["workshop manager"],
      },
      {
        label: "📅 Appointments",
        href: "/appointments",
        roles: ["workshop manager"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["workshop manager"],
      },
      {
        label: "🛎️ Workshop Check-In",
        href: "/workshop/check-in",
        roles: ["workshop manager"],
      },
    ],
  },
  {
    label: "Aftersales Manager",
    category: "departments",
    items: [
      {
        label: "➕ Create Job Card",
        href: "/job-cards/create",
        roles: ["aftersales manager"],
      },
      {
        label: "🔜 Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["aftersales manager"],
      },
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["aftersales manager"],
      },
      {
        label: "📅 Appointments",
        href: "/appointments",
        roles: ["aftersales manager"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["aftersales manager"],
      },
      {
        label: "🛎️ Workshop Check-In",
        href: "/workshop/check-in",
        roles: ["aftersales manager"],
      },
    ],
  },
  {
    label: "Techs",
    category: "departments",
    items: [
      {
        label: "🧰 My Jobs",
        href: "/job-cards/myjobs",
        roles: ["techs"],
      },
    ],
  },
  {
    label: "MOT Tester",
    category: "departments",
    items: [
      {
        label: "🧰 My Jobs",
        href: "/job-cards/myjobs",
        roles: ["mot tester"],
      },
    ],
  },
  {
    label: "Parts",
    category: "departments",
    items: [
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["parts"],
      },
      {
        label: "🧰 Parts Workspace",
        href: "/parts",
        roles: ["parts"],
      },
      {
        label: "📝 VHC Dashboard",
        href: "/vhc/dashboard",
        roles: ["parts"],
      },
    ],
  },
  {
    label: "Parts Manager",
    category: "departments",
    items: [
      {
        label: "👀 View Job Cards",
        href: "/job-cards/view",
        roles: ["parts manager"],
      },
      {
        label: "🧰 Parts Workspace",
        href: "/parts",
        roles: ["parts manager"],
      },
      {
        label: "📈 Parts Manager Overview",
        href: "/parts/manager",
        roles: ["parts manager"],
      },
    ],
  },
  {
    label: "Valet Service",
    category: "departments",
    items: [
      {
        label: "🧽 Valet Jobs",
        href: "/valet",
        roles: ["valet service"],
      },
    ],
  },
  {
    label: "Account",
    category: "account",
    items: [
      { label: "Profile", href: "/profile", roles: [] },
      { label: "Logout", href: null, roles: [], action: "logout" },
    ],
  },
];
