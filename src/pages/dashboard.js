// file location: pages/dashboard.js
// pages/dashboard.js - simple role-aware dashboard; protected so only logged in users can view

import React from 'react'; // import React
import ProtectedRoute from '../components/ProtectedRoute'; // protected wrapper
import { useUser } from '../context/UserContext'; // user hook

export default function DashboardPage() {
  const { user, logout } = useUser(); // get user and logout helper

  // small UI for demonstration — expand this in Phase 1.1 tasks (status bars, cards etc.)
  return (
    <ProtectedRoute> {/* all logged-in users can access dashboard in this MVP */}
      <div style={{ padding: 20, maxWidth: 1100, margin: '20px auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>H&P Dashboard</h2>
            <div style={{ color: '#555' }}>
              Signed in as <strong>{user?.username}</strong> — Role: <strong>{user?.role}</strong>
            </div>
          </div>
          <div>
            <button onClick={() => logout()} style={{ padding: '8px 12px' }}>
              Logout
            </button>
          </div>
        </header>

        <main style={{ marginTop: 20 }}>
          <section style={{ marginBottom: 16 }}>
            <h3>Quick status</h3>
            <p>Phase 1.1 MVP: role-aware landing area is working. Next: connect Keycloak + role detection.</p>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <strong>Jobs</strong>
              <div style={{ marginTop: 8 }}>Placeholder for incoming jobs / progress bar</div>
            </div>

            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <strong>Clocking</strong>
              <div style={{ marginTop: 8 }}>Placeholder for mechanic clocking status</div>
            </div>

            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <strong>Parts</strong>
              <div style={{ marginTop: 8 }}>Placeholder for parts requests</div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}