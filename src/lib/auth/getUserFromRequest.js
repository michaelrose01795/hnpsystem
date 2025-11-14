// file location: src/lib/auth/getUserFromRequest.js
export async function getUserFromRequest(_req) { // Placeholder resolver until Keycloak session wiring is finished.
  return { role: "Admin" }; // TODO: Replace with Keycloak-based session parsing to surface the caller's real role.
}

export default getUserFromRequest; // Provide a default export for convenience.
