// ✅ Connected to Supabase (server-side)
// file location: src/lib/database/client.js
import { createClient } from "@supabase/supabase-js"; // Import factory helper to instantiate Supabase clients.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Read the Supabase project URL from environment variables injected by Next.js.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read the privileged service role key that allows full database access from secure server code.
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Fallback key exposed to the browser for read-only operations when no service key is available.

if (!supabaseUrl) { // Ensure a descriptive failure if the Supabase URL is missing.
  throw new Error("Environment variable NEXT_PUBLIC_SUPABASE_URL is required for database access."); // Throwing here surfaces configuration issues immediately in any environment.
} // Close the URL guard clause.

if (!serviceRoleKey && !anonKey) { // Allow either the service role key (preferred) or anon key as a fallback.
  throw new Error("Set SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY so the database client can authenticate."); // Provide a clear configuration hint for both server and client contexts.
} // Close the key guard clause.

if (!serviceRoleKey && anonKey) { // When only the anon key exists, warn once so developers know privileged features may be unavailable.
  console.warn("Using NEXT_PUBLIC_SUPABASE_ANON_KEY because SUPABASE_SERVICE_ROLE_KEY is not set; some server-only operations may fail."); // eslint-disable-line no-console -- intentional warning for missing configuration.
} // Close the warning clause.

const client = createClient(supabaseUrl, serviceRoleKey || anonKey); // Create a singleton Supabase client using the best available credentials.

export const getDatabaseClient = () => client; // Expose a getter so each module can reuse the already-instantiated client without duplicating setup.

export default client; // Provide a default export for convenience in modules that prefer direct named imports.
