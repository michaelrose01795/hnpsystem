// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./AuthContext"; // make sure AuthContext.tsx is in src/app
import TopBar from "./login/topbar/TopBar"; // updated path


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {/* Top navigation bar with login/logout */}
          <TopBar />

          {/* Main page content */}
          <main>{children}</main>
        </body>
      </html>
    </AuthProvider>
  );
}
