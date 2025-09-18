/* src/components/Sidebar.js */
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside style={{ width: "220px", background: "#2f3b52", color: "white", padding: "1rem" }}>
      <h2>DMS</h2>
      <nav>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li><Link href="/">Dashboard</Link></li>
          <li><Link href="/accounts/Profile">Accounts</Link></li>
          <li><Link href="/admin/UserManagement">Admin</Link></li>
          <li><Link href="/management/Reports">Management</Link></li>
          <li><Link href="/workshop/Clocking">Workshop</Link></li>
          <li><Link href="/parts/Inventory">Parts</Link></li>
          <li><Link href="/sales/Tracker">Sales</Link></li>
          <li><Link href="/buying/CarBuying">Buying</Link></li>
          <li><Link href="/valet/Valet">Valet</Link></li>
          <li><Link href="/mot/MOT">MOT</Link></li>
          <li><Link href="/smart/Repairs">Smart Repair</Link></li>
          <li><Link href="/contractors/Portal">Contractors</Link></li>
          <li><Link href="/processing/Parking">Processing</Link></li>
          <li><Link href="/customer/Portal">Customer</Link></li>
        </ul>
      </nav>
    </aside>
  );
}
