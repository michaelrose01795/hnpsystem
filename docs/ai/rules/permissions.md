# permissions.md — Auth, Roles, Route Protection

## Auth Stack

- **NextAuth.js** with Credentials Provider → Supabase `users` table.
- Keycloak env vars exist in the repo but are **not yet active**. Do not wire Keycloak calls into production paths.
- Session resolved with `useSession()` (client) or `getSession()` in `getServerSideProps` (server).
- User context: `src/context/UserContext.js`.

## Roles — Never Hardcode

All role checks **import** from these files:
- `src/lib/auth/roles.js` — constants like `HR_CORE_ROLES`, `MANAGER_SCOPED_ROLES`, `ADMIN_MANAGER_ROLES`
- `src/config/users.js` — user → role mapping
- `src/lib/auth/roleGuard.js` — helpers `hasAnyRole`, `isHrCoreRole`, `isAdminManagerRole`

Never write a literal role string like `"manager"` or `"hr"` inline.

## Page-Level Protection

Wrap protected pages with `ProtectedRoute` from `src/components/ProtectedRoute.js`. Pass the allowed roles via its props.

## API-Level Protection

Resolve the user with `getUserFromRequest` from `src/lib/auth/getUserFromRequest.js`, then gate with `hasAnyRole`.

## Real Routes vs Presentation Routes

Role checks on real app routes must **never be relaxed** for the sake of presentation/demo flows. See [presentation.md](presentation.md).
