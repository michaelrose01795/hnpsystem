export const adminUsersSlide = {
  id: "admin-users",
  route: "/admin/users",
  title: "Admin: Users",
  roles: null,
  workflowIndex: 32,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Staff list and access",
      body: "The admin manager adds, suspends or re-roles staff here. The roles set on this page drive what each user can see in the rest of the system.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Audit-ready",
      body: "Role changes and account toggles are timestamped — useful when joiners and leavers come up in compliance reviews.",
    },
  ],
};
