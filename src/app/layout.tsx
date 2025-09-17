// src/app/layout.tsx
"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useEffect, useState, ReactNode } from "react";
import keycloak from "../auth/keycloak"; // make sure filename matches exactly

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    keycloak
      .init({ onLoad: "login-required", checkLoginIframe: false })
      .then((auth) => setIsAuthenticated(auth))
      .catch((err) => console.error("Keycloak init error:", err));
  }, []);

  if (!isAuthenticated) {
    return (
      <div
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ padding: "40px", textAlign: "center" }}
      >
        <h1>Loading authentication...</h1>
      </div>
    );
  }

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </div>
  );
}
