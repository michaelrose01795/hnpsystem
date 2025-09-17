import Link from "next/link";
import "./home.css"; // import your CSS file

export default function Home() {
  return (
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
        </div>
      </main>

      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} Humphries & Parks</p>
      </footer>
    </div>
  );
}
