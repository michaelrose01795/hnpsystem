// components/Layout.js
import Sidebar from "./Sidebar";
import { useState } from "react";

export default function Layout({ children, tabs }) {
  const [activeTab, setActiveTab] = useState(tabs?.[0] || null);

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar />

      <main className="flex-1 p-6 overflow-auto">
        {tabs && (
          <div className="flex gap-4 border-b mb-4">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 ${
                  activeTab === tab
                    ? "text-[var(--color-accent)] font-semibold"
                    : "text-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div className="bg-[var(--color-box)] p-6 rounded-md shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
