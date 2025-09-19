"use client";
import { createContext, useContext, useState } from "react";

export const roles = {
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
  const [user, setUser] = useState({
    name: "Alice",
    role: roles.ADMIN
  });

  const hasAccess = (allowedRoles) => allowedRoles.includes(user.role);

  return (
    <UserContext.Provider value={{ user, setUser, roles, hasAccess }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);