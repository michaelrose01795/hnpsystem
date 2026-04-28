// file location: src/config/navigation.js

export const sidebarSections = [
  {
    label: "General",
    category: "general",
    items: [
      { label: "News Feed", href: "/newsfeed", roles: [] },
      {
        label: "Retail Dashboard",
        href: "/dashboard",
        roles: ["service manager", "workshop manager", "after sales director"],
      },
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
      {
        label: "Archive Job",
        href: "/job-cards/archive",
        roles: [],
      },
    ],
  },
  {
    label: "Admin Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["admin manager"],
      },
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["admin manager"],
      },
      {
        label: "User Admin",
        href: "/admin/users",
        roles: ["admin manager"],
      },
    ],
  },
  {
    label: "Owner",
    category: "departments",
    items: [
      {
        label: "HR Manager",
        href: "/hr/manager",
        roles: ["owner"],
      },
      {
        label: "User Admin",
        href: "/admin/users",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Service",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["service"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["service"],
      },
      {
        label: "New Mobile Job",
        href: "/mobile/create",
        roles: ["service"],
      },
    ],
  },
  {
    label: "Service Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["service manager"],
      },
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["service manager"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["service manager"],
      },
      {
        label: "Mobile Appointments",
        href: "/mobile/appointments",
        roles: ["service manager"],
      },
      {
        label: "New Mobile Job",
        href: "/mobile/create",
        roles: ["service manager"],
      },
    ],
  },
  {
    label: "Workshop Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["workshop manager"],
      },
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["workshop manager"],
      },
      {
        label: "Clocking",
        href: "/clocking",
        roles: ["workshop manager"],
      },
      {
        label: "Consumables Tracker", // Workshop consumable planning workspace
        href: "/workshop/consumables-tracker",
        roles: ["workshop manager"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["workshop manager"],
      },
    ],
  },
  {
    label: "Aftersales Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/job-cards/waiting/nextjobs",
        roles: ["aftersales manager"],
      },
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["aftersales manager"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["aftersales manager"],
      },
    ],
  },
  {
    label: "Techs",
    category: "departments",
    items: [
      {
        label: "My Jobs",
        href: "/job-cards/myjobs",
        roles: ["techs"],
      },
      {
        label: "Request Consumables", // Technician consumable request portal
        href: "/tech/consumables-request",
        roles: ["techs"],
      },
      {
        label: "Efficiency",
        href: "/tech/efficiency",
        roles: ["techs"],
      },
    ],
  },
  {
    label: "Mobile Technician",
    category: "departments",
    items: [
      {
        label: "Mobile Dashboard",
        href: "/mobile/dashboard",
        roles: ["mobile technician"],
      },
      {
        label: "My Mobile Jobs",
        href: "/mobile/jobs",
        roles: ["mobile technician"],
      },
      {
        label: "Mobile Appointments",
        href: "/mobile/appointments",
        roles: ["mobile technician"],
      },
      {
        label: "Request Parts",
        href: "/tech/consumables-request",
        roles: ["mobile technician"],
      },
      {
        label: "New Mobile Job",
        href: "/mobile/create",
        roles: ["mobile technician"],
      },
    ],
  },
  {
    label: "MOT Tester",
    category: "departments",
    items: [
      {
        label: "My Jobs",
        href: "/job-cards/myjobs",
        roles: ["mot tester"],
      },
      {
        label: "Efficiency",
        href: "/tech/efficiency",
        roles: ["mot tester"],
      },
    ],
  },
  {
    label: "Parts",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["parts"],
      },
      {
        label: "Stock Catalogue",
        href: "/stock-catalogue",
        roles: ["parts"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["parts"],
      },
      {
        label: "Deliveries",
        href: "/parts/deliveries",
        roles: ["parts"],
      },
    ],
  },
  {
    label: "Parts Manager",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/job-cards/view",
        roles: ["parts manager"],
      },
      {
        label: "Stock Catalogue",
        href: "/stock-catalogue",
        roles: ["parts manager"],
      },
      {
        label: "Goods In",
        href: "/parts/goods-in",
        roles: ["parts manager"],
      },
      {
        label: "Deliveries",
        href: "/parts/deliveries",
        roles: ["parts manager"],
      },
      {
        label: "Parts Manager Dashboard",
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
        label: "Valet Jobs",
        href: "/valet",
        roles: ["valet service"],
      },
    ],
  },
  {
    label: "Accounts Manager",
    category: "departments",
    items: [
      {
        label: "Payslips",
        href: "/accounts/payslips",
        roles: ["accounts", "accounts manager", "admin", "admin manager", "owner"],
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
