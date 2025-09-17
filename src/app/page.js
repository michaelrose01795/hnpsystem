import Link from "next/link";
import Layout from "../components/Layout";
import "./home.css"; // optional if you want extra styling

export default function HomePage() {
  return (
    <Layout>
      <div className="home-container">
        <header className="home-header">
          <h1>Welcome to Humphries & Parks System</h1>
          <p>Your all-in-one workshop and sales dashboard</p>
        </header>

        <main className="home-main">
          <div className="cards">
            <Link href="/accounts" className="card">
              <h2>Account Management</h2>
              <p>View and edit your profile, manage users (admins only)</p>
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
          </div>
        </main>
      </div>
    </Layout>
  );
}
