"use client";
import { createContext, useContext, useState } from "react";

// Define roles: Admin, Accounts, Sales, Workshop, ServiceReception, Valet, MOT, Contractors
const roles = {
  ADMIN: "Admin",
  ACCOUNTS: "Accounts",
  SALES: "Sales",
  WORKSHOP: "Workshop",
  SERVICE: "ServiceReception",
  VALET: "Valet",
  MOT: "MOT",
  CONTRACTOR: "Contractor"
};

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // Example: current user with a role
  const [user, setUser] = useState({
    name: "Alice",
    role: roles.ADMIN // Change role to test access
  });

  const hasAccess = (allowedRoles) => {
    return allowedRoles.includes(user.role);
  };

  return (
    <UserContext.Provider value={{ user, setUser, roles, hasAccess }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);