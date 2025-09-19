import Link from "next/link";
import { useUser } from "@/context/UserContext";

export default function Sidebar() {
  const { roles } = useUser();

  return (
    <aside className="w-56 bg-gray-800 text-white p-4 flex-shrink-0 min-h-screen">
      <h2 className="text-2xl font-bold mb-4">DMS</h2>
      <nav>
        <ul className="space-y-2">
          <li><Link href="/">Dashboard</Link></li>
          <li><Link href="/accounts/Profile">Accounts</Link></li>
          <li><Link href="/admin/UserManagement">Admin</Link></li>
          <li><Link href="/management/Reports">Management</Link></li>
          <li><Link href="/workshop/Clocking">Workshop</Link></li>
          <li><Link href="/parts/Inventory">Parts</Link></li>
          <li><Link href="/sales/Tracker">Sales</Link></li>
          {/* Only show Buying if user has role */}
          {(roles.ADMIN || roles.SALES || roles.WORKSHOP) && (
            <li><Link href="/car-buying">Buying</Link></li>
          )}
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