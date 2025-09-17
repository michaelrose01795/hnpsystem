// src/components/Layout.tsx
import React from "react"; // import React for JSX support
import Link from "next/link"; // import Next.js Link component for client-side navigation
import "./Layout.css"; // import CSS for styling, make sure this file exists

interface LayoutProps { 
  children: React.ReactNode; // define type for children passed into the layout
}

export default function Layout({ children }: LayoutProps) { // functional component accepting children
  return (
    <div className="layout-container"> {/* main wrapper for sidebar + content, uses flex layout */}

      <aside className="sidebar"> {/* sidebar navigation panel */}
        <h2>H&P System</h2> {/* sidebar title */}
        <nav> {/* navigation section */}
          <ul> {/* list of navigation links */}
            <li><Link href="/">Home</Link></li> {/* link to Home page */}
            <li><Link href="/accounts">Accounts</Link></li> {/* link to Accounts page */}
            <li><Link href="/jobs">Jobs</Link></li> {/* link to Jobs page */}
            <li><Link href="/parts">Parts</Link></li> {/* link to Parts page */}
            <li><Link href="/dashboard">Dashboard</Link></li> {/* link to Dashboard page */}
          </ul>
        </nav>
      </aside>

      <div className="main-content"> {/* main content area next to sidebar */}
        <header className="header">Humphries & Parks System</header> {/* header at top of content */}
        <main className="content">{children}</main> {/* main page content injected here */}
        <footer className="footer">&copy; {new Date().getFullYear()} Humphries & Parks</footer> {/* footer with current year */}
      </div>

    </div>
  );
}
