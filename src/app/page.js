// src/app/page.js
import Link from "next/link"; // Next.js Link component for client-side page navigation
import Layout from "../components/Layout"; // import Layout wrapper to include sidebar/header/footer
import "./home.css"; // optional CSS for additional styling of homepage

export default function HomePage() {
  return (
    <Layout> {/* wrap entire page in Layout to include sidebar + header/footer */}
      <div className="home-container"> {/* main container for homepage content */}

        <header className="home-header"> {/* page header section */}
          <h1>Welcome to Humphries & Parks System</h1> {/* main heading */}
          <p>Your all-in-one workshop and sales dashboard</p> {/* subheading / description */}
        </header>

        <main className="home-main"> {/* main content area */}
          <div className="cards"> {/* container for dashboard cards / links */}

            {/* Each card links to a page in the system */}
            <Link href="/accounts" className="card">
              <h2>Account Management</h2> {/* card title */}
              <p>View and edit your profile, manage users (admins only)</p> {/* card description */}
            </Link>

            <Link href="/jobs" className="card">
              <h2>Jobs / Workshop</h2>
              <p>View active jobs, check job progress, clock in/out</p>
            </Link>

            <Link href="/parts" className="card">
              <h2>Parts</h2>
              <p>Request parts, check inventory, track sales</p>
            </Link>

            <Link href="/dashboard" className="card">
              <h2>Dashboard</h2>
              <p>View system stats, active users, and workshop summary</p>
            </Link>

            <Link href="/vhc" className="card">
              <h2>VHC / Checks</h2>
              <p>Vehicle health checks and service reminders</p>
            </Link>

            <Link href="/sales" className="card">
              <h2>Sales</h2>
              <p>Track car sales, salespersons, and videos</p>
            </Link>

            <Link href="/reports" className="card">
              <h2>Reports</h2>
              <p>View system reports, active jobs, and parts requests</p>
            </Link>

            <Link href="/messages" className="card">
              <h2>Messages</h2>
              <p>View internal messages and notifications</p>
            </Link>

          </div> {/* end cards container */}
        </main> {/* end main content */}
      </div> {/* end home container */}
    </Layout> /* end Layout wrapper */
  );
}
