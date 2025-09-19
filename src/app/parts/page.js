import Link from "next/link";

export default function PartsDashboard() {
  const partsFeatures = [
    { name: "Request Parts", path: "/parts/request" },
    { name: "Approve/Deny Requests", path: "/parts/approval" },
    { name: "Inventory Management", path: "/parts/inventory" },
    { name: "Sales Tracking", path: "/parts/sales" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Parts Department Dashboard</h1>
      <p className="mb-6">Choose a section below to manage parts operations:</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partsFeatures.map((feature, index) => (
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