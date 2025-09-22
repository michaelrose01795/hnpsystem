// file location: pages/login.js
// pages/login.js - simple login page with username + role dropdown (MVP behaviour)

import React, { useState } from 'react'; // import React and useState
import { useRouter } from 'next/router'; // for navigation
import { useUser } from '../context/UserContext'; // our context hooks

const ROLES = ['ADMIN', 'MANAGER', 'WORKSHOP', 'SALES', 'PARTS', 'MOT', 'VALET', 'PAINT']; // role options

export default function LoginPage() {
  const router = useRouter(); // router to redirect after login
  const { user, login } = useUser(); // get login helper and current user (if any)
  const [username, setUsername] = useState(''); // local username field
  const [role, setRole] = useState('WORKSHOP'); // default role selection
  const [error, setError] = useState(null); // simple error handling

  // if already logged in, go straight to dashboard
  if (typeof window !== 'undefined' && user) {
    if (user) router.replace('/dashboard'); // already logged in → redirect
  }

  const handleSubmit = (e) => {
    e.preventDefault(); // prevent page reload
    setError(null); // clear previous error
    if (!username || username.trim().length < 2) {
      setError('Enter a username (at least 2 characters)'); // basic validation
      return;
    }
    // call login helper from context — this is the MVP local auth
    login({ username: username.trim(), role });
    router.push('/dashboard'); // go to dashboard after login
  };

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 20 }}>
      <h1>H&P — Login (Phase 1.1)</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jamie.b"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }}
          />
        </label>

        <label style={{ display: 'block', margin: '12px 0' }}>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>} {/* show simple error */}

        <button type="submit" style={{ padding: '10px 14px' }}>
          Sign in
        </button>
      </form>
      <p style={{ marginTop: 16, color: '#666' }}>
        This is the Phase 1.1 MVP: a local login with role selection. We'll replace this with Keycloak SSO in Phase 1.2.
      </p>
    </div>
  );
}