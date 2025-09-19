// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google"; // import Google fonts via Next.js
import "./globals.css"; // global CSS for base styles and utilities
import { UserProvider } from "../context/UserContext"; // ✅ use UserProvider directly
import TopBar from "./login/topbar/TopBar"; // top navigation bar component

// Load Geist Sans font and assign it to a CSS variable
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Load Geist Mono font and assign it to a CSS variable
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// RootLayout wraps the entire app
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider> {/* ✅ provides user context to all children */}
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <TopBar />
          <main>{children}</main>
        </body>
      </html>
    </UserProvider>
  );
}