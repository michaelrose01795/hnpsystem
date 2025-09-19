//src/app.Layout.js
"use client";
import "../app/globals.css";
import Layout from "@/components/Layout";
import { UserProvider } from "@/context/UserContext";
import { NotificationsProvider } from "@/context/NotificationsContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <NotificationsProvider>
            <Layout>{children}</Layout>
          </NotificationsProvider>
        </UserProvider>
      </body>
    </html>
  );
}