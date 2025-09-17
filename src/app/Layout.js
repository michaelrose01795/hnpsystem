// src/app/Layout.js
import Link from "next/link"; // import Next.js Link for client-side navigation
import "./Layout.css"; // import CSS for sidebar, layout, and main content styling

export default function Layout({ children }) {
  return (
    <div className="layout-container"> {/* main flex container wrapping sidebar + content */}

      {/* Sidebar navigation */}
      <aside className="sidebar">
        <h2>H&P System</h2> {/* sidebar title / logo */}
        <nav>
          <ul> {/* navigation menu list */}
            <li><Link href="/">Home</Link></li> {/* link to Home page */}
            <li><Link href="/accounts">Accounts</Link></li> {/* link to Accounts page */}
            <li><Link href="/jobs">Jobs</Link></li> {/* link to Jobs/Workshop page */}
            <li><Link href="/parts">Parts</Link></li> {/* link to Parts page */}
            <li><Link href="/dashboard">Dashboard</Link></li> {/* link to Dashboard page */}
            <li><Link href="/vhc">VHC / Checks</Link></li> {/* link to Vehicle Health Checks */}
            <li><Link href="/sales">Sales</Link></li> {/* link to Sales page */}
            <li><Link href="/reports">Reports</Link></li> {/* link to Reports page */}
            <li><Link href="/messages">Messages</Link></li> {/* link to Messages page */}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="main-content">
        <header className="header">Humphries & Parks System</header> {/* top header text */}

        <main className="content">
          {children} {/* page-specific content is rendered here */}
        </main>

        <footer className="footer">
          &copy; {new Date().getFullYear()} Humphries & Parks {/* footer with current year */}
        </footer>
      </div>

    </div>
  );
}
