import Link from "next/link";

export default function SalesDashboard() {
  const salesFeatures = [
    { name: "Car Sales Tracking", path: "/sales/tracking" },
    { name: "Customer Database", path: "/sales/customers" },
    { name: "Video Creation", path: "/sales/videos" },
    { name: "Car Stock Overview", path: "/sales/stock" },
    { name: "Sales Reports", path: "/sales/reports" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Department Dashboard</h1>
      <p className="mb-6">
        Manage sales performance, customers, and stock from here:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {salesFeatures.map((feature, index) => (
          <Link key={index} href={feature.path}>
            <div className="p-6 bg-gray-100 rounded-lg shadow hover:bg-gray-200 cursor-pointer transition">
              <h2 className="text-xl font-semibold">{feature.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}