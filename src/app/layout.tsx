// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google"; // import Google fonts via Next.js
import "./globals.css"; // global CSS for base styles and utilities
import { AuthProvider } from "./AuthContext"; // context provider for authentication (wraps app)
import TopBar from "./login/topbar/TopBar"; // top navigation bar component (login/logout links)

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
    <AuthProvider> {/* provides auth context to all children */}
      <html lang="en"> {/* HTML root element with language */}
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {/* apply loaded fonts via CSS variables and smooth text rendering */}

          {/* Top navigation bar with login/logout */}
          <TopBar />

          {/* Main page content (children pages rendered here) */}
          <main>{children}</main>
        </body>
      </html>
    </AuthProvider>
  );
}
