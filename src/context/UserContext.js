// file location: /src/context/UserContext.js
import React, { createContext, useContext, useState, useEffect } from "react"; // react state + context
import { useSession } from "next-auth/react"; // next-auth session hook

const UserContext = createContext(); // create context

export function UserProvider({ children }) {
  const { data: session } = useSession(); // get keycloak/next-auth session
  const [user, setUser] = useState(null); // store user object

  useEffect(() => {
    if (session?.user) {
      // keycloak login
      setUser({
        username: session.user.name,
        roles: session.user.roles || [], // always array
      });
    }
  }, [session]);

  // fallback dev login
  const devLogin = (username, role) => {
    const dev = {
      username: username || "dev",
      roles: [role?.toUpperCase() || "WORKSHOP"], // force uppercase + array
    };
    setUser(dev);
  };

  return (
    <UserContext.Provider value={{ user, devLogin }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext); // hook to use user context
