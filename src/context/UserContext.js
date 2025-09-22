// file location: context/UserContext.js
// context/UserContext.js - provides global user state with login/logout and localStorage persistence

import React, { createContext, useContext, useState, useEffect } from 'react'; // import React and hooks

const UserContext = createContext(null); // create the user context

export function UserProvider({ children }) { // provider component to wrap the app
  const [user, setUser] = useState(null); // in-memory user object: { username, role }

  useEffect(() => { // run once on mount to restore saved user
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('hnp_user') : null; // read from localStorage
      if (raw) setUser(JSON.parse(raw)); // parse and set user if present
    } catch (err) {
      console.error('UserContext: failed to read localStorage', err); // log any error
    }
  }, []); // empty deps → run once

  useEffect(() => { // persist user to localStorage whenever it changes
    try {
      if (typeof window === 'undefined') return; // guard for server-side
      if (user) window.localStorage.setItem('hnp_user', JSON.stringify(user)); // save
      else window.localStorage.removeItem('hnp_user'); // remove on logout
    } catch (err) {
      console.error('UserContext: failed to write localStorage', err); // log errors
    }
  }, [user]); // runs when user changes

  const login = ({ username, role }) => { // login helper to set user
    setUser({ username: username || 'unknown', role: role || 'WORKSHOP' }); // set user (default role fallback)
  };

  const logout = () => { // logout helper to clear user
    setUser(null);
  };

  return ( // provide user and helpers to the app
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

// custom hook for easier consumption
export const useUser = () => {
  return useContext(UserContext); // expose the context value
};