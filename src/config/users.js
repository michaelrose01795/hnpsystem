// src/config/users.js
import {
  confirmationUsers,
  confirmationUserAliases,
  getConfirmationUser,
} from "./confirmation/user";

export const usersByRole = {
  Admin: ["Alisha", "Zedenca"],
  "Admin Manager": ["Julie"],
  Accounts: ["Ally"],
  "Accounts Manager": ["Paul"],
  Owner: ["Marcus"],
  "General Manager": ["Owen"],
  "Sales Director": ["Sam"],
  Sales: ["Josh", "Brad", "Richard", "Rob"],
  Service: ["Nicola", "Sharna"],
  "Service Manager": ["Darrell"],
  "Workshop Manager": ["Darrell"],
  "After Sales Director": ["Soren"],
  Techs: ["Glen", "Michael", "Jake", "Scott", "Paul", "Cheryl"],
  Parts: ["Alister"],
  "Parts Manager": ["Scott"],
  "MOT Tester": ["Russel", "Jake"],
  "Valet Service": ["Paul"],
  "Valet Sales": ["Alex", "Harvey", "Peter"],
  "Buying Director": ["Bruno"],
  "Second Hand Buying": ["Sophie"],
  "Vehicle Processor & Photographer": ["Grace"],
  Receptionist: ["Carol"],
  Painters: ["Guy 1", "Guy 2"],
  Contractors: ["Smart Repair", "Paints (grey van)", "Dent Man", "Wheel Men", "Windscreen Guy", "Key Guy"],
  Customer: ["Portal Customer"],
};

// Map retail vs sales departments to provide grouped developer login options
export const roleCategories = {
  Retail: [
    "Admin",
    "Admin Manager",
    "Accounts",
    "Accounts Manager",
    "Owner",
    "General Manager",
    "Service",
    "Service Manager",
    "Workshop Manager",
    "After Sales Director",
    "Techs",
    "Parts",
    "Parts Manager",
    "MOT Tester",
    "Valet Service",
    "Receptionist",
    "Painters",
    "Contractors",
  ],
  Sales: [
    "Sales Director",
    "Sales",
    "Valet Sales",
    "Buying Director",
    "Second Hand Buying",
    "Vehicle Processor & Photographer",
    "Receptionist",
    "Painters",
    "Contractors",
  ],
  Customers: ["Customer"],
};

export const usersByRoleDetailed = Object.fromEntries(
  Object.entries(usersByRole).map(([role, list]) => [
    role,
    list.map((name) => {
      const profile =
        getConfirmationUser(name) ||
        getConfirmationUser(confirmationUserAliases[name]) ||
        null;

      const mergedRoles = Array.from(
        new Set([...(profile?.roles || []), role])
      );

      return {
        key: confirmationUserAliases[name] || name,
        name,
        displayName: profile?.displayName || name,
        firstName: profile?.firstName || name.split(" ")[0],
        departments: profile?.departments || [],
        roles: mergedRoles,
        profile,
      };
    }),
  ])
);

export const usersByDepartment = Object.entries(confirmationUsers).reduce((acc, [, profile]) => {
  const displayName = profile.displayName || profile.firstName;
  (profile.departments || []).forEach((department) => {
    if (!department) return;
    if (!acc[department]) acc[department] = [];
    if (!acc[department].includes(displayName)) {
      acc[department].push(displayName);
    }
  });
  return acc;
}, {});

export { confirmationUsers, confirmationUserAliases, getConfirmationUser };
