// file location: src/pages/unauthorized.js
// pages/unauthorized.js - shows when a user tries to access a page they don't have permission for

import React from 'react';
import Link from 'next/link';
import UnauthorizedPageUi from "@/components/page-ui/unauthorized-ui"; // Extracted presentation layer.

export default function UnauthorizedPage() {
  return <UnauthorizedPageUi view="section1" Link={Link} />;








}
