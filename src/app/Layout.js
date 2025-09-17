import Link from "next/link";
import "./Layout.css";

export default function Layout({ children }) {
  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2>H&P System</h2>
        <nav>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/accounts">Accounts</Link></li>
            <li><Link href="/jobs">Jobs</Link></li>
            <li><Link href="/parts">Parts</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li><Link href="/vhc">VHC / Checks</Link></li>
            <li><Link href="/sales">Sales</Link></li>
            <li><Link href="/reports">Reports</Link></li>
            <li><Link href="/messages">Messages</Link></li>
          </ul>
        </nav>
      </aside>

      <div className="main-content">
        <header className="header">Humphries & Parks System</header>

        <main className="content">
          {children}
        </main>

        <footer className="footer">
          &copy; {new Date().getFullYear()} Humphries & Parks
        </footer>
      </div>
    </div>
  );
}
