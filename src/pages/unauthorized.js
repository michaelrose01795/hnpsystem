// file location: pages/unauthorized.js
// pages/unauthorized.js - shows when a user tries to access a page they don't have permission for

import React from 'react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '40px auto' }}>
      <h1>Unauthorized</h1>
      <p>You do not have permission to view that page.</p>
      <p>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}