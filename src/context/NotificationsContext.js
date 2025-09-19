"use client";
import { createContext, useContext, useState } from "react";

const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = "info") => {
    setNotifications(prev => [...prev, { id: Date.now(), message, type, read: false }]);
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <NotificationsContext.Provider value={{ notifications, addNotification, markAsRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);