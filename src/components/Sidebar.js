// src/components/Sidebar.js
import Link from "next/link";
import { useUser } from "@/context/UserContext";

export default function Sidebar() {
  const { roles, user } = useUser();

  return (
    <aside className="w-56 bg-gray-800 text-white p-4 flex-shrink-0 min-h-screen">
      <h2 className="text-2xl font-bold mb-4">DMS</h2>
      <nav>
        <ul className="space-y-2">
          <li><Link href="/" className="block p-2 rounded hover:bg-gray-700">Dashboard</Link></li>
          <li><Link href="/accounts/Profile" className="block p-2 rounded hover:bg-gray-700">Accounts</Link></li>
          <li><Link href="/admin/UserManagement" className="block p-2 rounded hover:bg-gray-700">Admin</Link></li>
          <li><Link href="/management/Reports" className="block p-2 rounded hover:bg-gray-700">Management</Link></li>
          <li><Link href="/workshop/Clocking" className="block p-2 rounded hover:bg-gray-700">Workshop</Link></li>
          <li><Link href="/parts/Inventory" className="block p-2 rounded hover:bg-gray-700">Parts</Link></li>
          <li><Link href="/sales/Tracker" className="block p-2 rounded hover:bg-gray-700">Sales</Link></li>

          {(user.role === roles.ADMIN || user.role === roles.SALES || user.role === roles.WORKSHOP) && (
            <li><Link href="/car-buying" className="block p-2 rounded hover:bg-gray-700">Buying</Link></li>
          )}

          <li><Link href="/valet/Valet" className="block p-2 rounded hover:bg-gray-700">Valet</Link></li>
          <li><Link href="/mot/MOT" className="block p-2 rounded hover:bg-gray-700">MOT</Link></li>
          <li><Link href="/smart/Repairs" className="block p-2 rounded hover:bg-gray-700">Smart Repair</Link></li>
          <li><Link href="/contractors/Portal" className="block p-2 rounded hover:bg-gray-700">Contractors</Link></li>
          <li><Link href="/processing/Parking" className="block p-2 rounded hover:bg-gray-700">Processing</Link></li>
          <li><Link href="/customer/Portal" className="block p-2 rounded hover:bg-gray-700">Customer</Link></li>
        </ul>
      </nav>
    </aside>
  );
}